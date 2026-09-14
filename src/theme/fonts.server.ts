import "server-only";

import localFont from "next/font/local";

const latinFont = localFont({
  src: "./fonts/plus-jakarta-sans-latin-variable.woff2",
  variable: "--font-sara-latin",
  weight: "200 800",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

const persianFont = localFont({
  src: "./fonts/vazirmatn-persian-variable.woff2",
  variable: "--font-sara-persian",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["Tahoma", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const applicationFontVariables = `${latinFont.variable} ${persianFont.variable}`;
