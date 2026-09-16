import "server-only";

import { z } from "zod";

import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./customer-identity";

const COMMON_PASSWORDS = new Set([
  "passwordpassword",
  "password123456",
  "123456789012345",
  "qwerty123456789",
  "sarakitchen12345",
  "iloveyouiloveyou",
]);

export function isStrongSignupPassword(value: string): boolean {
  const bytes = Buffer.byteLength(value, "utf8");
  return (
    Array.from(value).length >= 15 &&
    bytes <= 1_024 &&
    !/[\x00-\x1f\x7f]/u.test(value) &&
    !COMMON_PASSWORDS.has(value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "")) &&
    !/^(.)\1{14,}$/u.test(value)
  );
}

export const customerSignupSchema = z.strictObject({
  firstName: z.string().transform(normalizeCustomerName).refine(isValidCustomerName),
  lastName: z.string().transform(normalizeCustomerName).refine(isValidCustomerName),
  mobile: z.string().transform(normalizeCustomerMobile).refine(isValidCustomerMobile),
  email: z.string().optional().transform(normalizeCustomerEmail).refine(isValidCustomerEmail),
  password: z.string().refine(isStrongSignupPassword),
  termsAccepted: z.literal(true),
  marketingConsent: z.boolean(),
});

export type CustomerSignupInput = z.output<typeof customerSignupSchema>;
