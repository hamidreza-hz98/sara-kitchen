import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { permissionsForRole } from "@/constants/admin-access";
import { mapAuditLogListItem } from "@/server/modules/logs/mapper/audit-log";
import {
  AuditLogReadForbiddenError,
  requireAuditLogReadPermission,
} from "@/server/modules/logs/policy/audit-log-read";
import {
  buildAuditLogReadFilter,
  selectAuditLogReadIndex,
  type AuditLogReadRow,
} from "@/server/modules/logs/repository/audit-log-read-repository";
import { parseAuditLogReadQuery } from "@/server/modules/logs/validation/audit-log-read";

describe("audit-log reads", () => {
  const adminId = new Types.ObjectId().toHexString();

  it("allows only an authenticated admin principal with logs:read", () => {
    expect(() =>
      requireAuditLogReadPermission({
        active: true,
        displayName: "Sara Kazemi",
        id: adminId,
        kind: "admin",
        permissions: permissionsForRole("owner"),
        role: "owner",
      }),
    ).not.toThrow();
    expect(() =>
      requireAuditLogReadPermission({
        active: true,
        displayName: "Read-only administrator",
        id: adminId,
        kind: "admin",
        permissions: permissionsForRole("viewer"),
        role: "viewer",
      }),
    ).toThrow(AuditLogReadForbiddenError);
    expect(() =>
      requireAuditLogReadPermission({
        active: true,
        displayName: "Forged administrator",
        id: "invalid",
        kind: "admin",
        permissions: ["logs:read"],
        role: "owner",
      }),
    ).toThrow(AuditLogReadForbiddenError);
    expect(() =>
      requireAuditLogReadPermission({
        active: false,
        displayName: "Disabled administrator",
        id: adminId,
        kind: "admin",
        permissions: ["logs:read"],
        role: "owner",
      } as never),
    ).toThrow(AuditLogReadForbiddenError);
    expect(() =>
      requireAuditLogReadPermission({
        active: true,
        displayName: "Customer",
        id: adminId,
        kind: "customer",
        permissions: ["logs:read"],
        role: "owner",
      } as never),
    ).toThrow(AuditLogReadForbiddenError);
  });

  it("validates every filter and creates bounded pagination defaults", () => {
    const actorRef = new Types.ObjectId().toHexString();
    const query = parseAuditLogReadQuery({
      action: "crud.resource.update",
      actorKind: "admin",
      actorRef,
      dateFrom: "2026-09-01T00:00:00.000Z",
      dateTo: "2026-09-18T00:00:00.000Z",
      outcome: "success",
      requestId: "request.read:0001",
      resourceKind: "dish",
      resourceRef: "dish-1",
    });

    expect(query).toMatchObject({ actorRef, page: 1, pageSize: 25 });
    expect(query.dateFrom).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(query.dateTo).toEqual(new Date("2026-09-18T00:00:00.000Z"));
    expect(buildAuditLogReadFilter(query)).toEqual({
      actionCode: "crud.resource.update",
      "actor.kind": "admin",
      "actor.ref": new Types.ObjectId(actorRef),
      occurredAt: { $gte: query.dateFrom, $lte: query.dateTo },
      outcome: "success",
      requestId: "request.read:0001",
      "resource.kind": "dish",
      "resource.ref": "dish-1",
    });
  });

  it.each([
    [{ actorRef: new Types.ObjectId().toHexString() }, /actorRef requires/u],
    [{ resourceRef: "dish-1" }, /resourceRef requires/u],
    [{ dateFrom: "2026-09-18T00:00:00.000Z", dateTo: "2026-09-01T00:00:00.000Z" }, /dateFrom/u],
    [{ page: 101, pageSize: 100 }, /Pagination/u],
    [{ action: "user.supplied.action" }, /Invalid option/u],
  ])("rejects malformed or expensive filter input %#", (input, message) => {
    expect(() => parseAuditLogReadQuery(input)).toThrow(message);
  });

  it("selects an index whose prefix matches the most selective filter family", () => {
    const actorRef = new Types.ObjectId().toHexString();
    expect(selectAuditLogReadIndex(parseAuditLogReadQuery({ requestId: "request-1" }))).toBe(
      "audit_logs_request",
    );
    expect(selectAuditLogReadIndex(parseAuditLogReadQuery({ actorKind: "admin", actorRef }))).toBe(
      "audit_logs_actor_timeline",
    );
    expect(selectAuditLogReadIndex(parseAuditLogReadQuery({ resourceKind: "dish" }))).toBe(
      "audit_logs_resource_timeline",
    );
    expect(
      selectAuditLogReadIndex(parseAuditLogReadQuery({ action: "crud.resource.create" })),
    ).toBe("audit_logs_action_outcome");
    expect(selectAuditLogReadIndex(parseAuditLogReadQuery({}))).toBe("audit_logs_timeline");
  });

  it("maps only the safe projection to an immutable serializable DTO", () => {
    const row: AuditLogReadRow = {
      _id: new Types.ObjectId(),
      actionCode: "crud.resource.create",
      actor: {
        kind: "admin",
        ref: new Types.ObjectId(),
        snapshot: { displayName: "Sara Kazemi", role: "owner" },
      },
      context: { statusCode: 201 },
      createdAt: new Date("2026-09-17T18:00:01.000Z"),
      message: "Resource was created successfully.",
      network: { policy: "hashed" },
      occurredAt: new Date("2026-09-17T18:00:00.000Z"),
      outcome: "success",
      requestId: "request-1",
      resource: {
        kind: "dish",
        ref: "dish-1",
        snapshot: { code: null, label: "Fesenjan", status: "active" },
      },
      severity: "info",
      type: "data",
      userAgent: "Test browser",
    };
    const item = mapAuditLogListItem(row);

    expect(Object.isFrozen(item)).toBe(true);
    expect(item.networkPolicy).toBe("hashed");
    expect(item.occurredAt).toBe("2026-09-17T18:00:00.000Z");
    expect(item).not.toHaveProperty("network.ipHash");
    expect(item).not.toHaveProperty("network.ipAddress");
    expect(item).not.toHaveProperty("expiresAt");
  });
});
