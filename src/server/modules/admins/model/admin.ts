import "server-only";

import type { Connection, Model } from "mongoose";

import {
  ADMIN_ROLES,
  isAdminRole,
  permissionsForRole,
  type AdminRole,
} from "@/constants/admin-access";
import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";
import { isPasswordHash } from "@/server/security/password";

import {
  isValidAdminIdentifier,
  isValidAdminName,
  normalizeAdminIdentifier,
  normalizeAdminName,
} from "../validation/admin-identity";

export type AdminRecord = BaseDocumentFields & {
  firstName: string;
  lastName: string;
  identifier: string;
  role: AdminRole;
  passwordHash: string;
  passwordVersion: number;
  active: boolean;
  lastLoginAt: Date | null;
};

const adminSchema = createBaseSchema<AdminRecord>(
  {
    firstName: {
      type: String,
      required: true,
      set: normalizeAdminName,
      validate: { validator: isValidAdminName, message: "Enter a valid first name." },
    },
    lastName: {
      type: String,
      required: true,
      set: normalizeAdminName,
      validate: { validator: isValidAdminName, message: "Enter a valid last name." },
    },
    identifier: {
      type: String,
      required: true,
      set: normalizeAdminIdentifier,
      validate: { validator: isValidAdminIdentifier, message: "Enter a valid username or email." },
    },
    role: { type: String, enum: ADMIN_ROLES, required: true },
    passwordHash: {
      type: String,
      required: true,
      select: false,
      validate: { validator: isPasswordHash, message: "An Argon2id hash is required." },
    },
    passwordVersion: {
      type: Number,
      required: true,
      default: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 1,
        message: "Password version must be a positive integer.",
      },
    },
    active: { type: Boolean, required: true, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: "admins", searchSourcePaths: ["firstName", "lastName", "identifier"] },
);

adminSchema.index({ identifier: 1 }, { unique: true, name: "admins_identifier_unique" });
adminSchema.index({ active: 1, role: 1 });

adminSchema.virtual("permissions").get(function permissions(this: AdminRecord) {
  return isAdminRole(this.role) ? permissionsForRole(this.role) : [];
});

const baseJsonOptions = adminSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
adminSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.passwordHash;
    delete serialized.passwordVersion;
    return serialized;
  },
});

export function getAdminModel(connection: Connection): Model<AdminRecord> {
  return (
    (connection.models.Admin as Model<AdminRecord> | undefined) ??
    connection.model<AdminRecord>("Admin", adminSchema)
  );
}
