import "server-only";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeAdminIdentifier(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isValidAdminIdentifier(value: string): boolean {
  return (
    value.length <= 254 &&
    (USERNAME_PATTERN.test(value) || (EMAIL_PATTERN.test(value) && !value.includes("..")))
  );
}

export function normalizeAdminName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function isValidAdminName(value: string): boolean {
  return value.length >= 1 && value.length <= 100 && !/[\p{Cc}\p{Cf}]/u.test(value);
}
