import { isValidObjectId } from "mongoose";
import { z } from "zod";

import { AUDIT_ACTION_DEFINITIONS } from "../types/audit-actions";
import { AUDIT_ACTOR_KINDS, AUDIT_OUTCOMES } from "../types/audit-event";
import {
  AUDIT_ENTITY_KIND_PATTERN,
  AUDIT_REQUEST_ID_PATTERN,
  isSafeAuditText,
} from "./audit-event";

export const AUDIT_LOG_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_LOG_MAX_PAGE_SIZE = 100;
export const AUDIT_LOG_MAX_WINDOW = 10_000;

const actionCodes = Object.keys(AUDIT_ACTION_DEFINITIONS) as [
  keyof typeof AUDIT_ACTION_DEFINITIONS,
  ...(keyof typeof AUDIT_ACTION_DEFINITIONS)[],
];

export const auditLogReadQuerySchema = z
  .strictObject({
    action: z.enum(actionCodes).optional(),
    actorKind: z.enum(AUDIT_ACTOR_KINDS).optional(),
    actorRef: z
      .string()
      .trim()
      .refine(isValidObjectId, "actorRef must be a valid object ID.")
      .optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    outcome: z.enum(AUDIT_OUTCOMES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(AUDIT_LOG_MAX_PAGE_SIZE)
      .default(AUDIT_LOG_DEFAULT_PAGE_SIZE),
    requestId: z
      .string()
      .trim()
      .regex(AUDIT_REQUEST_ID_PATTERN, "requestId is invalid.")
      .optional(),
    resourceKind: z
      .string()
      .trim()
      .regex(AUDIT_ENTITY_KIND_PATTERN, "resourceKind is invalid.")
      .optional(),
    resourceRef: z
      .string()
      .trim()
      .refine((value) => isSafeAuditText(value, 128), "resourceRef is invalid.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: "custom",
        message: "dateFrom must not be after dateTo.",
        path: ["dateFrom"],
      });
    }
    if (value.actorRef && value.actorKind !== "admin" && value.actorKind !== "customer") {
      context.addIssue({
        code: "custom",
        message: "actorRef requires an admin or customer actorKind.",
        path: ["actorRef"],
      });
    }
    if (value.resourceRef && !value.resourceKind) {
      context.addIssue({
        code: "custom",
        message: "resourceRef requires resourceKind.",
        path: ["resourceRef"],
      });
    }
    if (value.page * value.pageSize > AUDIT_LOG_MAX_WINDOW) {
      context.addIssue({
        code: "custom",
        message: `Pagination cannot exceed ${AUDIT_LOG_MAX_WINDOW} records.`,
        path: ["page"],
      });
    }
  });

export type AuditLogReadQuery = z.output<typeof auditLogReadQuerySchema>;

export function parseAuditLogReadQuery(input: unknown): AuditLogReadQuery {
  return auditLogReadQuerySchema.parse(input);
}
