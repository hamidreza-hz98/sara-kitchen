// @vitest-environment node

import { describe, expect, it } from "vitest";

import { appColorSchemes, appTheme, rtlAppTheme } from "@/theme/app-theme";
import {
  applicationFontFamily,
  emotionCacheOptions,
  fontVariableNames,
  getEmotionCacheOptions,
  rtlEmotionCacheOptions,
} from "@/theme";
import {
  breakpointTokens,
  colorTokens,
  motionTokens,
  radiusTokens,
  shadowTokens,
} from "@/theme/tokens";

describe("MUI App Router theme contract", () => {
  it("uses a stable layered Emotion cache configuration", () => {
    expect(emotionCacheOptions).toEqual({
      key: "sara-mui",
      enableCssLayer: true,
    });
    expect(getEmotionCacheOptions("ltr")).toBe(emotionCacheOptions);
    expect(getEmotionCacheOptions("rtl")).toBe(rtlEmotionCacheOptions);
    expect(rtlEmotionCacheOptions).toMatchObject({
      key: "sara-mui-rtl",
      enableCssLayer: true,
    });
    expect(rtlEmotionCacheOptions.stylisPlugins).toHaveLength(2);
  });

  it("provides direction-specific themes", () => {
    expect(appTheme.direction).toBe("ltr");
    expect(rtlAppTheme.direction).toBe("rtl");
  });

  it("uses the same optimized font variables in MUI and document CSS", () => {
    expect(applicationFontFamily).toContain(`var(${fontVariableNames.active})`);
    expect(applicationFontFamily).toContain(`var(${fontVariableNames.latin})`);
    expect(applicationFontFamily).toContain(`var(${fontVariableNames.persian})`);
    expect(appTheme.typography.fontFamily).toBe(applicationFontFamily);
  });

  it("enables namespaced MUI CSS variables", () => {
    expect(appTheme.vars).toBeDefined();
    expect(appTheme.vars?.font).toBeDefined();
  });

  it("maps the approved foundations into both color schemes", () => {
    expect(appColorSchemes.light.palette.primary.main).toBe(colorTokens.brand.primary);
    expect(appColorSchemes.light.palette.background.default).toBe(colorTokens.light.canvas);
    expect(appColorSchemes.dark.palette.background.default).toBe(colorTokens.dark.canvas);
    expect(appTheme.breakpoints.values).toEqual(breakpointTokens);
    expect(appTheme.shape.borderRadius).toBe(radiusTokens.md);
    expect(appTheme.shadows[2]).toBe(shadowTokens.card);
  });

  it("maps motion and shared component treatments into the MUI theme", () => {
    expect(appTheme.transitions.duration.standard).toBe(motionTokens.duration.standard);
    expect(appTheme.components?.MuiButton?.styleOverrides).toBeDefined();
    expect(appTheme.components?.MuiCard?.styleOverrides).toBeDefined();
    expect(appTheme.components?.MuiOutlinedInput?.styleOverrides).toBeDefined();
    expect(appTheme.components?.MuiDialog?.styleOverrides).toBeDefined();
    expect(appTheme.components?.MuiTableCell?.styleOverrides).toBeDefined();
  });
});
