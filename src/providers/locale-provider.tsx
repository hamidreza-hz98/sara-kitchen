"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";

import { getIntlMessageFallback, reportIntlError } from "@/locales";

type LocaleProviderProps = Pick<
  ComponentProps<typeof NextIntlClientProvider>,
  "children" | "locale" | "messages" | "timeZone"
>;

export function LocaleProvider(props: LocaleProviderProps) {
  return (
    <NextIntlClientProvider
      {...props}
      getMessageFallback={getIntlMessageFallback}
      onError={reportIntlError}
    />
  );
}
