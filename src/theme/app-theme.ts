"use client";

import { createTheme } from "@mui/material/styles";
import type { Shadows, ThemeOptions } from "@mui/material/styles";

import { applicationFontFamily } from "./font-family";
import {
  breakpointTokens,
  colorTokens,
  motionTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  typographyTokens,
} from "./tokens";

const pxToRem = (value: number) => `${value / 16}rem`;
const shadows: Shadows = [
  shadowTokens.none,
  shadowTokens.subtle,
  shadowTokens.card,
  shadowTokens.raised,
  shadowTokens.floating,
  ...Array<string>(20).fill(shadowTokens.dialog),
] as Shadows;

const sharedPalette = {
  primary: {
    main: colorTokens.brand.primary,
    dark: colorTokens.brand.primaryText,
    contrastText: colorTokens.brand.onPrimary,
  },
  secondary: {
    main: colorTokens.brand.accent,
    dark: "#E7B55F",
    contrastText: colorTokens.brand.ink,
  },
  success: { main: colorTokens.status.success },
  warning: { main: colorTokens.status.warning },
  error: { main: colorTokens.status.error },
  info: { main: colorTokens.status.info },
} as const;

const responsiveHeading = (mobile: number, tablet: number, desktop: number) => ({
  fontSize: pxToRem(mobile),
  lineHeight: 1.2,
  [`@media (min-width:${breakpointTokens.md}px)`]: { fontSize: pxToRem(tablet) },
  [`@media (min-width:${breakpointTokens.lg}px)`]: { fontSize: pxToRem(desktop) },
});

export type AppDirection = "ltr" | "rtl";

export const appColorSchemes = {
  light: {
    palette: {
      ...sharedPalette,
      background: { default: colorTokens.light.canvas, paper: colorTokens.light.surface },
      text: {
        primary: colorTokens.light.textPrimary,
        secondary: colorTokens.light.textSecondary,
      },
      divider: colorTokens.light.divider,
      action: {
        hover: "rgba(255, 97, 97, 0.08)",
        selected: "rgba(255, 97, 97, 0.14)",
        focus: "rgba(255, 97, 97, 0.18)",
        disabledBackground: "rgba(44, 44, 71, 0.08)",
      },
    },
  },
  dark: {
    palette: {
      ...sharedPalette,
      primary: { ...sharedPalette.primary, dark: colorTokens.brand.primary },
      success: { main: "#6EE7B7" },
      warning: { main: "#FBBF24" },
      error: { main: "#FF8A8A" },
      info: { main: "#93C5FD" },
      background: { default: colorTokens.dark.canvas, paper: colorTokens.dark.surface },
      text: {
        primary: colorTokens.dark.textPrimary,
        secondary: colorTokens.dark.textSecondary,
      },
      divider: colorTokens.dark.divider,
      action: {
        hover: "rgba(255, 212, 141, 0.08)",
        selected: "rgba(255, 97, 97, 0.18)",
        focus: "rgba(255, 97, 97, 0.24)",
        disabledBackground: "rgba(255, 249, 247, 0.08)",
      },
    },
  },
} as const;

