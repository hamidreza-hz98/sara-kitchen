import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUDIT_LOG_APPEND_ONLY_ERROR,
  AUDIT_LOG_RETENTION_MS,
  getAuditLogModel,
} from "@/server/modules/logs/model/audit-log";

import { startTestMongoDatabase, type TestMongoDatabase } from "../helpers/mongodb";

describe("persisted audit log", () => {
  let database: TestMongoDatabase | undefined;
  let client: Mongoose | undefined;

  beforeAll(async () => {
    database = await startTestMongoDatabase("sara-kitchen-audit-log-test");
    client = new Mongoose();
    await client.connect(database.uri);
  }, 120_000);

  afterAll(async () => {
    if (client?.connection.readyState !== 0) await client?.disconnect();
    await database?.stop();
  });

  function event(actorKind: "admin" | "customer") {
    const actorId = new Types.ObjectId();
    const occurredAt = new Date("2026-09-17T12:00:00.000Z");
    return {
      actorId,
      occurredAt,
      value: {
        actionCode: `auth.${actorKind}.login`,
        message: `${actorKind === "admin" ? "Administrator" : "Customer"} signed in successfully.`,
        actor: {
          kind: actorKind,
          ref: actorId,
          snapshot: {
            displayName: actorKind === "admin" ? "Sara Kazemi" : "Customer",
            role: actorKind === "admin" ? "owner" : null,
          },
        },
        resource: {
          kind: "session",
          ref: new Types.ObjectId().toHexString(),
          snapshot: { code: null, label: "Session", status: "active" },
        },
        outcome: "success",
        severity: "info",
        type: "authentication",
        requestId: `request_${new Types.ObjectId().toHexString()}`,
        context: { method: "POST", statusCode: 200 },
        network: { policy: "hashed", ipHash: "c".repeat(64), ipAddress: null },
        userAgent: "Integration test browser",
        occurredAt,
      },
    } as const;
  }

  it("persists sanitized admin and customer events with indexes and retention", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const AuditLog = getAuditLogModel(client.connection);
    await AuditLog.syncIndexes();

    for (const actorKind of ["admin", "customer"] as const) {
      const input = event(actorKind);
      const created = await AuditLog.create(input.value);
      const stored = await AuditLog.collection.findOne({ _id: created._id });
      expect(stored?.actor.kind).toBe(actorKind);
      expect(stored?.actor.ref.toHexString()).toBe(input.actorId.toHexString());
      expect(stored?.message).toMatch(/signed in successfully/u);
      expect(stored?.context).toEqual({ method: "POST", statusCode: 200 });
      expect(stored?.expiresAt.getTime() - stored?.occurredAt.getTime()).toBe(
        AUDIT_LOG_RETENTION_MS,
      );
      expect(JSON.stringify(stored)).not.toMatch(
        /password|bearer|authorization|cookie|paymentSecret|messageBody/iu,
      );
    }

    expect(await AuditLog.collection.indexes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
        expect.objectContaining({ key: { "actor.kind": 1, "actor.ref": 1, occurredAt: -1 } }),
      ]),
    );
  });

  it("rejects document, query, delete, and bulk mutation paths", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const AuditLog = getAuditLogModel(client.connection);
    const created = await AuditLog.create(event("admin").value);

    created.message = "A changed audit message.";
    await expect(created.save()).rejects.toThrow(AUDIT_LOG_APPEND_ONLY_ERROR);
    await expect(
      AuditLog.updateOne({ _id: created._id }, { $set: { severity: "error" } }),
    ).rejects.toThrow(AUDIT_LOG_APPEND_ONLY_ERROR);
    await expect(AuditLog.deleteOne({ _id: created._id })).rejects.toThrow(
      AUDIT_LOG_APPEND_ONLY_ERROR,
    );
    await expect(created.deleteOne()).rejects.toThrow(AUDIT_LOG_APPEND_ONLY_ERROR);
    await expect(
      AuditLog.bulkWrite([{ deleteOne: { filter: { _id: created._id } } }]),
    ).rejects.toThrow(AUDIT_LOG_APPEND_ONLY_ERROR);
    expect(await AuditLog.countDocuments({ _id: created._id })).toBe(1);
  });
});
