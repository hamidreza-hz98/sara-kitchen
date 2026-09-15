import { describe, expect, it } from "vitest";

import type { SupportedLocale } from "@/constants";
import {
  formatDate,
  formatDateTime,
  formatEuro,
  formatNumber,
  formatRelativeTime,
  formatTime,
  formatUnit,
} from "@/locales/formatters";

const exampleDate = new Date("2026-09-15T12:30:00.000Z");

const localizedExamples = [
  {
    locale: "en",
    currency: "€1,234.50",
    number: "12,345.67",
    unit: "12.5 kilometers",
    relativeTime: "yesterday",
    date: "Sep 15, 2026",
    time: "1:30 PM",
    dateTime: "Sep 15, 2026, 1:30 PM",
  },
  {
    locale: "pt-PT",
    currency: "1234,50\u00A0€",
    number: "12\u00A0345,67",
    unit: "12,5 quilómetros",
    relativeTime: "ontem",
    date: "15/09/2026",
    time: "13:30",
    dateTime: "15/09/2026, 13:30",
  },
  {
    locale: "fa",
    currency: "\u200E€۱٬۲۳۴٫۵۰",
    number: "۱۲٬۳۴۵٫۶۷",
    unit: "۱۲٫۵ کیلومتر",
    relativeTime: "دیروز",
    date: "۲۴ شهریور ۱۴۰۵",
    time: "۱۳:۳۰",
    dateTime: "۲۴ شهریور ۱۴۰۵، ۱۳:۳۰",
  },
] as const satisfies ReadonlyArray<{
  locale: SupportedLocale;
  currency: string;
  number: string;
  unit: string;
  relativeTime: string;
  date: string;
  time: string;
  dateTime: string;
}>;

describe.each(localizedExamples)("localized formatters for $locale", (example) => {
  it("formats EUR cents", () => {
    expect(formatEuro(123_450, example.locale)).toBe(example.currency);
  });

  it("formats decimal numbers and units", () => {
    expect(formatNumber(12_345.67, example.locale)).toBe(example.number);
    expect(formatUnit(12.5, "kilometer", example.locale)).toBe(example.unit);
  });

  it("formats relative time", () => {
    expect(formatRelativeTime(-1, "day", example.locale)).toBe(example.relativeTime);
  });

  it("formats dates and times in the kitchen time zone", () => {
    expect(formatDate(exampleDate, example.locale)).toBe(example.date);
    expect(formatTime(exampleDate, example.locale)).toBe(example.time);
    expect(formatDateTime(exampleDate, example.locale)).toBe(example.dateTime);
  });
});

describe("localized formatter input contracts", () => {
  it("preserves cents at the maximum safe integer boundary", () => {
    expect(formatEuro(Number.MAX_SAFE_INTEGER, "en")).toBe("€90,071,992,547,409.91");
  });

  it.each([-1, -0, 12.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid EUR cents value: %s",
    (amountCents) => {
      expect(() => formatEuro(amountCents, "en")).toThrow(
        "EUR amount must be a non-negative safe integer number of cents.",
      );
    },
  );

  it("rejects non-finite quantities and relative-time values", () => {
    expect(() => formatNumber(Number.NaN, "en")).toThrow("Number must be a finite number.");
    expect(() => formatUnit(Number.POSITIVE_INFINITY, "kilometer", "en")).toThrow(
      "Unit value must be a finite number.",
    );
    expect(() => formatRelativeTime(Number.NEGATIVE_INFINITY, "day", "en")).toThrow(
      "Relative-time value must be a finite number.",
    );
  });

  it("rejects invalid dates", () => {
    expect(() => formatDate(new Date(Number.NaN), "en")).toThrow(
      "Date/time value must be a valid Date or Unix timestamp in milliseconds.",
    );
  });
});
