const combiningMarks = /\p{M}+/gu;
const persianAndArabicDiacritics = /[\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const zeroWidthCharacters = /[\u200B-\u200D\u2060\uFEFF]/gu;
const nonSearchCharacters = /[^\p{L}\p{N}]+/gu;
const whitespace = /\s+/gu;

const digitMap: Readonly<Record<string, string>> = Object.freeze({
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
});

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/gu, (digit) => digitMap[digit] ?? digit);
}

export function normalizeSearchText(value: string): string {
  return normalizeDigits(value)
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .replace(persianAndArabicDiacritics, "")
    .replace(zeroWidthCharacters, "")
    .replace(/ي/gu, "ی")
    .replace(/ك/gu, "ک")
    .toLocaleLowerCase("en-US")
    .replace(nonSearchCharacters, " ")
    .replace(whitespace, " ")
    .trim();
}

function collectSearchValues(value: unknown, values: string[]) {
  if (typeof value === "string" || typeof value === "number") {
    values.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectSearchValues(item, values);
    return;
  }

  if (value instanceof Map) {
    for (const item of value.values()) collectSearchValues(item, values);
    return;
  }

  if (value && typeof value === "object") {
    if ("toObject" in value && typeof value.toObject === "function") {
      collectSearchValues(value.toObject(), values);
      return;
    }
    for (const nestedValue of Object.values(value)) collectSearchValues(nestedValue, values);
  }
}

export function buildNormalizedSearchText(values: readonly unknown[]): string {
  const collectedValues: string[] = [];
  for (const value of values) collectSearchValues(value, collectedValues);

  return [...new Set(collectedValues.map(normalizeSearchText).filter(Boolean))].join(" ");
}
