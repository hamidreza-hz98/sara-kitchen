import { resolveDashboardPeriods } from "@/server/modules/analytics";

export type DashboardRange = "day" | "week" | "month" | "year" | "custom";
export type DashboardOrderTab = "all" | "awaiting" | "active" | "completed";

const RANGES: readonly DashboardRange[] = ["day", "week", "month", "year", "custom"];
const ORDER_TABS: readonly DashboardOrderTab[] = ["all", "awaiting", "active", "completed"];

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function lisbonDay(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, difference: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + difference);
  return date.toISOString().slice(0, 10);
}

export function resolveDashboardSelection(
  query: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
) {
  const requestedRange = single(query.range) ?? "month";
  const requestedTab = single(query.orders) ?? "all";
  const range = RANGES.find((item) => item === requestedRange) ?? "month";
  const orderTab = ORDER_TABS.find((item) => item === requestedTab) ?? "all";
  const today = lisbonDay(now);
  const startDate =
    range === "custom"
      ? single(query.start)
      : addDays(today, range === "day" ? 0 : range === "week" ? -6 : range === "year" ? -364 : -29);
  const endDate = range === "custom" ? single(query.end) : today;
  if (!startDate || !endDate) return { range, orderTab, startDate: "", endDate: "", valid: false };
  try {
    resolveDashboardPeriods({ startDate, endDate, asOf: now });
    return { range, orderTab, startDate, endDate, valid: true };
  } catch {
    return { range, orderTab, startDate, endDate, valid: false };
  }
}
