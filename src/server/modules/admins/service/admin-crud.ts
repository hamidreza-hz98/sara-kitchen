import "server-only";

import {
  hasAdminPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/constants/admin-access";

import { hashAdminPassword } from "./password";
import type {
  AdminListOptions,
  AdminRepository,
  AdminSnapshot,
  AdminWrite,
} from "../repository/admin";
import {
  isValidAdminIdentifier,
  isValidAdminName,
  normalizeAdminIdentifier,
  normalizeAdminName,
} from "../validation/admin-identity";

export type AdminCrudAction =
  "create" | "read" | "update" | "disable" | "reactivate" | "reset-credential" | "delete";
export type AdminCrudActor = Readonly<{ id: string; role: AdminRole }>;
export type AdminCreateInput = Readonly<{
  firstName: string;
  lastName: string;
  identifier: string;
  role: AdminRole;
  password: string;
}>;
export type AdminUpdateInput = Readonly<
  Partial<Pick<AdminCreateInput, "firstName" | "lastName" | "identifier" | "role">>
>;
export type AdminCrudAuditEvent = Readonly<{
  action: AdminCrudAction;
  actorId: string;
  adminId: string | null;
  outcome: "success" | "failure" | "denied";
}>;
export type AdminCrudDependencies = Readonly<{
  repository: AdminRepository;
  audit(event: AdminCrudAuditEvent): Promise<void>;
  revokeSessions(
    adminId: string,
    reason: "account-disabled" | "password-reset" | "role-change",
  ): Promise<number>;
}>;
export type AdminManagementView = Omit<AdminSnapshot, "identifier"> & {
  identifier: string | null;
};

export class AdminCrudError extends Error {
  constructor(
    readonly code:
      "conflict" | "forbidden" | "invalid_input" | "last_owner" | "not_found" | "self_protected",
  ) {
    super(code);
    this.name = "AdminCrudError";
  }
}

const actionPermissions = {
  create: "admins:create",
  read: "admins:read",
  update: "admins:update",
  disable: "admins:disable",
  reactivate: "admins:disable",
  "reset-credential": "admins:update",
  delete: "admins:delete",
} as const satisfies Record<AdminCrudAction, AdminPermission>;

function requirePermission(actor: AdminCrudActor, action: AdminCrudAction): void {
  if (!hasAdminPermission({ role: actor.role, active: true }, actionPermissions[action]))
    throw new AdminCrudError("forbidden");
}

function requireRoleAssignment(actor: AdminCrudActor): void {
  if (!hasAdminPermission({ role: actor.role, active: true }, "admins:assign-role"))
    throw new AdminCrudError("forbidden");
}

function parseWrite(input: AdminCreateInput): AdminCreateInput {
  const firstName = normalizeAdminName(input.firstName);
  const lastName = normalizeAdminName(input.lastName);
  const identifier = normalizeAdminIdentifier(input.identifier);
  if (
    !isValidAdminName(firstName) ||
    !isValidAdminName(lastName) ||
    !isValidAdminIdentifier(identifier) ||
    !isAdminRole(input.role) ||
    input.password.length < 12 ||
    Buffer.byteLength(input.password, "utf8") > 1_024
  ) {
    throw new AdminCrudError("invalid_input");
  }
  return { ...input, firstName, lastName, identifier };
}

function mergeUpdate(current: AdminSnapshot, input: AdminUpdateInput): AdminWrite {
  if (Object.keys(input).length === 0) throw new AdminCrudError("invalid_input");
  const firstName = normalizeAdminName(input.firstName ?? current.firstName);
  const lastName = normalizeAdminName(input.lastName ?? current.lastName);
  const identifier = normalizeAdminIdentifier(input.identifier ?? current.identifier);
  if (
    !isValidAdminName(firstName) ||
    !isValidAdminName(lastName) ||
    !isValidAdminIdentifier(identifier) ||
    (input.role !== undefined && !isAdminRole(input.role))
  )
    throw new AdminCrudError("invalid_input");
  return {
    firstName,
    lastName,
    identifier,
    role: input.role ?? current.role,
    active: current.active,
  };
}

function toView(actor: AdminCrudActor, value: AdminSnapshot): AdminManagementView {
  return {
    ...value,
    identifier: hasAdminPermission({ role: actor.role, active: true }, "admins:read-sensitive")
      ? value.identifier
      : null,
  };
}

async function protectOwnerRemoval(
  deps: AdminCrudDependencies,
  current: AdminSnapshot,
): Promise<void> {
  if (
    current.role === "owner" &&
    current.active &&
    (await deps.repository.countActiveOwners(current.id)) === 0
  )
    throw new AdminCrudError("last_owner");
}

async function auditFailure(
  deps: AdminCrudDependencies,
  actor: AdminCrudActor,
  action: AdminCrudAction,
  error: unknown,
  adminId: string | null,
) {
  await deps.audit({
    action,
    actorId: actor.id,
    adminId,
    outcome: error instanceof AdminCrudError && error.code === "forbidden" ? "denied" : "failure",
  });
}

async function execute<T>(
  deps: AdminCrudDependencies,
  actor: AdminCrudActor,
  action: AdminCrudAction,
  adminId: string | null,
  work: () => Promise<T>,
  resolveAuditAdminId?: (value: T) => string | null,
): Promise<T> {
  let value: T;
  try {
    requirePermission(actor, action);
    value = await work();
  } catch (error) {
    await auditFailure(deps, actor, action, error, adminId);
    throw error;
  }
  await deps.audit({
    action,
    actorId: actor.id,
    adminId: resolveAuditAdminId ? resolveAuditAdminId(value) : adminId,
    outcome: "success",
  });
  return value;
}

export function createAdminCrudServices(deps: AdminCrudDependencies) {
  const find = async (id: string, includeDeleted = false) => {
    const current = await deps.repository.findById(id, includeDeleted);
    if (!current) throw new AdminCrudError("not_found");
    return current;
  };

  return {
    async create(actor: AdminCrudActor, raw: AdminCreateInput): Promise<AdminManagementView> {
      return execute(
        deps,
        actor,
        "create",
        null,
        async () => {
          requireRoleAssignment(actor);
          const input = parseWrite(raw);
          const passwordHash = await hashAdminPassword(input.password);
          return toView(
            actor,
            await deps.repository.create({ ...input, active: true }, passwordHash, actor.id),
          );
        },
        (created) => created.id,
      );
    },
    async get(actor: AdminCrudActor, id: string): Promise<AdminManagementView> {
      return execute(deps, actor, "read", id, async () => toView(actor, await find(id)));
    },
    async list(actor: AdminCrudActor, options: AdminListOptions) {
      return execute(deps, actor, "read", null, async () => {
        if (
          !Number.isSafeInteger(options.page) ||
          options.page < 1 ||
          !Number.isSafeInteger(options.pageSize) ||
          options.pageSize < 1 ||
          options.pageSize > 100 ||
          (options.search && options.search.length > 80)
        )
          throw new AdminCrudError("invalid_input");
        const result = await deps.repository.list(options);
        return { ...result, items: result.items.map((item) => toView(actor, item)) };
      });
    },
    async update(
      actor: AdminCrudActor,
      id: string,
      input: AdminUpdateInput,
    ): Promise<AdminManagementView> {
      return execute(deps, actor, "update", id, async () => {
        const current = await find(id);
        const value = mergeUpdate(current, input);
        const roleChanged = value.role !== current.role;
        if (roleChanged) {
          requireRoleAssignment(actor);
          if (actor.id === id && current.role === "owner")
            throw new AdminCrudError("self_protected");
          await protectOwnerRemoval(deps, current);
        }
        const saved = await deps.repository.save(current, value, actor.id);
        if (roleChanged) await deps.revokeSessions(id, "role-change");
        return toView(actor, saved);
      });
    },
    async disable(actor: AdminCrudActor, id: string): Promise<AdminManagementView> {
      return execute(deps, actor, "disable", id, async () => {
        if (actor.id === id) throw new AdminCrudError("self_protected");
        const current = await find(id);
        if (!current.active) return toView(actor, current);
        await protectOwnerRemoval(deps, current);
        const saved = await deps.repository.save(current, { ...current, active: false }, actor.id);
        await deps.revokeSessions(id, "account-disabled");
        return toView(actor, saved);
      });
    },
    async reactivate(actor: AdminCrudActor, id: string): Promise<AdminManagementView> {
      return execute(deps, actor, "reactivate", id, async () => {
        const current = await find(id);
        if (current.active) return toView(actor, current);
        return toView(
          actor,
          await deps.repository.save(current, { ...current, active: true }, actor.id),
        );
      });
    },
    async resetCredential(
      actor: AdminCrudActor,
      id: string,
      password: string,
    ): Promise<AdminManagementView> {
      return execute(deps, actor, "reset-credential", id, async () => {
        const current = await find(id);
        if (password.length < 12 || Buffer.byteLength(password, "utf8") > 1_024)
          throw new AdminCrudError("invalid_input");
        const saved = await deps.repository.resetCredential(
          current,
          await hashAdminPassword(password),
          actor.id,
        );
        await deps.revokeSessions(id, "password-reset");
        return toView(actor, saved);
      });
    },
    async delete(actor: AdminCrudActor, id: string): Promise<AdminManagementView> {
      return execute(deps, actor, "delete", id, async () => {
        if (actor.id === id) throw new AdminCrudError("self_protected");
        const current = await find(id);
        await protectOwnerRemoval(deps, current);
        const deleted = await deps.repository.softDelete(current, actor.id, new Date());
        await deps.revokeSessions(id, "account-disabled");
        return toView(actor, deleted);
      });
    },
  };
}
