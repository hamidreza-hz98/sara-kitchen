import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAdminModel } from "@/server/modules/admins/model/admin";
import { hashAdminPassword } from "@/server/modules/admins/service/password";
import {
  AdminLoginRejectedError,
  loginAdmin,
  logoutAdmin,
  resolveAdminActor,
} from "@/server/modules/auth/service/admin-session";
import { getSessionModel } from "@/server/modules/sessions/model/session";
import { issueSession } from "@/server/modules/sessions/service/issue-session";
import { resolveSession } from "@/server/modules/sessions/service/session-lifecycle";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("admin login and logout", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let adminId: Types.ObjectId;
  const password = "A strong administrator passphrase 2026";

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-admin-auth-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Admin = getAdminModel(client.connection);
    const admin = await Admin.create({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "Sara@Example.com",
      role: "owner",
      passwordHash: await hashAdminPassword(password),
    });
    adminId = admin._id;
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("authenticates normalized identity, records last login and resolves the active session", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const before = Date.now();
    const result = await loginAdmin(client.connection, {
      identifier: "  SARA@EXAMPLE.COM  ",
      password,
      userAgent: "Sara Kitchen test browser",
    });
    expect(result.admin.id).toBe(adminId.toHexString());
    expect(result.admin.permissions).toContain("dashboard:view");
    expect(result.session.token).toHaveLength(43);
    expect(JSON.stringify(result)).not.toContain(result.session.token);
    const stored = await getSessionModel(client.connection).collection.findOne({
      _id: new Types.ObjectId(result.session.id),
    });
    expect(stored?.tokenHash).not.toBe(result.session.token);
    expect(stored?.actorId.toHexString()).toBe(adminId.toHexString());
    expect(stored?.audience).toBe("admin");
    expect(stored?.passwordVersion).toBe(1);
    expect(
      (await getAdminModel(client.connection).findById(adminId))?.lastLoginAt?.getTime(),
    ).toBeGreaterThanOrEqual(before);
    expect((await resolveAdminActor(client.connection, result.session.token))?.displayName).toBe(
      "Sara Kazemi",
    );
    expect(await resolveSession(client.connection, result.session.token, "customer")).toBeNull();
  });

  it("rejects bad credentials, unknown identities and disabled accounts without a new session", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const Session = getSessionModel(connection);
    const before = await Session.countDocuments();
    for (const identifier of ["sara@example.com", "missing@example.com"]) {
      await expect(
        loginAdmin(connection, { identifier, password: "not the password" }),
      ).rejects.toBeInstanceOf(AdminLoginRejectedError);
    }
    await getAdminModel(connection).updateOne({ _id: adminId }, { $set: { active: false } });
    await expect(
      loginAdmin(connection, { identifier: "sara@example.com", password }),
    ).rejects.toBeInstanceOf(AdminLoginRejectedError);
    expect(await Session.countDocuments()).toBe(before);
    await getAdminModel(connection).updateOne({ _id: adminId }, { $set: { active: true } });
  });

  it("denies expired, idle, revoked and password-version-mismatched sessions", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const Session = getSessionModel(connection);
    const fresh = await issueSession(connection, {
      actorKind: "admin",
      actorId: adminId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await Session.collection.updateOne(
      { _id: new Types.ObjectId(fresh.id) },
      { $set: { expiresAt: new Date(Date.now() - 1_000) } },
    );
    expect(await resolveAdminActor(connection, fresh.token)).toBeNull();

    const idle = await issueSession(connection, {
      actorKind: "admin",
      actorId: adminId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await Session.collection.updateOne(
      { _id: new Types.ObjectId(idle.id) },
      { $set: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } },
    );
    expect(await resolveAdminActor(connection, idle.token)).toBeNull();

    const stale = await issueSession(connection, {
      actorKind: "admin",
      actorId: adminId,
      passwordVersion: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(await resolveAdminActor(connection, stale.token)).toBeNull();
  });

  it("rotates an existing cookie token and revokes it before granting a new one", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const previous = await issueSession(connection, {
      actorKind: "admin",
      actorId: adminId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await loginAdmin(connection, {
      identifier: "sara@example.com",
      password,
      priorToken: previous.token,
    });
    expect(result.session.token).not.toBe(previous.token);
    expect(await resolveAdminActor(connection, previous.token)).toBeNull();
    expect(await resolveAdminActor(connection, result.session.token)).not.toBeNull();
    const oldRecord = await getSessionModel(connection).collection.findOne({
      _id: new Types.ObjectId(previous.id),
    });
    expect(oldRecord?.revocationReason).toBe("login-rotation");
  });

  it("revokes on logout, including repeated logout without restoring a session", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const result = await loginAdmin(connection, { identifier: "sara@example.com", password });
    await logoutAdmin(connection, result.session.token);
    expect(await resolveAdminActor(connection, result.session.token)).toBeNull();
    await logoutAdmin(connection, result.session.token);
    const record = await getSessionModel(connection).collection.findOne({
      _id: new Types.ObjectId(result.session.id),
    });
    expect(record?.revocationReason).toBe("logout");
  });
});
