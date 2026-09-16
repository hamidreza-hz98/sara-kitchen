import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PASSWORD_ARGON2_OPTIONS,
  hashPassword,
  isPasswordHash,
  verifyAndUpgradePassword,
  verifyPassword,
} from "@/server/security/password";

describe("password hashing and upgrade", () => {
  const password = "A secure login passphrase 2026";

  it("hashes with Argon2id and verifies correct or incorrect credentials", async () => {
    const digest = await hashPassword(password);
    expect(digest).toMatch(/^\$argon2id\$v=19\$/u);
    expect(digest).not.toContain(password);
    expect(isPasswordHash(digest)).toBe(true);
    expect(await verifyPassword(password, digest)).toEqual({ verified: true, needsRehash: false });
    expect(await verifyPassword("wrong password", digest)).toEqual({
      verified: false,
      needsRehash: false,
    });
    expect(await verifyPassword(password, "not-a-hash")).toEqual({
      verified: false,
      needsRehash: false,
    });
    expect(await verifyPassword(password, "$argon2id$bad")).toEqual({
      verified: false,
      needsRehash: false,
    });
  });

  it("detects old parameters and upgrades only after successful verification", async () => {
    const oldDigest = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    expect(await verifyPassword(password, oldDigest)).toEqual({
      verified: true,
      needsRehash: true,
    });
    const replace = vi.fn(async (_current: string, upgraded: string) => {
      expect(upgraded).not.toBe(oldDigest);
      expect(isPasswordHash(upgraded)).toBe(true);
      expect(await argon2.verify(upgraded, password)).toBe(true);
      return true;
    });
    expect(await verifyAndUpgradePassword("incorrect", oldDigest, replace)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
    expect(await verifyAndUpgradePassword(password, oldDigest, replace)).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace.mock.calls[0]?.[0]).toBe(oldDigest);
  });

  it("denies login if a concurrent password change defeats the upgrade CAS", async () => {
    const oldDigest = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    expect(await verifyAndUpgradePassword(password, oldDigest, async () => false)).toBe(false);
  });

  it("rejects oversized input without persisting or logging plaintext", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(hashPassword("x".repeat(1025))).rejects.toThrow(RangeError);
      expect(await verifyPassword("x".repeat(1025), await hashPassword(password))).toEqual({
        verified: false,
        needsRehash: false,
      });
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(PASSWORD_ARGON2_OPTIONS).toMatchObject({
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
    } finally {
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
