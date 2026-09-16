import "server-only";

import { hashPassword, isPasswordHash } from "@/server/security/password";

export const hashCustomerPassword = hashPassword;
export const isCustomerPasswordHash = isPasswordHash;
