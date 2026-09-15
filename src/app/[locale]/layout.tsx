import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { isRtlLocale, isSupportedLocale } from "@/constants";
import { routing } from "@/locales/routing";
import { AppThemeProvider, DirectionAwareCacheProvider } from "@/providers";
import { applicationFontVariables } from "@/theme/fonts.server";

import "../globals.css";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const translations = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: translations("title"),
    description: translations("description"),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });
  const direction = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={direction}
      className={applicationFontVariables}
      suppressHydrationWarning
    >
      <body>
        <InitColorSchemeScript
          attribute="class"
          defaultMode="light"
          modeStorageKey="sara-kitchen-mode"
        />
        <DirectionAwareCacheProvider direction={direction}>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Lisbon">
            <AppThemeProvider direction={direction}>{children}</AppThemeProvider>
          </NextIntlClientProvider>
        </DirectionAwareCacheProvider>
      </body>
    </html>
  );
}
