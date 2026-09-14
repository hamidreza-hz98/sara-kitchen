export const colorTokens = {
  brand: {
    primary: "#FF6161",
    primaryText: "#C93643",
    onPrimary: "#2C2C47",
    accent: "#FFD48D",
    ink: "#2C2C47",
  },
  light: {
    canvas: "#F8F5F5",
    surface: "#FFFFFF",
    surfaceMuted: "#FFF1F1",
    textPrimary: "#2C2C47",
    textSecondary: "#64748B",
    divider: "#E8DEDE",
  },
  dark: {
    canvas: "#230F0F",
    surface: "#321B1B",
    surfaceMuted: "#432424",
    textPrimary: "#FFF9F7",
    textSecondary: "#D6C5C5",
    divider: "#5A3939",
  },
  status: {
    success: "#059669",
    warning: "#D97706",
    error: "#DC2626",
    info: "#2563EB",
  },
} as const;

export const typographyTokens = {
  fontFamily: {
    sans: '"Plus Jakarta Sans", "Segoe UI", Arial, sans-serif',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
    extraBold: 800,
  },
  scale: {
    caption: { fontSize: 12, lineHeight: 16 },
    bodySmall: { fontSize: 14, lineHeight: 20 },
    body: { fontSize: 16, lineHeight: 24 },
    title: { fontSize: 18, lineHeight: 24 },
    headingSmall: { fontSize: 20, lineHeight: 28 },
    headingMedium: { fontSize: 24, lineHeight: 32 },
    headingLarge: { fontSize: 30, lineHeight: 38 },
    display: { fontSize: 36, lineHeight: 44 },
    hero: { fontSize: 48, lineHeight: 56 },
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.08em",
  },
} as const;

export const spacingTokens = {
  none: 0,
  hairline: 2,
  xs: 4,
  compact: 6,
  sm: 8,
  control: 10,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  "7xl": 80,
  "8xl": 96,
} as const;

export const breakpointTokens = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const radiusTokens = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const shadowTokens = {
  none: "none",
  subtle: "0 1px 2px rgba(44, 44, 71, 0.05)",
  card: "0 4px 12px rgba(44, 44, 71, 0.08)",
  raised: "0 8px 20px rgba(44, 44, 71, 0.12)",
  floating: "0 12px 30px rgba(44, 44, 71, 0.16)",
  dialog: "0 24px 50px rgba(35, 15, 15, 0.24)",
  focus: "0 0 0 3px rgba(255, 97, 97, 0.32)",
} as const;

export const motionTokens = {
  duration: {
    instant: 0,
    fast: 200,
    standard: 300,
    slow: 500,
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
  transform: {
    hoverScale: 1.05,
    pressedScale: 0.95,
    slideDistance: 4,
  },
} as const;

export const designTokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  breakpoint: breakpointTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  motion: motionTokens,
} as const;

export type DesignTokens = typeof designTokens;
