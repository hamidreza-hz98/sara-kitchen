import { Mongoose } from "mongoose";
import type { Connection } from "mongoose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ connection: null as Connection | null }));
vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/server/database", () => ({
  connectToDatabase: async () => {
    if (!state.connection) throw new Error("Test connection not ready.");
    return state.connection;
  },
}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import { POST } from "@/app/api/auth/customer/change-password/route";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";
import { createCsrfToken } from "@/server/modules/auth/policy/csrf";
import { issueSession } from "@/server/modules/sessions/service/issue-session";
import { resolveSession } from "@/server/modules/sessions/service/session-lifecycle";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const originalPassword = "A strong customer passphrase 2026";
const newPassword = "A different secure passphrase 2026";
const url = "http://localhost:3000/api/auth/customer/change-password";

describe("customer change-password Route Handler", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-password-change-route-test");
    client = new Mongoose();
    await client.connect(database.uri);
    state.connection = client.connection;
    const customer = await getCustomerModel(client.connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "+351912345678",
      passwordHash: await hashCustomerPassword(originalPassword),
    });
    token = (
      await issueSession(client.connection, {
        actorKind: "customer",
        actorId: customer._id,
        expiresAt: new Date(Date.now() + 60_000),
      })
    ).token;
    otherToken = (
      await issueSession(client.connection, {
        actorKind: "customer",
        actorId: customer._id,
        expiresAt: new Date(Date.now() + 60_000),
      })
    ).token;
  }, 120_000);

  afterAll(async () => {
    state.connection = null;
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  function request(body: unknown, options: { bearer?: string; origin?: string } = {}): NextRequest {
    return new NextRequest(url, {
      method: "POST",
      headers: {
        origin: options.origin ?? "http://localhost:3000",
        "content-type": "application/json",
        ...(options.bearer ? { "x-csrf-token": createCsrfToken("customer", options.bearer) } : {}),
        ...(options.bearer ? { cookie: `sara_customer_dev=${options.bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("requires a same-origin authenticated session", async () => {
    const body = { currentPassword: originalPassword, newPassword, revokeOtherSessions: true };
    expect((await POST(request(body))).status).toBe(401);
    expect(
      (await POST(request(body, { bearer: token, origin: "https://evil.example" }))).status,
    ).toBe(403);
  });

  it("rejects an incorrect or reused current password without mutating sessions", async () => {
    const wrong = await POST(
      request(
        {
          currentPassword: "Wrong customer passphrase 2026",
          newPassword,
          revokeOtherSessions: true,
        },
        { bearer: token },
      ),
    );
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error.details.issues[0].path).toEqual(["currentPassword"]);
    const same = await POST(
      request(
        {
          currentPassword: originalPassword,
          newPassword: originalPassword,
          revokeOtherSessions: true,
        },
        { bearer: token },
      ),
    );
    expect(same.status).toBe(400);
    expect((await same.json()).error.details.issues[0].path).toEqual(["newPassword"]);
    expect(await resolveSession(state.connection!, token, "customer")).not.toBeNull();
  });

  it("issues only a new cookie, rotates the bearer, and revokes selected other sessions", async () => {
    const response = await POST(
      request(
        { currentPassword: originalPassword, newPassword, revokeOtherSessions: true },
        { bearer: token },
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { changed: true, otherSessionsRevoked: true },
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    const rotated = /sara_customer_dev=([^;]+)/u.exec(cookie)?.[1];
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(token);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(await resolveSession(state.connection!, token, "customer")).toBeNull();
    expect(await resolveSession(state.connection!, otherToken, "customer")).toBeNull();
    expect(await resolveSession(state.connection!, rotated!, "customer")).not.toBeNull();
  });
});
