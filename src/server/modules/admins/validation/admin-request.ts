import "server-only";

import { z } from "zod";

import { ADMIN_ROLES } from "@/constants/admin-access";

import {
  isValidAdminIdentifier,
  isValidAdminName,
  normalizeAdminIdentifier,
  normalizeAdminName,
} from "./admin-identity";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const name = z.string().transform(normalizeAdminName).pipe(z.string().refine(isValidAdminName));
const identifier = z
  .string()
  .transform(normalizeAdminIdentifier)
  .pipe(z.string().refine(isValidAdminIdentifier));
const password = z
  .string()
  .min(12)
  .max(1_024)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 1_024, {
    message: "Password cannot exceed 1024 UTF-8 bytes.",
  });

export const adminIdParametersSchema = z.strictObject({ adminId: objectId });
export const adminCreateSchema = z.strictObject({
  firstName: name,
  lastName: name,
  identifier,
  role: z.enum(ADMIN_ROLES),
  password,
});
export const adminUpdateSchema = z
  .strictObject({
    firstName: name.optional(),
    lastName: name.optional(),
    identifier: identifier.optional(),
    role: z.enum(ADMIN_ROLES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one administrator field must be supplied.",
  });
export const adminCredentialResetSchema = z.strictObject({ password });
export const adminEmptyMutationSchema = z.strictObject({});
export const adminListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(2).max(80).optional(),
    role: z.enum(ADMIN_ROLES).optional(),
    status: z.enum(["active", "disabled", "deleted"]).optional(),
    sortBy: z
      .enum(["createdAt", "firstName", "identifier", "lastLoginAt", "role"])
      .default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, {
    path: ["page"],
    message: "The requested page is too deep.",
  });
