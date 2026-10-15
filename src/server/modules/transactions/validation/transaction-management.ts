import { z } from "zod";

import {
  TRANSACTION_METHODS,
  TRANSACTION_PROVIDERS,
  TRANSACTION_STATUSES,
} from "../model/transaction";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
export const transactionIdParametersSchema = z.strictObject({ transactionId: objectId });
export const transactionListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  method: z.enum(TRANSACTION_METHODS).optional(),
  provider: z.enum(TRANSACTION_PROVIDERS).optional(),
  customerId: objectId.optional(),
  orderId: objectId.optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});
export const transactionNoteSchema = z.strictObject({
  expectedManagementRevision: z.number().int().min(0),
  internalNote: z.string().trim().max(1_000).nullable(),
});
export const transactionRefundSchema = z.strictObject({
  amountCents: z.number().int().min(1).max(100_000_000),
});
export const transactionEmptyActionSchema = z.strictObject({});
