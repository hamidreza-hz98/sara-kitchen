import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { compactSalesChart } from "@/app/[locale]/(dashboard)/dashboard/dashboard-chart";
import { resolveDashboardSelection } from "@/app/[locale]/(dashboard)/dashboard/dashboard-view-model";

const now = new Date("2026-10-16T12:00:00.000Z");

describe("dashboard overview view model", () => {
  it("maps presets to bounded Lisbon calendar ranges", () => {
    expect(resolveDashboardSelection({}, now)).toMatchObject({
      range: "month",
      startDate: "2026-09-17",
      endDate: "2026-10-16",
      valid: true,
    });
    expect(resolveDashboardSelection({ range: "week" }, now)).toMatchObject({
      startDate: "2026-10-10",
      endDate: "2026-10-16",
      valid: true,
    });
    expect(resolveDashboardSelection({ range: "year" }, now).valid).toBe(true);
  });

  it("rejects malformed, reversed, future, and oversized custom ranges", () => {
    for (const query of [
      { range: "custom" },
      { range: "custom", start: "2026-10-17", end: "2026-10-18" },
      { range: "custom", start: "2026-10-16", end: "2026-10-15" },
      { range: "custom", start: "2024-01-01", end: "2026-10-16" },
      { range: "custom", start: "not-a-date", end: "2026-10-16" },
    ]) {
      expect(resolveDashboardSelection(query, now).valid).toBe(false);
    }
  });

  it("compacts bars without changing gross, refunds, or net totals", () => {
    const input = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, "0")}`,
      grossCents: index * 100,
      refundsCents: index * 10,
      netCents: index * 90,
    }));
    const output = compactSalesChart(input);
    expect(output.length).toBeLessThanOrEqual(12);
    for (const field of ["grossCents", "refundsCents", "netCents"] as const) {
      expect(output.reduce((sum, item) => sum + item[field], 0)).toBe(
        input.reduce((sum, item) => sum + item[field], 0),
      );
    }
    expect(output[0]).toMatchObject({ date: "2026-10-01", endDate: "2026-10-03" });
  });
});
