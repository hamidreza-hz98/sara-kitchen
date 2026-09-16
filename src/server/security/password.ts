import "server-only";

import argon2 from "argon2";

/** OWASP Argon2id minimum for new password hashes. */
export const PASSWORD_ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export function isPasswordHash(value: string): boolean {
  const parts = /^\$argon2id\$v=19\$m=(\d+),p=(\d+),t=(\d+)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/u.exec(
    value,
  );
  if (!parts) return false;
  const memoryCost = Number(parts[1]);
  const parallelism = Number(parts[2]);
  const timeCost = Number(parts[3]);
  return (
    Number.isSafeInteger(memoryCost) &&
    Number.isSafeInteger(timeCost) &&
    Number.isSafeInteger(parallelism) &&
    memoryCost >= PASSWORD_ARGON2_OPTIONS.memoryCost &&
    timeCost >= PASSWORD_ARGON2_OPTIONS.timeCost &&
    parallelism >= PASSWORD_ARGON2_OPTIONS.parallelism
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 1_024) {
    throw new RangeError("Password must be 12–1024 UTF-8 bytes.");
  }
  return argon2.hash(password, PASSWORD_ARGON2_OPTIONS);
}
