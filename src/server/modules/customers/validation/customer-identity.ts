import "server-only";

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
  if (/^9\d{8}$/u.test(compact)) return `+351${compact}`;
  if (/^00[1-9]\d+$/u.test(compact)) return `+${compact.slice(2)}`;
  return compact;
}

export function isValidCustomerMobile(value: string): boolean {
  return E164_PATTERN.test(value) && (!value.startsWith("+351") || /^\+3519\d{8}$/u.test(value));
}
