import "server-only";

import { revalidateTag } from "next/cache";
import { createApplicationLogger } from "@/server/observability";

import { DASHBOARD_CACHE_TAG } from "./dashboard-policy";

/** Invoke after a durable order/payment mutation, never inside a MongoDB transaction. */
export function revalidateDashboardFromRoute(): boolean {
  try {
    revalidateTag(DASHBOARD_CACHE_TAG, { expire: 0 });
    return true;
  } catch {
    // The write has already committed. Do not invite a duplicate client retry;
    // the finite cache lifetime remains the freshness backstop.
    createApplicationLogger({ module: "dashboard-cache" }).warn({
      action: "dashboard.cache.invalidate-failed",
      message: "Dashboard cache invalidation failed; finite TTL remains the fallback.",
    });
    return false;
  }
}
