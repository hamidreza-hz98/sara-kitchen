"use client";

import { createTheme } from "@mui/material/styles";

import { applicationFontFamily } from "./font-family";

export const appTheme = createTheme({
  cssVariables: {
    cssVarPrefix: "sara",
  },
  typography: {
    fontFamily: applicationFontFamily,
  },
});
