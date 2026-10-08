import "server-only";

import { z } from "zod";

import { CUSTOMER_STATUSES } from "../model/customer";
import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./customer-identity";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const name = z
  .string()
  .transform(normalizeCustomerName)
  .pipe(z.string().refine(isValidCustomerName));
const mobile = z
  .string()
  .transform(normalizeCustomerMobile)
  .pipe(z.string().refine(isValidCustomerMobile));
const email = z
  .string()
  .nullable()
  .transform(normalizeCustomerEmail)
  .pipe(z.string().nullable().refine(isValidCustomerEmail));

export const customerIdParametersSchema = z.strictObject({ customerId: objectId });
export const customerProfileUpdateSchema = z
  .strictObject({
    firstName: name.optional(),
    lastName: name.optional(),
    mobile: mobile.optional(),
    email: email.optional(),
    marketingConsent: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one customer profile field must be supplied.",
  });
export const customerStatusSchema = z.strictObject({ status: z.enum(["active", "disabled"]) });
export const customerEmptyMutationSchema = z.strictObject({});
export const customerListQuerySchema = z
  .strictObject({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(2).max(80).optional(),
    status: z.enum(CUSTOMER_STATUSES).optional(),
    sortBy: z.enum(["createdAt", "firstName", "lastName", "updatedAt"]).default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => value.page * value.pageSize <= 10_000, {
    path: ["page"],
    message: "The requested page is too deep.",
  });

export type CustomerProfileUpdateInput = z.output<typeof customerProfileUpdateSchema>;
