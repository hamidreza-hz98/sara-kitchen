import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { isRtlLocale, isSupportedLocale, PROJECT_NAME, PROJECT_TIME_ZONE } from "@/constants";
import { routing } from "@/locales/routing";
import {
  AppThemeProvider,
  DirectionAwareCacheProvider,
  FeedbackProvider,
  LocaleProvider,
} from "@/providers";
import { applicationFontVariables } from "@/theme/fonts.server";
import { getApplicationSiteUrl } from "@/server/environment";

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

  const translations = await getTranslations({ locale, namespace: "storefront.metadata" });

  return {
    metadataBase: new URL(getApplicationSiteUrl()),
    applicationName: PROJECT_NAME,
    title: translations("title"),
    description: translations("description"),
    icons: { shortcut: ["/favicon.ico"] },
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
          <LocaleProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
            <AppThemeProvider direction={direction}>
              <FeedbackProvider>{children}</FeedbackProvider>
            </AppThemeProvider>
          </LocaleProvider>
        </DirectionAwareCacheProvider>
      </body>
    </html>
  );
}