const appThemeOptions = {
  cssVariables: {
    cssVarPrefix: "sara",
    colorSchemeSelector: "class",
  },
  colorSchemes: appColorSchemes,
  breakpoints: { values: breakpointTokens },
  spacing: spacingTokens.xs,
  shape: { borderRadius: radiusTokens.md },
  shadows,
  transitions: {
    duration: {
      shortest: motionTokens.duration.fast,
      shorter: motionTokens.duration.fast,
      short: motionTokens.duration.fast,
      standard: motionTokens.duration.standard,
      complex: motionTokens.duration.slow,
      enteringScreen: motionTokens.duration.standard,
      leavingScreen: motionTokens.duration.fast,
    },
    easing: {
      easeInOut: motionTokens.easing.standard,
      easeOut: motionTokens.easing.enter,
      easeIn: motionTokens.easing.exit,
      sharp: motionTokens.easing.exit,
    },
  },
  typography: {
    fontFamily: applicationFontFamily,
    fontWeightRegular: typographyTokens.fontWeight.regular,
    fontWeightMedium: typographyTokens.fontWeight.medium,
    fontWeightBold: typographyTokens.fontWeight.bold,
    h1: {
      ...responsiveHeading(typographyTokens.scale.headingLarge.fontSize, 40, 48),
      fontWeight: typographyTokens.fontWeight.extraBold,
      letterSpacing: typographyTokens.letterSpacing.tight,
    },
    h2: {
      ...responsiveHeading(typographyTokens.scale.headingMedium.fontSize, 28, 30),
      fontWeight: typographyTokens.fontWeight.bold,
      letterSpacing: typographyTokens.letterSpacing.tight,
    },
    h3: {
      ...responsiveHeading(typographyTokens.scale.headingSmall.fontSize, 22, 24),
      fontWeight: typographyTokens.fontWeight.bold,
      letterSpacing: typographyTokens.letterSpacing.tight,
    },
    h4: {
      fontSize: pxToRem(typographyTokens.scale.title.fontSize),
      lineHeight: typographyTokens.scale.title.lineHeight / typographyTokens.scale.title.fontSize,
      fontWeight: typographyTokens.fontWeight.bold,
    },
    h5: {
      fontSize: pxToRem(typographyTokens.scale.body.fontSize),
      lineHeight: typographyTokens.scale.body.lineHeight / typographyTokens.scale.body.fontSize,
      fontWeight: typographyTokens.fontWeight.bold,
    },
    h6: {
      fontSize: pxToRem(typographyTokens.scale.bodySmall.fontSize),
      lineHeight:
        typographyTokens.scale.bodySmall.lineHeight / typographyTokens.scale.bodySmall.fontSize,
      fontWeight: typographyTokens.fontWeight.bold,
    },
    subtitle1: {
      fontSize: pxToRem(typographyTokens.scale.body.fontSize),
      lineHeight: typographyTokens.scale.body.lineHeight / typographyTokens.scale.body.fontSize,
      fontWeight: typographyTokens.fontWeight.semiBold,
    },
    subtitle2: {
      fontSize: pxToRem(typographyTokens.scale.bodySmall.fontSize),
      lineHeight:
        typographyTokens.scale.bodySmall.lineHeight / typographyTokens.scale.bodySmall.fontSize,
      fontWeight: typographyTokens.fontWeight.semiBold,
    },
    body1: {
      fontSize: pxToRem(typographyTokens.scale.body.fontSize),
      lineHeight: typographyTokens.scale.body.lineHeight / typographyTokens.scale.body.fontSize,
    },
    body2: {
      fontSize: pxToRem(typographyTokens.scale.bodySmall.fontSize),
      lineHeight:
        typographyTokens.scale.bodySmall.lineHeight / typographyTokens.scale.bodySmall.fontSize,
    },
    button: {
      fontSize: pxToRem(typographyTokens.scale.bodySmall.fontSize),
      lineHeight: 1.4,
      fontWeight: typographyTokens.fontWeight.bold,
      textTransform: "none",
    },
    caption: {
      fontSize: pxToRem(typographyTokens.scale.caption.fontSize),
      lineHeight:
        typographyTokens.scale.caption.lineHeight / typographyTokens.scale.caption.fontSize,
    },
    overline: {
      fontSize: pxToRem(typographyTokens.scale.caption.fontSize),
      lineHeight: 1.5,
      fontWeight: typographyTokens.fontWeight.bold,
      letterSpacing: typographyTokens.letterSpacing.wide,
      textTransform: "uppercase",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { minHeight: "100dvh", backgroundImage: "none" },
        "::selection": {
          color: colorTokens.brand.ink,
          backgroundColor: colorTokens.brand.accent,
        },
        "*:focus-visible": {
          outline: `2px solid ${colorTokens.brand.primary}`,
          outlineOffset: spacingTokens.hairline,
        },
      },
    },
    MuiButtonBase: { defaultProps: { disableTouchRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 44,
          borderRadius: radiusTokens.md,
          paddingInline: spacingTokens.lg,
          transition: theme.transitions.create([
            "background-color",
            "border-color",
            "box-shadow",
            "transform",
          ]),
          "&:active": { transform: `scale(${motionTokens.transform.pressedScale})` },
          variants: [
            {
              props: { color: "primary", variant: "contained" },
              style: {
                boxShadow: shadowTokens.card,
                "&:hover": { boxShadow: shadowTokens.raised },
              },
            },
            {
              props: { color: "primary", variant: "outlined" },
              style: {
                color: "var(--sara-palette-primary-dark)",
                borderColor: "var(--sara-palette-primary-dark)",
              },
            },
            {
              props: { color: "primary", variant: "text" },
              style: { color: "var(--sara-palette-primary-dark)" },
            },
          ],
        }),
        sizeLarge: { minHeight: 48, paddingInline: spacingTokens.xl },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: radiusTokens.md,
          transition: theme.transitions.create(["background-color", "transform"]),
          "&:active": { transform: `scale(${motionTokens.transform.pressedScale})` },
        }),
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.lg,
          border: "1px solid var(--sara-palette-divider)",
          boxShadow: shadowTokens.card,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: spacingTokens.xl,
          "&:last-child": { paddingBottom: spacingTokens.xl },
        },
      },
    },
    MuiChip: {
      defaultProps: { size: "small" },
      styleOverrides: {
        root: ({ theme }) => ({
          minHeight: 28,
          borderRadius: radiusTokens.pill,
          fontWeight: typographyTokens.fontWeight.semiBold,
          variants: [
            {
              props: { color: "success", variant: "filled" },
              style: {
                color: "#047857",
                backgroundColor: "rgba(var(--sara-palette-success-mainChannel) / 0.14)",
                ...theme.applyStyles("dark", { color: "var(--sara-palette-success-main)" }),
              },
            },
            {
              props: { color: "warning", variant: "filled" },
              style: {
                color: "#92400E",
                backgroundColor: "rgba(var(--sara-palette-warning-mainChannel) / 0.14)",
                ...theme.applyStyles("dark", { color: "var(--sara-palette-warning-main)" }),
              },
            },
          ],
        }),
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          minWidth: 20,
          height: 20,
          paddingInline: spacingTokens.compact,
          borderRadius: radiusTokens.pill,
          fontWeight: typographyTokens.fontWeight.bold,
          boxShadow: `0 0 0 2px var(--sara-palette-background-paper)`,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: "var(--sara-palette-primary-dark)",
          fontWeight: typographyTokens.fontWeight.semiBold,
          textUnderlineOffset: spacingTokens.xs,
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small", variant: "outlined" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: radiusTokens.md,
          "&.Mui-focused": { boxShadow: shadowTokens.focus },
        },
        notchedOutline: {
          transition: `border-color ${motionTokens.duration.fast}ms ${motionTokens.easing.standard}`,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: typographyTokens.fontWeight.medium } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radiusTokens.md, alignItems: "center" },
        message: { paddingBlock: spacingTokens.compact },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radiusTokens.xl, boxShadow: shadowTokens.dialog },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          boxShadow: shadowTokens.dialog,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { borderRadius: radiusTokens.md },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          minWidth: 40,
          height: 40,
          borderRadius: radiusTokens.md,
          fontWeight: typographyTokens.fontWeight.semiBold,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: "transparent", elevation: 0 },
      styleOverrides: {
        root: {
          color: "var(--sara-palette-text-primary)",
          backgroundColor: "rgba(var(--sara-palette-background-paperChannel) / 0.92)",
          borderBlockEnd: "1px solid var(--sara-palette-divider)",
          backdropFilter: "blur(14px)",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "var(--sara-palette-divider)" },
        head: {
          fontWeight: typographyTokens.fontWeight.bold,
          backgroundColor: "var(--sara-palette-action-hover)",
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { height: 3, borderRadius: radiusTokens.pill } },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          fontWeight: typographyTokens.fontWeight.semiBold,
          textTransform: "none",
          "&.Mui-selected": { color: "var(--sara-palette-primary-dark)" },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          borderRadius: radiusTokens.sm,
          padding: `${spacingTokens.compact}px ${spacingTokens.control}px`,
          fontSize: pxToRem(typographyTokens.scale.caption.fontSize),
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { borderRadius: radiusTokens.md, boxShadow: shadowTokens.floating },
      },
    },
  },
} satisfies ThemeOptions;

export function createAppTheme(direction: AppDirection) {
  return createTheme({ ...appThemeOptions, direction });
}

export const appTheme = createAppTheme("ltr");
export const rtlAppTheme = createAppTheme("rtl");
