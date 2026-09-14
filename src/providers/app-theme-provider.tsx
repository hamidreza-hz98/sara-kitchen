"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { PropsWithChildren } from "react";

import { appTheme } from "@/theme/app-theme";

export function AppThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      theme={appTheme}
      defaultMode="light"
      disableTransitionOnChange
      modeStorageKey="sara-kitchen-mode"
    >
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
