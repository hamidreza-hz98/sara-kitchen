import { z } from "zod";

import { ORDER_STATUSES } from "../model/order";
import { ORDER_CODE_PATTERN } from "../policy/order-code";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const code = z.string().regex(ORDER_CODE_PATTERN);

export const orderCodeParametersSchema = z.strictObject({ orderCode: code });
export const orderListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: objectId.optional(),
  search: z.string().trim().min(2).max(64).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});
export const orderInternalNoteSchema = z.strictObject({
  expectedRevision: z.number().int().min(1),
  expectedManagementRevision: z.number().int().min(0),
  internalNote: z.string().trim().max(1_000).nullable(),
});
export const orderTransitionSchema = z.strictObject({
  expectedRevision: z.number().int().min(1),
  status: z.enum(ORDER_STATUSES),
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9._-]{1,63}$/u)
    .nullable()
    .default(null),
});
export const orderCancelSchema = z.strictObject({
  expectedRevision: z.number().int().min(1),
  reasonCode: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/u),
});
export const orderTransactionSchema = z.strictObject({
  expectedRevision: z.number().int().min(1),
  expectedManagementRevision: z.number().int().min(0),
  transactionId: objectId,
});
