import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata, escapeSearchPattern } from "@/server/database";
import type { AdminRole } from "@/constants/admin-access";

import { getAdminModel } from "../model/admin";

export type AdminSnapshot = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  identifier: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminWrite = Readonly<{
  firstName: string;
  lastName: string;
  identifier: string;
  role: AdminRole;
  active: boolean;
}>;

export type AdminListOptions = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  role?: AdminRole;
  status?: "active" | "disabled" | "deleted";
  sortBy?: "createdAt" | "firstName" | "identifier" | "lastLoginAt" | "role";
  sortDirection?: "asc" | "desc";
}>;

export type AdminListResult = Readonly<{ items: readonly AdminSnapshot[]; total: number }>;

export class AdminRepositoryConflictError extends Error {
  constructor() {
    super("admin_conflict");
    this.name = "AdminRepositoryConflictError";
  }
}

export interface AdminRepository {
  findById(id: string, includeDeleted?: boolean): Promise<AdminSnapshot | null>;
  list(options: AdminListOptions): Promise<AdminListResult>;
  create(value: AdminWrite, passwordHash: string, actorId: string): Promise<AdminSnapshot>;
  save(current: AdminSnapshot, value: AdminWrite, actorId: string): Promise<AdminSnapshot>;
  countActiveOwners(excludingId?: string): Promise<number>;
  resetCredential(
    current: AdminSnapshot,
    passwordHash: string,
    actorId: string,
  ): Promise<AdminSnapshot>;
  softDelete(current: AdminSnapshot, actorId: string, at: Date): Promise<AdminSnapshot>;
}

function snapshot(document: InstanceType<ReturnType<typeof getAdminModel>>): AdminSnapshot {
  return {
    id: document._id.toHexString(),
    firstName: document.firstName,
    lastName: document.lastName,
    identifier: document.identifier,
    role: document.role,
    active: document.active,
    lastLoginAt: document.lastLoginAt?.toISOString() ?? null,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function applyWrite(document: InstanceType<ReturnType<typeof getAdminModel>>, value: AdminWrite) {
  document.firstName = value.firstName;
  document.lastName = value.lastName;
  document.identifier = value.identifier;
  document.role = value.role;
  document.active = value.active;
}

export function createAdminRepository(connection: Connection): AdminRepository {
  const Admin = getAdminModel(connection);
  const load = async (current: AdminSnapshot) => {
    const document = await Admin.findById(current.id);
    if (!document || document.get("__v") !== current.version)
      throw new AdminRepositoryConflictError();
    return document;
  };

  return {
    async findById(id, includeDeleted = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Admin.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async list(options) {
      const filter: Record<string, unknown> =
        options.status === "deleted"
          ? { deletedAt: { $ne: null } }
          : {
              deletedAt: null,
              ...(options.status ? { active: options.status === "active" } : {}),
            };
      if (options.role) filter.role = options.role;
      if (options.search) {
        const expression = new RegExp(escapeSearchPattern(options.search), "iu");
        filter.$or = [
          { firstName: expression },
          { lastName: expression },
          { identifier: expression },
        ];
      }
      const sortBy = options.sortBy ?? "createdAt";
      const direction = options.sortDirection === "asc" ? 1 : -1;
      const [documents, total] = await Promise.all([
        Admin.find(filter)
          .sort({ [sortBy]: direction, _id: direction })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Admin.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async create(value, passwordHash, actorId) {
      const document = new Admin({ ...value, passwordHash });
      document.createdBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new AdminRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async save(current, value, actorId) {
      const document = await load(current);
      applyWrite(document, value);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new AdminRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async countActiveOwners(excludingId) {
      return Admin.countDocuments({
        active: true,
        role: "owner",
        deletedAt: null,
        ...(excludingId && Types.ObjectId.isValid(excludingId)
          ? { _id: { $ne: new Types.ObjectId(excludingId) } }
          : {}),
      });
    },
    async resetCredential(current, passwordHash, actorId) {
      const document = await load(current);
      document.passwordHash = passwordHash;
      document.passwordVersion += 1;
      document.updatedBy = createActorMetadata("admin", actorId);
      await document.save();
      return snapshot(document);
    },
    async softDelete(current, actorId, at) {
      const document = await load(current);
      document.active = false;
      document.deletedAt = at;
      document.deletedBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      await document.save();
      return snapshot(document);
    },
  };
}
