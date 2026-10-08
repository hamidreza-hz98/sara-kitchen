import "server-only";

import { z } from "zod";

import {
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "@/server/modules/customers";

export const PORTUGUESE_POSTAL_CODE_PATTERN = /^\d{4}-\d{3}$/u;

const LOCALIZED_DIGITS: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export function normalizePortuguesePostalCode(value: string): string {
  const normalized = [...value.normalize("NFKC")]
    .map((character) => LOCALIZED_DIGITS[character] ?? character)
    .join("")
    .trim();
  if (!/^\d{7}$|^\d{4}[\s-]+\d{3}$/u.test(normalized)) return normalized;
  const digits = normalized.replace(/\D/gu, "");
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function isPortuguesePostalCode(value: string): boolean {
  return PORTUGUESE_POSTAL_CODE_PATTERN.test(value);
}

export const addressPointSchema = z.strictObject({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
  ]),
});

export const addressWriteSchema = z.strictObject({
  name: z
    .string()
    .transform(normalizeCustomerName)
    .pipe(z.string().min(1).max(80).refine(isValidCustomerName)),
  recipientName: z
    .string()
    .transform(normalizeCustomerName)
    .pipe(z.string().min(1).max(160).refine(isValidCustomerName)),
  recipientMobile: z
    .string()
    .transform(normalizeCustomerMobile)
    .pipe(z.string().refine(isValidCustomerMobile)),
  formattedAddress: z.string().trim().min(5).max(500),
  location: addressPointSchema,
  postalCode: z
    .string()
    .transform(normalizePortuguesePostalCode)
    .pipe(z.string().regex(PORTUGUESE_POSTAL_CODE_PATTERN)),
  deliveryNotes: z.string().trim().max(500).nullable().default(null),
  isDefault: z.boolean().default(false),
});

export const addressUpdateSchema = addressWriteSchema
  .omit({ isDefault: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one address field must be supplied.",
  });

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
export const addressIdParametersSchema = z.strictObject({ addressId: objectId });
export const customerAddressParametersSchema = z.strictObject({
  customerId: objectId,
  addressId: objectId.optional(),
});
export const addressEmptyMutationSchema = z.strictObject({});

export type AddressPointInput = z.output<typeof addressPointSchema>;
export type AddressWriteInput = z.output<typeof addressWriteSchema>;
export type AddressUpdateInput = z.output<typeof addressUpdateSchema>;
