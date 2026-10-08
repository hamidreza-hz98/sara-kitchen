import { Mongoose } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminCrudServices, createAdminRepository } from "@/server/modules/admins";
import { getAdminModel } from "@/server/modules/admins/model/admin";
import {
  hashAdminPassword,
  verifyAdminPasswordForLogin,
} from "@/server/modules/admins/service/password";
import { issueSession, resolveSession, revokeActorSessions } from "@/server/modules/sessions";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted administrator lifecycle", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;
  let ownerId = "";

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-admin-crud-test");
    client = new Mongoose();
    await client.connect(database.uri);
    const Admin = getAdminModel(client.connection);
    await Admin.syncIndexes();
    const owner = await Admin.create({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "owner@example.com",
      role: "owner",
      passwordHash: await hashAdminPassword("Owner password for integration 2026"),
    });
    ownerId = owner._id.toHexString();
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  it("enforces normalized uniqueness through the repository service", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const audit = vi.fn(async () => undefined);
    const service = createAdminCrudServices({
      repository: createAdminRepository(connection),
      audit,
      revokeSessions: async (adminId, reason) =>
        revokeActorSessions(connection, "admin", adminId, reason),
    });
    const actor = { id: ownerId, role: "owner" as const };
    const input = {
      firstName: "Kitchen",
      lastName: "Manager",
      identifier: "MANAGER@EXAMPLE.COM",
      role: "manager" as const,
      password: "Manager password for integration 2026",
    };
    const created = await service.create(actor, input);
    expect(created.identifier).toBe("manager@example.com");
    await expect(
      service.create(actor, { ...input, identifier: " manager@example.com " }),
    ).rejects.toMatchObject({ name: "AdminRepositoryConflictError" });
    expect(audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "create", outcome: "failure" }),
    );
  });

  it("rotates the password version and revokes every session on credential reset", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const connection = client.connection;
    const service = createAdminCrudServices({
      repository: createAdminRepository(connection),
      audit: async () => undefined,
      revokeSessions: (adminId, reason) =>
        revokeActorSessions(connection, "admin", adminId, reason),
    });
    const actor = { id: ownerId, role: "owner" as const };
    const target = await service.create(actor, {
      firstName: "Order",
      lastName: "Operator",
      identifier: "operator@example.com",
      role: "order_operator",
      password: "Original operator password 2026",
    });
    const issued = await issueSession(connection, {
      actorKind: "admin",
      actorId: target.id,
      passwordVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.resetCredential(actor, target.id, "Replacement operator password 2026");

    expect(await resolveSession(connection, issued.token, "admin")).toBeNull();
    expect(
      await verifyAdminPasswordForLogin(connection, target.id, "Original operator password 2026"),
    ).toBe(false);
    expect(
      await verifyAdminPasswordForLogin(
        connection,
        target.id,
        "Replacement operator password 2026",
      ),
    ).toBe(true);
    const stored = await getAdminModel(connection).findById(target.id).lean().exec();
    expect(stored?.passwordVersion).toBe(2);
  });
});
