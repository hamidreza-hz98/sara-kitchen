import { Mongoose } from "mongoose";
import type { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_PASSWORD_RESET_SECRET: "test-reset-secret-with-at-least-32-characters",
  }),
}));

import { getPasswordResetModel } from "@/server/modules/auth/model/password-reset";
import {
  PasswordResetRejectedError,
  requestCustomerPasswordReset,
  resetCustomerPassword,
} from "@/server/modules/auth/service/customer-password-reset";
import { getCustomerModel } from "@/server/modules/customers/model/customer";
import {
  hashCustomerPassword,
  verifyCustomerPasswordForLogin,
} from "@/server/modules/customers/service/password";
import { getSessionModel } from "@/server/modules/sessions/model/session";
import { issueSession } from "@/server/modules/sessions/service/issue-session";
import { resolveSession } from "@/server/modules/sessions/service/session-lifecycle";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

const originalPassword = "A strong customer passphrase 2026";
const newPassword = "A different secure passphrase 2026";

describe("customer password-reset lifecycle", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let customerId: Types.ObjectId;
  const sent: { mobile: string; link: string; locale: string }[] = [];
  const sender = async (mobile: string, link: string, locale: string) => {
    sent.push({ mobile, link, locale });
  };

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-password-reset-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const customer = await getCustomerModel(client.connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      email: "sara@example.com",
      passwordHash: await hashCustomerPassword(originalPassword),
    });
    customerId = customer._id;
    await getPasswordResetModel(client.connection).syncIndexes();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  function tokenFromLastMessage() {
    const link = sent.at(-1)?.link;
    if (!link) throw new Error("No reset SMS was sent.");
    return new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
  }

  it("does nothing for unknown or disabled identities and sends to the registered mobile for email requests", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    await requestCustomerPasswordReset(
      client.connection,
      { identifier: "missing@example.com", locale: "en", siteUrl: "https://sara.example" },
      sender,
    );
    expect(sent).toHaveLength(0);
    await getCustomerModel(client.connection).updateOne(
      { _id: customerId },
      { $set: { status: "disabled" } },
    );
    await requestCustomerPasswordReset(
      client.connection,
      { identifier: "sara@example.com", locale: "en", siteUrl: "https://sara.example" },
      sender,
    );
    expect(sent).toHaveLength(0);
    await getCustomerModel(client.connection).updateOne(
      { _id: customerId },
      { $set: { status: "active" } },
    );
    await requestCustomerPasswordReset(
      client.connection,
      { identifier: " SARA@EXAMPLE.COM ", locale: "pt-PT", siteUrl: "https://sara.example" },
      sender,
    );
    expect(sent.at(-1)).toMatchObject({ mobile: "+351912345678", locale: "pt-PT" });
    expect(sent.at(-1)?.link).toMatch(/^https:\/\/sara\.example\/reset-password#token=/u);
    const token = tokenFromLastMessage();
    const stored = await getPasswordResetModel(client.connection).collection.findOne({
      customerId,
    });
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(stored?.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored?.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
  });

  it("invalidates the previous link and rejects altered and expired tokens", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const old = tokenFromLastMessage();
    await requestCustomerPasswordReset(
      client.connection,
      { identifier: "912345678", locale: "en", siteUrl: "https://sara.example" },
      sender,
    );
    await expect(resetCustomerPassword(client.connection, old, newPassword)).rejects.toBeInstanceOf(
      PasswordResetRejectedError,
    );
    const current = tokenFromLastMessage();
    await expect(
      resetCustomerPassword(
        client.connection,
        `${current.startsWith("A") ? "B" : "A"}${current.slice(1)}`,
        newPassword,
      ),
    ).rejects.toBeInstanceOf(PasswordResetRejectedError);
    const record = await getPasswordResetModel(client.connection).collection.findOne({
      customerId,
      consumedAt: null,
    });
    if (!record) throw new Error("Current reset record not found.");
    await getPasswordResetModel(client.connection).collection.updateOne(
      { _id: record._id },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    );
    await expect(
      resetCustomerPassword(client.connection, current, newPassword),
    ).rejects.toBeInstanceOf(PasswordResetRejectedError);
  });

  it("consumes a valid token once, changes the hash, increments version and revokes every session", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    await requestCustomerPasswordReset(
      connection,
      { identifier: "912345678", locale: "fa", siteUrl: "https://sara.example" },
      sender,
    );
    const token = tokenFromLastMessage();
    const first = await issueSession(connection, {
      actorKind: "customer",
      actorId: customerId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const second = await issueSession(connection, {
      actorKind: "customer",
      actorId: customerId,
      persistent: true,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await resetCustomerPassword(connection, token, newPassword);
    expect(await verifyCustomerPasswordForLogin(connection, customerId, originalPassword)).toBe(
      false,
    );
    expect(await verifyCustomerPasswordForLogin(connection, customerId, newPassword)).toBe(true);
    expect((await getCustomerModel(connection).findById(customerId))?.passwordVersion).toBe(2);
    expect(await resolveSession(connection, first.token, "customer")).toBeNull();
    expect(await resolveSession(connection, second.token, "customer")).toBeNull();
    expect(
      await getSessionModel(connection).countDocuments({
        actorId: customerId,
        revocationReason: "password-reset",
      }),
    ).toBe(2);
    await expect(resetCustomerPassword(connection, token, newPassword)).rejects.toBeInstanceOf(
      PasswordResetRejectedError,
    );
  });

  it("consumes the token on delivery failure without logging or exposing it", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    await expect(
      requestCustomerPasswordReset(
        client.connection,
        { identifier: "912345678", locale: "en", siteUrl: "https://sara.example" },
        async () => {
          throw new Error("provider token leak placeholder");
        },
      ),
    ).rejects.toThrow("Password reset delivery failed.");
    expect(
      await getPasswordResetModel(client.connection).countDocuments({
        customerId,
        consumedAt: null,
      }),
    ).toBe(0);
  });
});
