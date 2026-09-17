import "server-only";

import { Types } from "mongoose";
import type { Connection, QueryFilter } from "mongoose";

import { AUDIT_LOG_INDEX_NAMES, getAuditLogModel } from "../model/audit-log";
import type { AuditLogRecord } from "../model/audit-log";
import type { AuditActorKind, AuditContext, AuditNetworkPolicy } from "../types/audit-event";
import type { AuditLogReadQuery } from "../validation/audit-log-read";

const SAFE_AUDIT_LOG_PROJECTION = Object.freeze({
  _id: 1,
  actionCode: 1,
  actor: 1,
  context: 1,
  createdAt: 1,
  message: 1,
  "network.policy": 1,
  occurredAt: 1,
  outcome: 1,
  requestId: 1,
  resource: 1,
  severity: 1,
  type: 1,
  userAgent: 1,
} as const);

export type AuditLogReadRow = Readonly<{
  _id: Types.ObjectId;
  actionCode: string;
  actor: Readonly<{
    kind: AuditActorKind;
    ref: Types.ObjectId | null;
    snapshot: Readonly<{ displayName: string | null; role: string | null }>;
  }>;
  context: AuditContext;
  createdAt: Date;
  message: string;
  network: Readonly<{ policy: AuditNetworkPolicy }>;
  occurredAt: Date;
  outcome: AuditLogRecord["outcome"];
  requestId: string;
  resource: Readonly<{
    kind: string;
    ref: string | null;
    snapshot: Readonly<{ code: string | null; label: string | null; status: string | null }>;
  }>;
  severity: AuditLogRecord["severity"];
  type: AuditLogRecord["type"];
  userAgent: string | null;
}>;

export type AuditLogReadPage = Readonly<{
  indexName: (typeof AUDIT_LOG_INDEX_NAMES)[keyof typeof AUDIT_LOG_INDEX_NAMES];
  rows: readonly AuditLogReadRow[];
  totalItems: number;
}>;

export function selectAuditLogReadIndex(query: AuditLogReadQuery): AuditLogReadPage["indexName"] {
  if (query.requestId) return AUDIT_LOG_INDEX_NAMES.request;
  if (query.actorKind) return AUDIT_LOG_INDEX_NAMES.actor;
  if (query.resourceKind) return AUDIT_LOG_INDEX_NAMES.resource;
  if (query.action) return AUDIT_LOG_INDEX_NAMES.action;
  return AUDIT_LOG_INDEX_NAMES.timeline;
}

export function buildAuditLogReadFilter(query: AuditLogReadQuery): QueryFilter<AuditLogRecord> {
  const filter: QueryFilter<AuditLogRecord> = {};
  if (query.action) filter.actionCode = query.action;
  if (query.actorKind) filter["actor.kind"] = query.actorKind;
  if (query.actorRef) filter["actor.ref"] = new Types.ObjectId(query.actorRef);
  if (query.outcome) filter.outcome = query.outcome;
  if (query.requestId) filter.requestId = query.requestId;
  if (query.resourceKind) filter["resource.kind"] = query.resourceKind;
  if (query.resourceRef) filter["resource.ref"] = query.resourceRef;
  if (query.dateFrom || query.dateTo) {
    filter.occurredAt = {
      ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
      ...(query.dateTo ? { $lte: query.dateTo } : {}),
    };
  }
  return filter;
}

export async function findAuditLogPage(
  connection: Connection,
  query: AuditLogReadQuery,
): Promise<AuditLogReadPage> {
  const AuditLog = getAuditLogModel(connection);
  const filter = buildAuditLogReadFilter(query);
  const indexName = selectAuditLogReadIndex(query);
  const skip = (query.page - 1) * query.pageSize;
  const [rows, totalItems] = await Promise.all([
    AuditLog.find(filter, SAFE_AUDIT_LOG_PROJECTION)
      .sort({ occurredAt: -1, _id: -1 })
      .hint(indexName)
      .skip(skip)
      .limit(query.pageSize)
      .lean<AuditLogReadRow[]>()
      .exec(),
    AuditLog.countDocuments(filter).hint(indexName).exec(),
  ]);
  return Object.freeze({ indexName, rows, totalItems });
}
