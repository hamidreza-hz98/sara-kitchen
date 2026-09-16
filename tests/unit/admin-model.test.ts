import argon2 from "argon2";
import { Mongoose } from "mongoose";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hasAdminPermission, permissionsForRole } from "@/constants/admin-access";
import { getAdminModel } from "@/server/modules/admins/model/admin";
import {
  ADMIN_ARGON2_OPTIONS,
  hashAdminPassword,
  isAdminPasswordHash,
} from "@/server/modules/admins/service/password";
import { normalizeAdminIdentifier } from "@/server/modules/admins/validation/admin-identity";

describe("administrator model", () => {
  const client = new Mongoose();
  const Admin = getAdminModel(client.connection);
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashAdminPassword("A strong admin passphrase 2026");
  });

  it("normalizes usernames, emails, and names before validation", async () => {
    expect(normalizeAdminIdentifier("  SARA.KAZEMI  ")).toBe("sara.kazemi");
    expect(normalizeAdminIdentifier("  CHEF@EXAMPLE.COM  ")).toBe("chef@example.com");

    const admin = new Admin({
      firstName: "  Sara   ",
      lastName: "  Kazemi  ",
      identifier: "  CHEF@EXAMPLE.COM  ",
      role: "owner",
      passwordHash,
    });
    await expect(admin.validate()).resolves.toBeUndefined();
    expect(admin.firstName).toBe("Sara");
    expect(admin.lastName).toBe("Kazemi");
    expect(admin.identifier).toBe("chef@example.com");
    expect(admin.active).toBe(true);
    expect(admin.passwordVersion).toBe(1);
    expect(admin.schemaVersion).toBe(1);
    expect(admin._id).toBeDefined();
    expect(Admin.schema.options.timestamps).toBe(true);
    expect(getAdminModel(client.connection)).toBe(Admin);
  });

  it("requires valid names, identifier, role, hash, and version", async () => {
    const invalid = new Admin({
      firstName: "\u200B",
      lastName: " ",
      identifier: "bad name@example.com",
      role: "unknown",
      passwordHash: "plaintext",
      passwordVersion: 0,
    });
    const error = await invalid.validate().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    const validationError = error as Error & { errors?: Record<string, unknown> };
    expect(Object.keys(validationError.errors ?? {})).toEqual(
      expect.arrayContaining([
        "firstName",
        "lastName",
        "identifier",
        "role",
        "passwordHash",
        "passwordVersion",
      ]),
    );
  });

  it("stores only a suitably configured Argon2id hash and hides it in ordinary output", async () => {
    expect(passwordHash).toMatch(/^\$argon2id\$/u);
    expect(isAdminPasswordHash(passwordHash)).toBe(true);
    expect(isAdminPasswordHash("$argon2id$v=19$m=4096,p=1,t=1$salt$hash")).toBe(false);
    expect(await argon2.verify(passwordHash, "A strong admin passphrase 2026")).toBe(true);
    await expect(hashAdminPassword("too short")).rejects.toThrow(RangeError);

    const admin = new Admin({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "sara",
      role: "owner",
      passwordHash,
    });
    await admin.validate();
    const json = admin.toJSON() as Record<string, unknown>;
    expect(json.passwordHash).toBeUndefined();
    expect(json.passwordVersion).toBeUndefined();
    expect(json.permissions).toEqual(permissionsForRole("owner"));
    expect(json.id).toBe(admin._id.toHexString());
    expect(Admin.schema.path("passwordHash").options.select).toBe(false);
    expect(ADMIN_ARGON2_OPTIONS).toMatchObject({ memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  });

  it("fails closed for disabled accounts without changing their role", async () => {
    const admin = new Admin({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "sara",
      role: "owner",
      passwordHash,
      active: false,
    });
    await admin.validate();
    expect(
      hasAdminPermission({ role: admin.role, active: admin.active }, "admins:assign-role"),
    ).toBe(false);
  });

  it("defines a global unique identifier index, including disabled accounts", () => {
    expect(Admin.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ identifier: 1 }, expect.objectContaining({ unique: true })],
        [{ active: 1, role: 1 }, expect.any(Object)],
      ]),
    );
  });
});
