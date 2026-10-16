import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DASHBOARD_CURRENCY,
  DASHBOARD_METRIC_DEFINITIONS,
  DASHBOARD_METRIC_IDS,
  DASHBOARD_ORDER_STATUS_GROUPS,
  DASHBOARD_TIME_ZONE,
  DASHBOARD_VIEW_DEDUPLICATION_HOURS,
} from "@/server/modules/analytics";
import { ORDER_STATUSES } from "@/server/modules/orders";

describe("dashboard metric contract", () => {
  it("uses Lisbon calendar time, EUR cents, and the privacy-safe view window", () => {
    expect(DASHBOARD_TIME_ZONE).toBe("Europe/Lisbon");
    expect(DASHBOARD_CURRENCY).toBe("EUR");
    expect(DASHBOARD_VIEW_DEDUPLICATION_HOURS).toBe(6);
  });

  it("defines every metric once with a nonempty formula and explicit time basis", () => {
    expect(Object.keys(DASHBOARD_METRIC_DEFINITIONS).sort()).toEqual(
      [...DASHBOARD_METRIC_IDS].sort(),
    );
    expect(new Set(DASHBOARD_METRIC_IDS).size).toBe(DASHBOARD_METRIC_IDS.length);
    for (const definition of Object.values(DASHBOARD_METRIC_DEFINITIONS)) {
      expect(definition.formula.length).toBeGreaterThan(10);
      expect(["event", "created", "as-of"]).toContain(definition.timeBasis);
    }
  });

  it("partitions every current order into exactly one operational status tab", () => {
    const grouped = Object.values(DASHBOARD_ORDER_STATUS_GROUPS).flat();
    expect(grouped.sort()).toEqual([...ORDER_STATUSES].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("keeps gross, refunds, and net formulas explicit", () => {
    expect(DASHBOARD_METRIC_DEFINITIONS.grossSalesCents.formula).toContain("capture");
    expect(DASHBOARD_METRIC_DEFINITIONS.refundsCents.formula).toContain("refund");
    expect(DASHBOARD_METRIC_DEFINITIONS.netSalesCents.formula).toBe(
      "grossSalesCents - refundsCents",
    );
  });
});
