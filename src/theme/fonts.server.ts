import "server-only";

import { Plus_Jakarta_Sans, Vazirmatn } from "next/font/google";

const latinFont = Plus_Jakarta_Sans({
  variable: "--font-sara-latin",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const persianFont = Vazirmatn({
  variable: "--font-sara-persian",
  subsets: ["arabic"],
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  preload: false,
});

export const applicationFontVariables = `${latinFont.variable} ${persianFont.variable}`;
