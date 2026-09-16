import "server-only";

import { PASSWORD_ARGON2_OPTIONS, hashPassword, isPasswordHash } from "@/server/security/password";

export const ADMIN_ARGON2_OPTIONS = PASSWORD_ARGON2_OPTIONS;
export const isAdminPasswordHash = isPasswordHash;
export const hashAdminPassword = hashPassword;
