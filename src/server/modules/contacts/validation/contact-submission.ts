import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import {
  isValidContactEmail,
  isValidContactMobile,
  isValidContactName,
  normalizeContactEmail,
  normalizeContactMobile,
  normalizeContactName,
} from "./contact-identity";

import {
  CONTACT_INTERNAL_NOTE_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_SUBMISSION_STATUSES,
} from "../model/contact-submission";

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const positiveInteger = z.coerce.number().int().positive();

const optionalMobile = z
  .string()
  .transform((value) => (value.trim() ? normalizeContactMobile(value) : null))
  .pipe(z.string().refine(isValidContactMobile).nullable())
  .default("");
const optionalEmail = z
  .string()
  .transform((value) => normalizeContactEmail(value))
  .pipe(
    z
      .string()
      .refine((value) => isValidContactEmail(value))
      .nullable(),
  )
  .default("");

export const contactSubmissionInputSchema = z
  .strictObject({
    fullName: z
      .string()
      .transform(normalizeContactName)
      .pipe(z.string().refine(isValidContactName)),
    mobile: optionalMobile,
    email: optionalEmail,
    message: z.string().trim().min(CONTACT_MESSAGE_MIN_LENGTH).max(CONTACT_MESSAGE_MAX_LENGTH),
    locale: z.enum(SUPPORTED_LOCALES),
    sourceChannel: z.literal("website").default("website"),
    pagePath: z.string().trim().startsWith("/").max(500).nullable().optional(),
    campaign: z.string().trim().min(1).max(120).nullable().optional(),
    privacyAccepted: z.literal(true),
    privacyPolicyVersion: z.string().trim().min(1).max(64),
    marketingAccepted: z.boolean().default(false),
    // Bot-filled public honeypot. It is accepted only when empty and is never persisted as content.
    company: z.string().max(0).default(""),
  })
  .refine((value) => value.mobile !== null || value.email !== null, {
    message: "Provide at least one contact method.",
    path: ["mobile"],
  });

export type ContactSubmissionInput = z.output<typeof contactSubmissionInputSchema>;

export const contactIdParametersSchema = z.strictObject({ contactId: objectId });

export const contactListQuerySchema = z
  .strictObject({
    page: positiveInteger.default(1),
    pageSize: positiveInteger.max(100).default(20),
    search: z.string().trim().min(1).max(160).optional(),
    status: z.enum(CONTACT_SUBMISSION_STATUSES).optional(),
    assigneeAdminId: objectId.optional(),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => (value.page - 1) * value.pageSize <= 10_000, {
    message: "Requested page is too deep.",
    path: ["page"],
  });

export const contactWorkflowUpdateSchema = z
  .strictObject({
    status: z.enum(["new", "in_progress", "resolved", "spam"]).optional(),
    assigneeAdminId: objectId.nullable().optional(),
    note: z.string().trim().min(1).max(CONTACT_INTERNAL_NOTE_MAX_LENGTH).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined || value.assigneeAdminId !== undefined || value.note !== undefined,
    { message: "Provide at least one workflow change." },
  );

export const contactEmptyMutationSchema = z.strictObject({});

export type ContactListQuery = z.output<typeof contactListQuerySchema>;
export type ContactWorkflowUpdateInput = z.output<typeof contactWorkflowUpdateSchema>;
