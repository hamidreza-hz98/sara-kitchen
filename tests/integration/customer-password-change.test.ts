import { Mongoose } from "mongoose";
import type { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({
    AUTH_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  }),
}));

import {
  changeCurrentCustomerPassword,
  CustomerPasswordChangeRejectedError,
} from "@/server/modules/auth/service/customer-password-change";
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
const nextPassword = "A different secure passphrase 2026";

describe("customer password change", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let sequence = 0;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-password-change-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  async function fixture(persistent = false) {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    sequence += 1;
    const customer = await getCustomerModel(connection).create({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: `+351920000${String(sequence).padStart(3, "0")}`,
      passwordHash: await hashCustomerPassword(originalPassword),
    });
    const expiry = new Date(Date.now() + 60 * 60_000);
    const current = await issueSession(connection, {
      actorKind: "customer",
      actorId: customer._id,
      expiresAt: expiry,
      persistent,
    });
    const other = await issueSession(connection, {
      actorKind: "customer",
      actorId: customer._id,
      expiresAt: expiry,
      persistent,
    });
    return { connection, customerId: customer._id as Types.ObjectId, current, other, expiry };
  }

  it("requires the current password and rejects reuse without changing the version or bearer", async () => {
    const { connection, customerId, current } = await fixture();
    await expect(
      changeCurrentCustomerPassword(connection, {
        token: current.token,
        currentPassword: "The wrong customer passphrase",
        newPassword: nextPassword,
        revokeOtherSessions: true,
      }),
    ).rejects.toMatchObject({ reason: "current" });
    await expect(
      changeCurrentCustomerPassword(connection, {
        token: current.token,
        currentPassword: originalPassword,
        newPassword: originalPassword,
        revokeOtherSessions: true,
      }),
    ).rejects.toMatchObject({ reason: "same" });
    await expect(
      changeCurrentCustomerPassword(connection, {
        token: current.token,
        currentPassword: originalPassword,
        newPassword: "short",
        revokeOtherSessions: true,
      }),
    ).rejects.toMatchObject({ reason: "policy" });
    expect((await getCustomerModel(connection).findById(customerId))?.passwordVersion).toBe(1);
    expect(await resolveSession(connection, current.token, "customer")).not.toBeNull();
  });

  it("rotates the current bearer and revokes all other sessions when requested", async () => {
    const { connection, customerId, current, other, expiry } = await fixture(true);
    const changed = await changeCurrentCustomerPassword(connection, {
      token: current.token,
      currentPassword: originalPassword,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    });
    expect(changed.session.token).not.toBe(current.token);
    expect(changed.session.expiresAt).toEqual(expiry);
    expect(changed.persistent).toBe(true);
    expect(await resolveSession(connection, current.token, "customer")).toBeNull();
    expect(await resolveSession(connection, other.token, "customer")).toBeNull();
    expect(
      (await resolveSession(connection, changed.session.token, "customer"))?.passwordVersion,
    ).toBe(2);
    expect((await getCustomerModel(connection).findById(customerId))?.passwordVersion).toBe(2);
    expect(await verifyCustomerPasswordForLogin(connection, customerId, originalPassword)).toBe(
      false,
    );
    expect(await verifyCustomerPasswordForLogin(connection, customerId, nextPassword)).toBe(true);
    expect(
      await getSessionModel(connection).countDocuments({
        actorId: customerId,
        revocationReason: "password-change",
      }),
    ).toBe(2);
    await expect(
      changeCurrentCustomerPassword(connection, {
        token: current.token,
        currentPassword: originalPassword,
        newPassword: "Another entirely different passphrase",
        revokeOtherSessions: true,
      }),
    ).rejects.toBeInstanceOf(CustomerPasswordChangeRejectedError);
  });

  it("preserves other active sessions when the customer does not select revocation", async () => {
    const { connection, current, other, expiry } = await fixture();
    const changed = await changeCurrentCustomerPassword(connection, {
      token: current.token,
      currentPassword: originalPassword,
      newPassword: nextPassword,
      revokeOtherSessions: false,
    });
    expect(await resolveSession(connection, current.token, "customer")).toBeNull();
    expect((await resolveSession(connection, other.token, "customer"))?.passwordVersion).toBe(2);
    expect(
      (await resolveSession(connection, changed.session.token, "customer"))?.passwordVersion,
    ).toBe(2);
    expect(changed.session.expiresAt).toEqual(expiry);
    expect(
      await getSessionModel(connection).countDocuments({ revokedAt: { $ne: null } }),
    ).toBeGreaterThan(0);
    expect((await getSessionModel(connection).findById(other.id))?.revokedAt).toBeNull();
  });
});
