export const fontVariableNames = {
  latin: "--font-sara-latin",
  persian: "--font-sara-persian",
} as const;

export const applicationFontFamily = [
  `var(${fontVariableNames.latin})`,
  `var(${fontVariableNames.persian})`,
  '"Plus Jakarta Sans"',
  '"Segoe UI"',
  "Arial",
  "sans-serif",
].join(", ");
