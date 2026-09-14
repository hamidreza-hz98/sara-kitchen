export const fontVariableNames = {
  active: "--font-sara-active",
  latin: "--font-sara-latin",
  persian: "--font-sara-persian",
} as const;

export const applicationFontFamily = [
  `var(${fontVariableNames.active})`,
  `var(${fontVariableNames.latin})`,
  `var(${fontVariableNames.persian})`,
  '"Plus Jakarta Sans"',
  '"Vazirmatn"',
  '"Tahoma"',
  '"Segoe UI"',
  "Arial",
  "sans-serif",
].join(", ");
