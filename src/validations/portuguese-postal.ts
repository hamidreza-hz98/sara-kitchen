export const PORTUGUESE_POSTAL_CODE_PATTERN = /^\d{4}-\d{3}$/u;

const LOCALIZED_DIGITS: Readonly<Record<string, string>> = {
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

export function normalizePortuguesePostalCode(value: string): string {
  const normalized = [...value.normalize("NFKC")]
    .map((character) => LOCALIZED_DIGITS[character] ?? character)
    .join("")
    .trim();
  if (!/^\d{7}$|^\d{4}[\s-]+\d{3}$/u.test(normalized)) return normalized;
  const digits = normalized.replace(/\D/gu, "");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function isPortuguesePostalCode(value: string): boolean {
  return PORTUGUESE_POSTAL_CODE_PATTERN.test(value);
}
