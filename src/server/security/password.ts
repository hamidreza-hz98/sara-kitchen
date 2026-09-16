import "server-only";

import argon2 from "argon2";

import passwordPolicy from "./password-policy.json";

/** OWASP Argon2id minimum for new password hashes. */
export const PASSWORD_ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: passwordPolicy.memoryCost,
  timeCost: passwordPolicy.timeCost,
  parallelism: passwordPolicy.parallelism,
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

export type PasswordVerification = Readonly<{ verified: boolean; needsRehash: boolean }>;
const INVALID_PASSWORD: PasswordVerification = Object.freeze({
  verified: false,
  needsRehash: false,
});

/** Verify without returning, persisting, or logging the plaintext credential. */
export async function verifyPassword(
  password: string,
  digest: string,
): Promise<PasswordVerification> {
  if (Buffer.byteLength(password, "utf8") > 1_024 || !digest.startsWith("$argon2id$")) {
    return INVALID_PASSWORD;
  }
  try {
    if (!(await argon2.verify(digest, password))) return INVALID_PASSWORD;
    return {
      verified: true,
      needsRehash: argon2.needsRehash(digest, PASSWORD_ARGON2_OPTIONS),
    };
  } catch {
    return INVALID_PASSWORD;
  }
}

/** A false compare-and-swap result denies login after a concurrent credential change. */
export async function verifyAndUpgradePassword(
  password: string,
  currentDigest: string,
  replaceDigest: (currentDigest: string, upgradedDigest: string) => Promise<boolean>,
): Promise<boolean> {
  const result = await verifyPassword(password, currentDigest);
  if (!result.verified) return false;
  if (!result.needsRehash) return true;
  return replaceDigest(currentDigest, await hashPassword(password));
}
