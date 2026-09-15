import { PROJECT_CURRENCY, PROJECT_TIME_ZONE, type SupportedLocale } from "@/constants";

export type DateTimeInput = Date | number;
export type FormatUnit = NonNullable<Intl.NumberFormatOptions["unit"]>;

const euroFormatters = new Map<SupportedLocale, Intl.NumberFormat>();
const numberFormatters = new Map<SupportedLocale, Intl.NumberFormat>();
const unitFormatters = new Map<string, Intl.NumberFormat>();
const relativeTimeFormatters = new Map<SupportedLocale, Intl.RelativeTimeFormat>();
const dateFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();
const timeFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();
const dateTimeFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();

function fromCache<Key, Value>(cache: Map<Key, Value>, key: Key, create: () => Value): Value {
  const existing = cache.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const value = create();
  cache.set(key, value);
  return value;
}

function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
}

function requireEuroCents(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || Object.is(amountCents, -0)) {
    throw new RangeError("EUR amount must be a non-negative safe integer number of cents.");
  }
}

function euroCentsToDecimal(amountCents: number): Intl.StringNumericLiteral {
  const wholeEuros = Math.floor(amountCents / 100);
  const fractionalCents = (amountCents % 100).toString().padStart(2, "0");

  return `${wholeEuros}.${fractionalCents}` as Intl.StringNumericLiteral;
}

function requireDate(value: DateTimeInput): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Date/time value must be a valid Date or Unix timestamp in milliseconds.");
  }

  return date;
}

export function formatEuro(amountCents: number, locale: SupportedLocale): string {
  requireEuroCents(amountCents);

  const formatter = fromCache(
    euroFormatters,
    locale,
    () =>
      new Intl.NumberFormat(locale, {
        currency: PROJECT_CURRENCY,
        style: "currency",
      }),
  );

  return formatter.format(euroCentsToDecimal(amountCents));
}

export function formatNumber(value: number, locale: SupportedLocale): string {
  requireFiniteNumber(value, "Number");

  const formatter = fromCache(
    numberFormatters,
    locale,
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
        style: "decimal",
      }),
  );

  return formatter.format(value);
}

export function formatUnit(value: number, unit: FormatUnit, locale: SupportedLocale): string {
  requireFiniteNumber(value, "Unit value");

  const key = `${locale}:${unit}`;
  const formatter = fromCache(
    unitFormatters,
    key,
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
        style: "unit",
        unit,
        unitDisplay: "long",
      }),
  );

  return formatter.format(value);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: SupportedLocale,
): string {
  requireFiniteNumber(value, "Relative-time value");

  const formatter = fromCache(
    relativeTimeFormatters,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "long" }),
  );

  return formatter.format(value, unit);
}

export function formatDate(value: DateTimeInput, locale: SupportedLocale): string {
  const formatter = fromCache(
    dateFormatters,
    locale,
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: PROJECT_TIME_ZONE,
      }),
  );

  return formatter.format(requireDate(value));
}

export function formatTime(value: DateTimeInput, locale: SupportedLocale): string {
  const formatter = fromCache(
    timeFormatters,
    locale,
    () =>
      new Intl.DateTimeFormat(locale, {
        timeStyle: "short",
        timeZone: PROJECT_TIME_ZONE,
      }),
  );

  return formatter.format(requireDate(value));
}

export function formatDateTime(value: DateTimeInput, locale: SupportedLocale): string {
  const formatter = fromCache(
    dateTimeFormatters,
    locale,
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: PROJECT_TIME_ZONE,
      }),
  );

  return formatter.format(requireDate(value));
}
