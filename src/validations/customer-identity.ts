import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";

/** Shared, deterministic identity normalization for customer forms and server validation. */
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[\u200c '\u2019-][\p{L}\p{M}]+)*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MOBILE_INPUT_PATTERN = /^\+?[\d\s().-]+$/u;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/u;
const DIGITS: Readonly<Record<string, string>> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export function normalizeCustomerName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function isValidCustomerName(value: string): boolean {
  return value.length >= 1 && value.length <= 100 && NAME_PATTERN.test(value);
}

export function normalizeCustomerEmail(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFKC").trim().toLowerCase() ?? "";
  return normalized || null;
}

export function isValidCustomerEmail(value: string | null): boolean {
  return (
    value === null || (value.length <= 254 && EMAIL_PATTERN.test(value) && !value.includes(".."))
  );
}

export function normalizeCustomerMobile(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/[۰-۹٠-٩]/gu, (digit) => DIGITS[digit] ?? digit);
  if (!MOBILE_INPUT_PATTERN.test(normalized)) return normalized;
  const compact = normalized.replace(/[\s().-]/gu, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const parsed = parsePhoneNumberFromString(international, "PT");
  return parsed?.isValid() ? parsed.number : international;
}

export function isValidCustomerMobile(value: string): boolean {
  if (!E164_PATTERN.test(value)) return false;
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.isValid() === true && parsed.number === value;
}

/** Parse a national number for the selected country and return its canonical E.164 form. */
export function parseCustomerMobile(value: string, country: CountryCode): string | null {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/[۰-۹٠-٩]/gu, (digit) => DIGITS[digit] ?? digit);
  if (!MOBILE_INPUT_PATTERN.test(normalized)) return null;

  const compact = normalized.replace(/[\s().-]/gu, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const parsed = parsePhoneNumberFromString(international, country);
  if (!parsed?.isValid() || (parsed.country && parsed.country !== country)) return null;
  return parsed.number;
}
