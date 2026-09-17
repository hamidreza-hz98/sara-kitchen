import { Mongoose, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AUDIT_ACTION_DEFINITIONS,
  getAuditActionDefinition,
  isAuditActionCode,
} from "@/server/modules/logs/types/audit-actions";
import { recordAuditEvent } from "@/server/modules/logs";
import {
  AUDIT_ACTION_CODE_PATTERN,
  isEnglishAuditMessage,
} from "@/server/modules/logs/validation/audit-event";

describe("audit event creation contract", () => {
  it("provides canonical English outcomes for every required activity family", () => {
    expect(Object.keys(AUDIT_ACTION_DEFINITIONS)).toEqual(
      expect.arrayContaining([
        "auth.admin.login",
        "auth.customer.login",
        "security.access.check",
        "security.rate-limit.enforce",
        "crud.resource.create",
        "crud.resource.update",
        "crud.resource.delete",
        "order.order.create",
        "order.order.status-change",
        "payment.transaction.process",
        "settings.section.update",
      ]),
    );
    expect([...new Set(Object.values(AUDIT_ACTION_DEFINITIONS).map(({ type }) => type))]).toEqual(
      expect.arrayContaining(["authentication", "authorization", "business", "data", "security"]),
    );

    for (const [action, definition] of Object.entries(AUDIT_ACTION_DEFINITIONS)) {
      expect(AUDIT_ACTION_CODE_PATTERN.test(action)).toBe(true);
      expect(isAuditActionCode(action)).toBe(true);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.messages)).toBe(true);
      expect(Object.isFrozen(definition.severities)).toBe(true);
      expect(definition.severities).toEqual({
        denied: "warning",
        failure: "error",
        success: "info",
      });
      for (const message of Object.values(definition.messages)) {
        expect(isEnglishAuditMessage(message)).toBe(true);
      }
    }
  });

  it("resolves only catalog actions", () => {
    expect(isAuditActionCode("auth.admin.login")).toBe(true);
    expect(getAuditActionDefinition("auth.admin.login").type).toBe("authentication");
    expect(isAuditActionCode("user.supplied.action")).toBe(false);
  });

  it("rejects an unknown runtime action before attempting persistence", async () => {
    const client = new Mongoose();
    await expect(
      recordAuditEvent(client.connection, {
        action: "user.supplied.action" as never,
        actor: {
          kind: "admin",
          ref: new Types.ObjectId().toHexString(),
          snapshot: { displayName: "Sara Kazemi", role: "owner" },
        },
        network: { ipAddress: null, ipHash: null, policy: "omitted" },
        outcome: "success",
        requestId: "request_catalog_01",
        resource: {
          kind: "dish",
          ref: new Types.ObjectId().toHexString(),
          snapshot: { code: null, label: "Dish", status: "active" },
        },
        userAgent: null,
      }),
    ).rejects.toThrow(/canonical action catalog/u);
  });
});
