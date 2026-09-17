import "server-only";

import type { Connection } from "mongoose";

import { pageResult, type PageMetadata } from "@/server/database/query-controls";

import { mapAuditLogListItem, type AuditLogListItem } from "../mapper/audit-log";
import {
  requireAuditLogReadPermission,
  type AuditLogReadPrincipal,
} from "../policy/audit-log-read";
import { findAuditLogPage } from "../repository/audit-log-read-repository";
import type { AuditLogReadQuery } from "../validation/audit-log-read";
import { parseAuditLogReadQuery } from "../validation/audit-log-read";
import type { RecordAuditEventInput } from "./record-audit-event";
import { recordAuditEvent } from "./record-audit-event";

export type AuditLogReadRequestContext = Readonly<
  Pick<RecordAuditEventInput, "network" | "requestId" | "userAgent">
>;

export type AuditLogListResult = Readonly<{
  data: readonly AuditLogListItem[];
  meta: PageMetadata;
}>;

function auditReadEvent(
  principal: AuditLogReadPrincipal,
  request: AuditLogReadRequestContext,
  outcome: "success" | "failure",
  context: Readonly<Record<string, boolean | number | string | null>>,
): RecordAuditEventInput {
  return {
    action: "security.audit-log.read",
    actor: {
      kind: "admin",
      ref: principal.id,
      snapshot: { displayName: principal.displayName, role: principal.role },
    },
    context,
    network: request.network,
    outcome,
    requestId: request.requestId,
    resource: {
      kind: "audit-log",
      ref: null,
      snapshot: { code: null, label: "Audit log", status: null },
    },
    userAgent: request.userAgent,
  };
}

/** Authorized, validated, safe-projection audit timeline read. */
export async function readAuditLogs(
  connection: Connection,
  principal: AuditLogReadPrincipal,
  request: AuditLogReadRequestContext,
  input: unknown,
): Promise<AuditLogListResult> {
  requireAuditLogReadPermission(principal);

  let query: AuditLogReadQuery;
  try {
    query = parseAuditLogReadQuery(input);
  } catch (error) {
    await recordAuditEvent(
      connection,
      auditReadEvent(principal, request, "failure", { stage: "validation" }),
    ).catch(() => undefined);
    throw error;
  }

  try {
    const page = await findAuditLogPage(connection, query);
    const items = page.rows.map(mapAuditLogListItem);
    await recordAuditEvent(
      connection,
      auditReadEvent(principal, request, "success", {
        filterCount: [
          query.action,
          query.actorKind,
          query.actorRef,
          query.dateFrom,
          query.dateTo,
          query.outcome,
          query.requestId,
          query.resourceKind,
          query.resourceRef,
        ].filter((value) => value !== undefined).length,
        page: query.page,
        pageSize: query.pageSize,
        resultCount: items.length,
      }),
    );
    const result = pageResult(items, page.totalItems, {
      filter: {},
      limit: query.pageSize,
      page: query.page,
      pageSize: query.pageSize,
      projection: {},
      skip: (query.page - 1) * query.pageSize,
      sort: { occurredAt: -1 },
      sortBy: "occurredAt",
      sortDirection: "desc",
    });
    return Object.freeze({ data: Object.freeze([...result.data]), meta: result.meta });
  } catch (error) {
    await recordAuditEvent(
      connection,
      auditReadEvent(principal, request, "failure", { stage: "query" }),
    ).catch(() => undefined);
    throw error;
  }
}
