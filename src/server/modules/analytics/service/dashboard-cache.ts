import "server-only";

import { unstable_cache } from "next/cache";
import type { Connection } from "mongoose";

import { hasAdminPermission } from "@/constants/admin-access";
import {
  DASHBOARD_CACHE_TAG,
  DASHBOARD_REVALIDATE_SECONDS,
  dashboardProjectionKey,
} from "@/server/cache/dashboard-policy";

import {
  getDashboardAggregation,
  type DashboardActor,
  type DashboardAggregationInput,
} from "./dashboard-aggregation";

/** Authorization is checked before cache access, including on a hit. */
export async function getCachedDashboardAggregation(
  connection: Connection,
  actor: DashboardActor,
  input: DashboardAggregationInput = {},
) {
  if (
    !hasAdminPermission(actor, "dashboard:view") ||
    !hasAdminPermission(actor, "analytics:read")
  ) {
    throw new Error("Dashboard analytics access denied.");
  }
  const projection = dashboardProjectionKey({
    activity: hasAdminPermission(actor, "logs:read"),
    customerNames: hasAdminPermission(actor, "customers:read-sensitive"),
    orders: hasAdminPermission(actor, "orders:read"),
    dishes: hasAdminPermission(actor, "dishes:read"),
  });
  // A stable 30-second as-of bucket bounds key cardinality and avoids a unique cache key per request.
  // The finite Next Data Cache TTL is the backstop for mutations outside this deployment.
  const asOf = input.asOf ?? new Date(Math.floor(Date.now() / 30_000) * 30_000);
  const cached = unstable_cache(
    async () => getDashboardAggregation(connection, actor, { ...input, asOf }),
    [
      "sara-kitchen",
      "dashboard",
      projection,
      input.locale ?? "en",
      input.startDate ?? "default",
      input.endDate ?? "default",
      asOf.toISOString(),
    ],
    { revalidate: DASHBOARD_REVALIDATE_SECONDS, tags: [DASHBOARD_CACHE_TAG] },
  );
  return cached();
}
