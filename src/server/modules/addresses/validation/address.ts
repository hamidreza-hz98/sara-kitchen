import "server-only";

import { z } from "zod";

import {
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "@/server/modules/customers";
import {
  isPortuguesePostalCode,
  normalizePortuguesePostalCode,
  PORTUGUESE_POSTAL_CODE_PATTERN,
} from "@/validations/portuguese-postal";

export { PORTUGUESE_POSTAL_CODE_PATTERN, isPortuguesePostalCode, normalizePortuguesePostalCode };

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
