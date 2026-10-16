import { z } from "zod";

import { isSupportedLocale } from "@/constants";

import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "./customer-identity";

/** Browser validation mirrors the server's identity normalization; the API remains authoritative. */
export const customerInformationSchema = z.object({
  firstName: z.string().transform(normalizeCustomerName).refine(isValidCustomerName),
  lastName: z.string().transform(normalizeCustomerName).refine(isValidCustomerName),
  mobile: z.string().transform(normalizeCustomerMobile).refine(isValidCustomerMobile),
  email: z.string().transform(normalizeCustomerEmail).refine(isValidCustomerEmail),
  language: z.string().refine(isSupportedLocale),
  marketingConsent: z.boolean(),
});
