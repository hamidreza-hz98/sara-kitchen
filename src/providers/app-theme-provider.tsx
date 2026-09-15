"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { PropsWithChildren } from "react";

import { appTheme, rtlAppTheme } from "@/theme/app-theme";
import type { AppDirection } from "@/theme/app-theme";

type AppThemeProviderProps = PropsWithChildren<{ direction: AppDirection }>;

export function AppThemeProvider({ children, direction }: AppThemeProviderProps) {
  return (
    <ThemeProvider
      theme={direction === "rtl" ? rtlAppTheme : appTheme}
      defaultMode="light"
      disableTransitionOnChange
      modeStorageKey="sara-kitchen-mode"
    >
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
