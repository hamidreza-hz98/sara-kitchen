import type { Connection } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  return {
    values,
    aggregate: vi.fn(async () => ({ freshness: { generatedAt: "2026-10-16T12:00:00.000Z" } })),
    cache: vi.fn(<T>(load: () => Promise<T>, keys: string[], options: unknown) => {
      return async () => {
        const key = JSON.stringify([keys, options]);
        if (!values.has(key)) values.set(key, await load());
        return values.get(key) as T;
      };
    }),
    revalidate: vi.fn(() => values.clear()),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: state.cache,
  revalidateTag: state.revalidate,
}));
vi.mock("@/server/modules/analytics/service/dashboard-aggregation", () => ({
  getDashboardAggregation: state.aggregate,
}));

import { DASHBOARD_CACHE_TAG, dashboardProjectionKey } from "@/server/cache/dashboard-policy";
import { revalidateDashboardFromRoute } from "@/server/cache/dashboard-revalidation";
import { getCachedDashboardAggregation } from "@/server/modules/analytics/service/dashboard-cache";

const database = {} as Connection;
const owner = { id: "admin-a", role: "owner" as const, active: true };
const instant = new Date("2026-10-16T12:00:00.000Z");

describe("dashboard cache", () => {
  beforeEach(() => {
    state.values.clear();
    state.aggregate.mockClear();
    state.cache.mockClear();
    state.revalidate.mockClear();
  });

  it("reuses an exact permission/locale/range projection for 30 seconds", async () => {
    const input = { locale: "en" as const, asOf: instant };
    const first = await getCachedDashboardAggregation(database, owner, input);
    const second = await getCachedDashboardAggregation(database, owner, input);
    expect(second).toBe(first);
    expect(state.aggregate).toHaveBeenCalledTimes(1);
    expect(state.cache.mock.calls[0]?.[2]).toEqual({
      revalidate: 30,
      tags: [DASHBOARD_CACHE_TAG],
    });
    expect(first.freshness.generatedAt).toBe("2026-10-16T12:00:00.000Z");
  });

  it("bounds default as-of keys to one bucket and separates sensitive projections", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(instant.getTime() + 12_000);
    try {
      await getCachedDashboardAggregation(database, owner);
      clock.mockReturnValue(instant.getTime() + 20_000);
      await getCachedDashboardAggregation(database, owner);
      expect(state.aggregate).toHaveBeenCalledOnce();
    } finally {
      clock.mockRestore();
    }
    expect(
      dashboardProjectionKey({ activity: true, customerNames: false, orders: true, dishes: true }),
    ).not.toBe(
      dashboardProjectionKey({ activity: false, customerNames: false, orders: true, dishes: true }),
    );
  });

  it("separates locale and period, and rejects unauthorized actors before cache access", async () => {
    await getCachedDashboardAggregation(database, owner, { locale: "en", asOf: instant });
    await getCachedDashboardAggregation(database, owner, { locale: "fa", asOf: instant });
    await getCachedDashboardAggregation(database, owner, {
      locale: "en",
      asOf: instant,
      startDate: "2026-10-01",
    });
    expect(state.aggregate).toHaveBeenCalledTimes(3);
    await expect(
      getCachedDashboardAggregation(database, { ...owner, role: "viewer" }, { asOf: instant }),
    ).rejects.toThrow("access denied");
    expect(state.cache).toHaveBeenCalledTimes(3);
  });

  it("expires the tagged snapshot after a committed change", async () => {
    await getCachedDashboardAggregation(database, owner, { asOf: instant });
    expect(revalidateDashboardFromRoute()).toBe(true);
    expect(state.revalidate).toHaveBeenCalledWith(DASHBOARD_CACHE_TAG, { expire: 0 });
    await getCachedDashboardAggregation(database, owner, { asOf: instant });
    expect(state.aggregate).toHaveBeenCalledTimes(2);
  });

  it("does not turn a committed write into a retriable error when invalidation fails", () => {
    state.revalidate.mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });
    expect(revalidateDashboardFromRoute()).toBe(false);
  });
});
