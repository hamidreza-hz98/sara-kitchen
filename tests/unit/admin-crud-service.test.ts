import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AdminCrudError,
  createAdminCrudServices,
  type AdminCrudDependencies,
} from "@/server/modules/admins/service/admin-crud";
import type {
  AdminRepository,
  AdminSnapshot,
  AdminWrite,
} from "@/server/modules/admins/repository/admin";
import { isAdminPasswordHash } from "@/server/modules/admins/service/password";

const owner = { id: "a".repeat(24), role: "owner" as const };

function harness() {
  const records = new Map<string, AdminSnapshot>();
  let sequence = 0;
  const audit = vi.fn(async () => undefined);
  const revokeSessions = vi.fn(async () => 2);
  const hashes: string[] = [];
  const snapshot = (id: string, value: AdminWrite, current?: AdminSnapshot): AdminSnapshot => ({
    id,
    firstName: value.firstName,
    lastName: value.lastName,
    identifier: value.identifier,
    role: value.role,
    active: value.active,
    lastLoginAt: current?.lastLoginAt ?? null,
    deletedAt: current?.deletedAt ?? null,
    version: (current?.version ?? -1) + 1,
    createdAt: current?.createdAt ?? "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
  });
  const repository: AdminRepository = {
    findById: async (id, includeDeleted) => {
      const record = records.get(id);
      return record && (includeDeleted || !record.deletedAt) ? record : null;
    },
    list: async () => ({
      items: [...records.values()].filter((record) => !record.deletedAt),
      total: [...records.values()].filter((record) => !record.deletedAt).length,
    }),
    create: async (value, passwordHash) => {
      const id = String(++sequence).padStart(24, "0");
      hashes.push(passwordHash);
      const created = snapshot(id, value);
      records.set(id, created);
      return created;
    },
    save: async (current, value) => {
      const saved = snapshot(current.id, value, current);
      records.set(current.id, saved);
      return saved;
    },
    countActiveOwners: async (excludingId) =>
      [...records.values()].filter(
        (record) =>
          record.id !== excludingId &&
          record.active &&
          !record.deletedAt &&
          record.role === "owner",
      ).length,
    resetCredential: async (current, passwordHash) => {
      hashes.push(passwordHash);
      const saved = { ...current, version: current.version + 1 };
      records.set(current.id, saved);
      return saved;
    },
    softDelete: async (current, _actorId, at) => {
      const saved = {
        ...current,
        active: false,
        deletedAt: at.toISOString(),
        version: current.version + 1,
      };
      records.set(current.id, saved);
      return saved;
    },
  };
  const deps: AdminCrudDependencies = { repository, audit, revokeSessions };
  return {
    services: createAdminCrudServices(deps),
    records,
    hashes,
    audit,
    revokeSessions,
  };
}

const createInput = {
  firstName: "  Sara  ",
  lastName: " Kazemi ",
  identifier: " SARA@EXAMPLE.COM ",
  role: "manager" as const,
  password: "Strong admin password 2026",
};

describe("administrator CRUD services", () => {
  it("creates normalized accounts with the platform Argon2id standard and audit evidence", async () => {
    const test = harness();
    const created = await test.services.create(owner, createInput);

    expect(created).toMatchObject({
      firstName: "Sara",
      lastName: "Kazemi",
      identifier: "sara@example.com",
      active: true,
    });
    expect(test.hashes).toHaveLength(1);
    expect(isAdminPasswordHash(test.hashes[0] ?? "")).toBe(true);
    expect(test.audit).toHaveBeenCalledWith({
      action: "create",
      actorId: owner.id,
      adminId: created.id,
      outcome: "success",
    });
  });

  it("enforces action and role-assignment permissions and audits denial", async () => {
    const test = harness();
    const unauthorized = { id: "b".repeat(24), role: "manager" as const };
    await expect(test.services.create(unauthorized, createInput)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "denied" }),
    );
    expect(test.records.size).toBe(0);
  });

  it("redacts login identifiers without the sensitive-read permission", async () => {
    const test = harness();
    const created = await test.services.create(owner, createInput);
    const viewer = { id: "b".repeat(24), role: "manager" as const };

    await expect(test.services.get(viewer, created.id)).resolves.toMatchObject({
      id: created.id,
      identifier: null,
    });
    const page = await test.services.list(viewer, { page: 1, pageSize: 20 });
    expect(page.items[0]?.identifier).toBeNull();
  });

  it("blocks self-disable, self-delete, and self-demotion", async () => {
    const test = harness();
    const self = await test.services.create(owner, { ...createInput, role: "owner" });
    const actor = { id: self.id, role: "owner" as const };

    await expect(test.services.disable(actor, self.id)).rejects.toBeInstanceOf(AdminCrudError);
    await expect(test.services.delete(actor, self.id)).rejects.toMatchObject({
      code: "self_protected",
    });
    await expect(test.services.update(actor, self.id, { role: "manager" })).rejects.toMatchObject({
      code: "self_protected",
    });
    expect(test.records.get(self.id)?.active).toBe(true);
  });

  it("preserves the final active owner across demotion, disable, and deletion", async () => {
    const test = harness();
    const lastOwner = await test.services.create(owner, { ...createInput, role: "owner" });

    await expect(
      test.services.update(owner, lastOwner.id, { role: "manager" }),
    ).rejects.toMatchObject({ code: "last_owner" });
    await expect(test.services.disable(owner, lastOwner.id)).rejects.toMatchObject({
      code: "last_owner",
    });
    await expect(test.services.delete(owner, lastOwner.id)).rejects.toMatchObject({
      code: "last_owner",
    });
  });

  it("revokes active sessions after role change, disable, delete, and credential reset", async () => {
    const test = harness();
    const target = await test.services.create(owner, createInput);

    await test.services.update(owner, target.id, { role: "viewer" });
    await test.services.resetCredential(owner, target.id, "Another secure password 2026");
    await expect(test.services.revokeAllSessions(owner, target.id)).resolves.toMatchObject({
      admin: { id: target.id },
      revokedSessions: 2,
    });
    await test.services.disable(owner, target.id);
    await test.services.reactivate(owner, target.id);
    const deleted = await test.services.delete(owner, target.id);

    expect(deleted.deletedAt).not.toBeNull();
    expect(test.revokeSessions.mock.calls).toEqual([
      [target.id, "role-change"],
      [target.id, "password-reset"],
      [target.id, "security"],
      [target.id, "account-disabled"],
      [target.id, "account-disabled"],
    ]);
    expect(test.hashes).toHaveLength(2);
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reset-credential",
        adminId: target.id,
        outcome: "success",
      }),
    );
  });
});
