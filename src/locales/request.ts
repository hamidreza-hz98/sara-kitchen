import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import { getIntlMessageFallback, reportIntlError } from "./message-errors";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ locale: localeOverride }) => {
  const routeLocale = localeOverride ?? (await rootParams.locale());

  if (!isSupportedLocale(routeLocale)) {
    notFound();
  }

  return {
    locale: routeLocale,
    messages: await loadMessages(routeLocale),
    timeZone: "Europe/Lisbon",
    getMessageFallback: getIntlMessageFallback,
    onError: reportIntlError,
  };
});
