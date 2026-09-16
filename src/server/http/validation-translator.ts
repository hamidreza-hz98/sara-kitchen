import { createTranslator } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { loadMessages } from "@/locales/messages";
import type { ValidationMessageTranslator } from "@/validations/request";

import type { RequestValidationOptions } from "./request-validation";

/** Bind the request locale's checked message catalog to transport validation helpers. */
export async function getRequestValidationOptions(
  locale: SupportedLocale,
): Promise<RequestValidationOptions> {
  const translate = createTranslator({
    locale,
    messages: await loadMessages(locale),
    namespace: "validation",
  });
  // The union of ICU keys has different argument shapes. The request mapper only supplies
  // validated numeric placeholders to keys that use them; catalogs are checked in CI.
  const translateValidation = translate as unknown as ValidationMessageTranslator;

  return { translate: translateValidation };
}
