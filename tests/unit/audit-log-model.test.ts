import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AUDIT_LOG_RETENTION_MS, getAuditLogModel } from "@/server/modules/logs/model/audit-log";
import {
  hashAuditIpAddress,
  sanitizeAuditContext,
} from "@/server/modules/logs/validation/audit-event";

describe("audit log schema", () => {
  const client = new Mongoose();
  const AuditLog = getAuditLogModel(client.connection);

  function validEvent() {
    return new AuditLog({
      actionCode: "auth.admin.login",
      message: "Administrator signed in successfully.",
      actor: {
        kind: "admin",
        ref: new Types.ObjectId(),
        snapshot: { displayName: "Sara Kazemi", role: "owner" },
      },
      resource: {
        kind: "session",
        ref: new Types.ObjectId().toHexString(),
        snapshot: { code: null, label: "Admin session", status: "active" },
      },
      outcome: "success",
      severity: "info",
      type: "authentication",
      requestId: "request_01J8Y3R6M5TQ2W9K",
      context: { method: "POST", statusCode: 200 },
      network: {
        policy: "hashed",
        ipHash: "a".repeat(64),
        ipAddress: null,
      },
      userAgent: "Sara Kitchen test browser",
      occurredAt: new Date("2026-09-17T12:00:00.000Z"),
    });
  }

  it("supports immutable admin and customer actor snapshots with fixed retention", async () => {
    const adminEvent = validEvent();
    await expect(adminEvent.validate()).resolves.toBeUndefined();
    expect(adminEvent.expiresAt.getTime() - adminEvent.occurredAt.getTime()).toBe(
      AUDIT_LOG_RETENTION_MS,
    );

    const customerEvent = validEvent();
    customerEvent.actor = {
      kind: "customer",
      ref: new Types.ObjectId(),
      snapshot: { displayName: "مشتری", role: null },
    };
    customerEvent.actionCode = "profile.customer.updated";
    customerEvent.message = "Customer profile was updated.";
    customerEvent.type = "data";
    await expect(customerEvent.validate()).resolves.toBeUndefined();
  });

  it("rejects actor, network, timestamp, language, and user-agent violations", async () => {
    const event = validEvent();
    event.actor = {
      kind: "anonymous",
      ref: new Types.ObjectId(),
      snapshot: { displayName: null, role: null },
    };
    event.network = { policy: "omitted", ipHash: "b".repeat(64), ipAddress: null };
    event.message = "ورود مدیر موفق بود";
    event.userAgent = "browser\ninjection";
    event.occurredAt = new Date(Date.now() + 10 * 60_000);

    const error = (await event.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["actor.ref", "network", "message", "userAgent", "occurredAt"]),
    );
  });

  it("rejects sensitive, nested, secret-like, and message-body context", async () => {
    for (const context of [
      { password: "not-allowed" },
      { contactMessage: "full customer message" },
      { metadata: { nested: true } },
      { authorizationHeader: "Bearer abc.def.ghi" },
      { paymentReference: "4111 1111 1111 1111" },
    ]) {
      const event = validEvent();
      event.context = context as never;
      await expect(event.validate()).rejects.toThrow(/Audit context/u);
    }
    expect(() => sanitizeAuditContext({ token: "secret" })).toThrow(/prohibited/u);
    expect(sanitizeAuditContext({ method: "POST", statusCode: 201 })).toEqual({
      method: "POST",
      statusCode: 201,
    });
  });

  it("creates stable keyed IP correlation without accepting weak keys or invalid IPs", () => {
    const secret = "unit-test-key-material-with-at-least-thirty-two-bytes";
    const first = hashAuditIpAddress("2001:db8::1", secret);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashAuditIpAddress("2001:db8::1", secret)).toBe(first);
    expect(hashAuditIpAddress("2001:db8::2", secret)).not.toBe(first);
    expect(() => hashAuditIpAddress("invalid", secret)).toThrow(/valid IP/u);
    expect(() => hashAuditIpAddress("127.0.0.1", "short")).toThrow(/32 bytes/u);
  });

  it("indexes timeline filters and TTL while hiding network and expiry metadata", async () => {
    const event = validEvent();
    await event.validate();
    const json = event.toJSON() as Record<string, unknown>;
    expect(json.expiresAt).toBeUndefined();
    expect(json.network).toEqual({ policy: "hashed" });
    expect(AuditLog.schema.path("network.ipHash").options.select).toBe(false);
    expect(AuditLog.schema.path("network.ipAddress").options.select).toBe(false);
    expect(AuditLog.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ occurredAt: -1 }, expect.any(Object)],
        [{ "actor.kind": 1, "actor.ref": 1, occurredAt: -1 }, expect.any(Object)],
        [{ "resource.kind": 1, "resource.ref": 1, occurredAt: -1 }, expect.any(Object)],
        [{ requestId: 1 }, expect.any(Object)],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});
