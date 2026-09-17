import { Mongoose, Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUDIT_LOG_APPEND_ONLY_ERROR,
  AUDIT_LOG_RETENTION_MS,
  getAuditLogModel,
} from "@/server/modules/logs/model/audit-log";
import { recordAuditEvent } from "@/server/modules/logs";
import { readAuditLogs, AuditLogReadForbiddenError } from "@/server/modules/logs";
import { permissionsForRole } from "@/constants/admin-access";
import {
  buildAuditLogReadFilter,
  selectAuditLogReadIndex,
} from "@/server/modules/logs/repository/audit-log-read-repository";
import { parseAuditLogReadQuery } from "@/server/modules/logs/validation/audit-log-read";

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
        expect.objectContaining({
          key: { "actor.kind": 1, "actor.ref": 1, occurredAt: -1, _id: -1 },
        }),
      ]),
    );
  });

  it("creates canonical successful CRUD and failed payment events through one public command", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const AuditLog = getAuditLogModel(client.connection);
    const actorId = new Types.ObjectId();
    const dishId = new Types.ObjectId().toHexString();

    const createdReceipt = await recordAuditEvent(client.connection, {
      action: "crud.resource.create",
      actor: {
        kind: "admin",
        ref: actorId.toHexString(),
        snapshot: { displayName: "Sara Kazemi", role: "owner" },
      },
      context: { statusCode: 201 },
      network: { ipAddress: null, ipHash: "d".repeat(64), policy: "hashed" },
      occurredAt: new Date("2026-09-17T18:00:00.000Z"),
      outcome: "success",
      requestId: "request.crud:0001",
      resource: {
        kind: "dish",
        ref: dishId,
        snapshot: { code: null, label: "Fesenjan", status: "active" },
      },
      userAgent: "Integration test browser",
    });
    const failedReceipt = await recordAuditEvent(client.connection, {
      action: "payment.transaction.process",
      actor: {
        kind: "customer",
        ref: new Types.ObjectId().toHexString(),
        snapshot: { displayName: "Customer", role: null },
      },
      context: { provider: "mbway", statusCode: 502 },
      network: { ipAddress: null, ipHash: null, policy: "omitted" },
      occurredAt: new Date("2026-09-17T18:01:00.000Z"),
      outcome: "failure",
      requestId: "request.payment:0002",
      resource: {
        kind: "transaction",
        ref: new Types.ObjectId().toHexString(),
        snapshot: { code: "TX-1002", label: "MB Way payment", status: "failed" },
      },
      userAgent: null,
    });

    expect(Object.isFrozen(createdReceipt)).toBe(true);
    expect(createdReceipt).toMatchObject({
      actionCode: "crud.resource.create",
      message: "Resource was created successfully.",
      occurredAt: "2026-09-17T18:00:00.000Z",
      outcome: "success",
      severity: "info",
      type: "data",
    });
    expect(failedReceipt).toMatchObject({
      actionCode: "payment.transaction.process",
      message: "Payment processing failed.",
      outcome: "failure",
      severity: "error",
      type: "business",
    });

    const storedSuccess = await AuditLog.findById(createdReceipt.id).exec();
    const storedFailure = await AuditLog.findById(failedReceipt.id).exec();
    expect(storedSuccess).toMatchObject({
      actionCode: createdReceipt.actionCode,
      message: createdReceipt.message,
      outcome: "success",
      severity: "info",
      type: "data",
    });
    expect(storedFailure).toMatchObject({
      actionCode: failedReceipt.actionCode,
      message: failedReceipt.message,
      outcome: "failure",
      severity: "error",
      type: "business",
    });

    if (!storedSuccess) throw new Error("Created audit record was not found.");
    storedSuccess.message = "Attempted mutation.";
    await expect(storedSuccess.save()).rejects.toThrow(AUDIT_LOG_APPEND_ONLY_ERROR);
  });

  it("authorizes, filters, paginates, safely projects, audits, and uses named indexes", async () => {
    if (!client) throw new Error("Test MongoDB did not start.");
    const AuditLog = getAuditLogModel(client.connection);
    const actorId = new Types.ObjectId();
    const resourceRef = new Types.ObjectId().toHexString();
    const principal = {
      active: true as const,
      displayName: "Sara Kazemi",
      id: actorId.toHexString(),
      kind: "admin" as const,
      permissions: permissionsForRole("owner"),
      role: "owner",
    };
    const request = {
      network: { ipAddress: null, ipHash: null, policy: "omitted" as const },
      requestId: "request.audit-read:01",
      userAgent: "Integration test browser",
    };

    for (const [minute, outcome] of [
      [10, "success"],
      [11, "failure"],
    ] as const) {
      await recordAuditEvent(client.connection, {
        action: "crud.resource.update",
        actor: {
          kind: "admin",
          ref: actorId.toHexString(),
          snapshot: { displayName: "Sara Kazemi", role: "owner" },
        },
        context: { statusCode: outcome === "success" ? 200 : 500 },
        network: { ipAddress: null, ipHash: "e".repeat(64), policy: "hashed" },
        occurredAt: new Date(`2026-09-17T18:${minute}:00.000Z`),
        outcome,
        requestId: `request.audit-filter:${minute}`,
        resource: {
          kind: "dish",
          ref: resourceRef,
          snapshot: { code: null, label: "Fesenjan", status: "active" },
        },
        userAgent: "Seed browser",
      });
    }

    await expect(
      readAuditLogs(
        client.connection,
        { ...principal, permissions: permissionsForRole("viewer"), role: "viewer" },
        request,
        {},
      ),
    ).rejects.toThrow(AuditLogReadForbiddenError);

    const result = await readAuditLogs(client.connection, principal, request, {
      action: "crud.resource.update",
      actorKind: "admin",
      actorRef: actorId.toHexString(),
      dateFrom: "2026-09-17T18:00:00.000Z",
      dateTo: "2026-09-17T18:30:00.000Z",
      outcome: "success",
      page: 1,
      pageSize: 1,
      requestId: "request.audit-filter:10",
      resourceKind: "dish",
      resourceRef,
    });

    expect(result.meta.pagination).toMatchObject({ page: 1, pageSize: 1, totalItems: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      actionCode: "crud.resource.update",
      networkPolicy: "hashed",
      outcome: "success",
      requestId: "request.audit-filter:10",
    });
    expect(JSON.stringify(result.data[0])).not.toMatch(/ipHash|ipAddress|expiresAt/iu);
    expect(
      await AuditLog.countDocuments({ actionCode: "security.audit-log.read", outcome: "success" }),
    ).toBeGreaterThanOrEqual(1);

    const explainInputs = [
      { dateFrom: "2026-09-17T18:00:00.000Z" },
      { actorKind: "admin", actorRef: actorId.toHexString() },
      { action: "crud.resource.update", outcome: "success" },
      { resourceKind: "dish", resourceRef },
      { requestId: "request.audit-filter:10" },
    ] as const;
    for (const input of explainInputs) {
      const query = parseAuditLogReadQuery(input);
      const indexName = selectAuditLogReadIndex(query);
      const explanation = await AuditLog.find(buildAuditLogReadFilter(query))
        .sort({ occurredAt: -1, _id: -1 })
        .hint(indexName)
        .explain("queryPlanner");
      const serialized = JSON.stringify(explanation);
      expect(serialized).toContain(`\"indexName\":\"${indexName}\"`);
      expect(serialized).toContain("IXSCAN");
      expect(serialized).not.toContain("COLLSCAN");
    }
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
