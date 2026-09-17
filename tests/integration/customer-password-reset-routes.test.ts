import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connection: null as Connection | null,
  tasks: [] as Promise<void>[],
  sms: [] as { to: string; from: string; body: string }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    after: (callback: () => Promise<void>) => {
      state.tasks.push(Promise.resolve().then(callback));
    },
  };
});
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/server/database", () => ({
  connectToDatabase: async () => {
    if (!state.connection) throw new Error("Test connection not ready.");
    return state.connection;
  },
}));
vi.mock("@/server/environment", () => ({
  getApplicationSiteUrl: () => "https://sara.example",
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
    AUTH_PASSWORD_RESET_SECRET: "test-reset-secret-with-at-least-32-characters",
    RESET_SMS_ENABLED: true,
    TWILIO_RESET_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_RESET_AUTH_TOKEN: "test-twilio-auth-token-at-least-32-characters",
    TWILIO_RESET_FROM_NUMBER: "+351900000000",
  }),
}));

import { POST as requestReset } from "@/app/api/auth/customer/password-reset/request/route";
import { POST as completeReset } from "@/app/api/auth/customer/password-reset/complete/route";
import { getPasswordResetLimitModel } from "@/server/modules/auth/model/password-reset-limit";
import { getPasswordResetModel } from "@/server/modules/auth/model/password-reset";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const oldPassword = "A strong customer passphrase 2026";
const newPassword = "A different customer passphrase 2026";
const baseUrl = "http://localhost:3000/api/auth/customer/password-reset";

function request(path: string, body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(`${baseUrl}/${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": "192.0.2.60" },
    body: JSON.stringify(body),
  });
}

async function flushAfter() {
  await Promise.all(state.tasks.splice(0));
}

function latestToken(): string {
  const url = state.sms.at(-1)?.body.match(/https:\/\/[^\s]+/u)?.[0];
  if (!url) throw new Error("Reset SMS was not sent.");
  return new URLSearchParams(new URL(url).hash.slice(1)).get("token") ?? "";
}

describe("customer password-reset Route Handlers and SMS adapter", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-password-reset-routes-test");
    client = new Mongoose();
    await client.connect(database.uri);
    state.connection = client.connection;
    await getCustomerModel(client.connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      email: "sara@example.com",
      passwordHash: await hashCustomerPassword(oldPassword),
    });
    await getPasswordResetModel(client.connection).syncIndexes();
    await getPasswordResetLimitModel(client.connection).syncIndexes();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
        const form = new URLSearchParams(options.body as URLSearchParams);
        state.sms.push({
          to: form.get("To") ?? "",
          from: form.get("From") ?? "",
          body: form.get("Body") ?? "",
        });
        return new Response("{}", { status: 201 });
      }),
    );
  }, 120_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    state.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("returns identical public responses for known and unknown identities, dispatching SMS only for known", async () => {
    const known = await requestReset(request("request", { identifier: "sara@example.com" }));
    const unknown = await requestReset(request("request", { identifier: "missing@example.com" }));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect((await known.json()).data).toEqual((await unknown.json()).data);
    await flushAfter();
    expect(state.sms).toHaveLength(1);
    expect(state.sms[0]).toMatchObject({ to: "+351912345678", from: "+351900000000" });
    expect(latestToken()).toHaveLength(43);
  });

  it("rejects altered and expired links but accepts a valid one once", async () => {
    const first = latestToken();
    const altered = `${first.startsWith("A") ? "B" : "A"}${first.slice(1)}`;
    expect((await completeReset(request("complete", { token: altered, newPassword }))).status).toBe(
      400,
    );
    const expired = await getPasswordResetModel(state.connection!).collection.findOne({
      consumedAt: null,
    });
    if (!expired) throw new Error("Reset token not found.");
    await getPasswordResetModel(state.connection!).collection.updateOne(
      { _id: expired._id },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    );
    expect((await completeReset(request("complete", { token: first, newPassword }))).status).toBe(
      400,
    );
    expect((await requestReset(request("request", { identifier: "912345678" }))).status).toBe(202);
    await flushAfter();
    const valid = latestToken();
    const success = await completeReset(request("complete", { token: valid, newPassword }));
    expect(success.status).toBe(200);
    expect(success.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await completeReset(request("complete", { token: valid, newPassword }))).status).toBe(
      400,
    );
  });

  it("rejects foreign origins before issuing or consuming a token", async () => {
    expect(
      (
        await requestReset(
          request("request", { identifier: "sara@example.com" }, "https://evil.example"),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await completeReset(
          request("complete", { token: latestToken(), newPassword }, "https://evil.example"),
        )
      ).status,
    ).toBe(403);
  });
});
