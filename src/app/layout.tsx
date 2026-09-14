import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { Metadata } from "next";

import { AppThemeProvider } from "@/providers";
import { emotionCacheOptions } from "@/theme";
import { applicationFontVariables } from "@/theme/fonts.server";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sara Kitchen",
  description: "Persian homemade food in Porto, Portugal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={applicationFontVariables} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript
          attribute="class"
          defaultMode="light"
          modeStorageKey="sara-kitchen-mode"
        />
        <AppRouterCacheProvider options={emotionCacheOptions}>
          <AppThemeProvider>{children}</AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
