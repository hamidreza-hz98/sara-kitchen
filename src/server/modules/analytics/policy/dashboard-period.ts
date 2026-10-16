import { DASHBOARD_TIME_ZONE } from "./dashboard-metrics";

export type DashboardPeriod = Readonly<{ start: Date; end: Date }>;
export type DashboardPeriodInput = Readonly<{
  startDate?: string;
  endDate?: string;
  asOf?: Date;
}>;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date) {
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function dateString(date: Date): string {
  const value = parts(date);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Resolve Lisbon midnight, including 23/25-hour DST days. */
function midnight(day: string): Date {
  const guess = Date.parse(`${day}T00:00:00.000Z`);
  let instant = guess;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = parts(new Date(instant));
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    instant += guess - localAsUtc;
  }
  if (dateString(new Date(instant)) !== day) throw new RangeError("Invalid Lisbon date.");
  return new Date(instant);
}

export function resolveDashboardPeriods(input: DashboardPeriodInput = {}) {
  const asOf = input.asOf ?? new Date();
  if (!Number.isFinite(asOf.getTime())) throw new RangeError("Invalid dashboard as-of time.");
  const today = dateString(asOf);
  const startDate = input.startDate ?? addDays(today, -29);
  const endDate = input.endDate ?? today;
  for (const day of [startDate, endDate]) {
    if (!DATE.test(day) || new Date(`${day}T12:00:00.000Z`).toISOString().slice(0, 10) !== day)
      throw new RangeError("Dashboard dates must be valid YYYY-MM-DD values.");
  }
  const days =
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  if (days < 1 || days > 366 || endDate > today)
    throw new RangeError("Dashboard range must contain 1 to 366 completed or current days.");
  const start = midnight(startDate);
  const selectedEnd = midnight(addDays(endDate, 1));
  const end = selectedEnd < asOf ? selectedEnd : asOf;
  const comparisonStartDate = addDays(startDate, -days);
  const comparisonStart = midnight(comparisonStartDate);
  const cutoff = parts(end);
  const cutoffMilliseconds = end.getUTCMilliseconds();
  const comparisonEnd =
    end.getTime() === selectedEnd.getTime()
      ? start
      : (() => {
          const comparisonEndDate = addDays(startDate, -1);
          const localTarget =
            Date.parse(`${comparisonEndDate}T00:00:00.000Z`) +
            ((cutoff.hour * 60 + cutoff.minute) * 60 + cutoff.second) * 1_000 +
            cutoffMilliseconds;
          let instant = localTarget;
          for (let attempt = 0; attempt < 3; attempt++) {
            const local = parts(new Date(instant));
            const localAsUtc = Date.UTC(
              local.year,
              local.month - 1,
              local.day,
              local.hour,
              local.minute,
              local.second,
              cutoffMilliseconds,
            );
            instant += localTarget - localAsUtc;
          }
          return new Date(instant);
        })();
  return {
    asOf,
    days,
    startDate,
    endDate,
    period: { start, end },
    comparisonPeriod: { start: comparisonStart, end: comparisonEnd },
    timeZone: DASHBOARD_TIME_ZONE,
  } as const;
}
