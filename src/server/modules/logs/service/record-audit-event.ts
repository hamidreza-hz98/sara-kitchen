import "server-only";

import type { ClientSession, Connection } from "mongoose";

import { createApplicationLogger } from "@/server/observability";

import { insertAuditLog } from "../repository/audit-log-repository";
import {
  getAuditActionDefinition,
  isAuditActionCode,
  type AuditActionCode,
} from "../types/audit-actions";
import type { AuditEventInput } from "../types/audit-event";
import { sanitizeAuditContext } from "../validation/audit-event";

export type RecordAuditEventInput = Omit<
  AuditEventInput,
  "actionCode" | "message" | "severity" | "type"
> & {
  action: AuditActionCode;
};

export type RecordAuditEventOptions = Readonly<{
  session?: ClientSession;
}>;

/** Serializable acknowledgement; the mutable Mongoose document never crosses the module boundary. */
export type RecordedAuditEvent = Readonly<{
  actionCode: AuditActionCode;
  id: string;
  message: string;
  occurredAt: string;
  outcome: RecordAuditEventInput["outcome"];
  severity: AuditEventInput["severity"];
  type: AuditEventInput["type"];
}>;

/** The sole public command for appending an audit event from any domain module. */
export async function recordAuditEvent(
  connection: Connection,
  input: RecordAuditEventInput,
  options: RecordAuditEventOptions = {},
): Promise<RecordedAuditEvent> {
  if (!isAuditActionCode(input.action)) {
    throw new TypeError("Audit action must be selected from the canonical action catalog.");
  }

  const definition = getAuditActionDefinition(input.action);
  const message = definition.messages[input.outcome];
  const severity = definition.severities[input.outcome];
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const event: AuditEventInput = {
    actionCode: input.action,
    actor: input.actor,
    context: sanitizeAuditContext(input.context),
    message,
    network: input.network,
    occurredAt,
    outcome: input.outcome,
    requestId: input.requestId,
    resource: input.resource,
    severity,
    type: definition.type,
    userAgent: input.userAgent,
  };

  try {
    const inserted = await insertAuditLog(connection, event, options);
    return Object.freeze({
      actionCode: input.action,
      id: inserted.id,
      message,
      occurredAt: inserted.occurredAt.toISOString(),
      outcome: input.outcome,
      severity,
      type: definition.type,
    });
  } catch (error) {
    createApplicationLogger({ module: "audit", requestId: input.requestId }).error({
      action: "write.failed",
      context: {
        actionCode: input.action,
        outcome: input.outcome,
        resourceKind: input.resource.kind,
      },
      error,
      message: "Audit event could not be persisted.",
    });
    throw error;
  }
}
