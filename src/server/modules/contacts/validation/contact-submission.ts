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
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_SOURCE_CHANNELS,
} from "../model/contact-submission";

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
    sourceChannel: z.enum(CONTACT_SOURCE_CHANNELS).default("website"),
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
