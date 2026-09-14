import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { isRtlLocale, isSupportedLocale } from "@/constants";
import { routing } from "@/locales/routing";
import { AppThemeProvider } from "@/providers";
import { emotionCacheOptions } from "@/theme";
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

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      className={applicationFontVariables}
      suppressHydrationWarning
    >
      <body>
        <InitColorSchemeScript
          attribute="class"
          defaultMode="light"
          modeStorageKey="sara-kitchen-mode"
        />
        <AppRouterCacheProvider options={emotionCacheOptions}>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Lisbon">
            <AppThemeProvider>{children}</AppThemeProvider>
          </NextIntlClientProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
