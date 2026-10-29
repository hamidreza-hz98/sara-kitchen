import "server-only";

import type { Connection } from "mongoose";

import { mapAuditLogListItem } from "../mapper/audit-log";
import { getAuditLogModel } from "../model/audit-log";
import type { AuditLogReadRow } from "../repository/audit-log-read-repository";

/** Safe projection only. The analytics caller enforces logs:read before invoking. */
export async function readDashboardActivity(connection: Connection) {
  const rows = await getAuditLogModel(connection)
    .find(
      {},
      {
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
      },
    )
    .sort({ occurredAt: -1, _id: -1 })

    .limit(8)
    .lean<AuditLogReadRow[]>();
  return rows.map(mapAuditLogListItem);
}
