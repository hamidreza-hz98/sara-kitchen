// @vitest-environment node

import { describe, expect, it } from "vitest";

import { appTheme } from "@/theme/app-theme";
import { applicationFontFamily, emotionCacheOptions, fontVariableNames } from "@/theme";

describe("MUI App Router theme contract", () => {
  it("uses a stable layered Emotion cache configuration", () => {
    expect(emotionCacheOptions).toEqual({
      key: "sara-mui",
      enableCssLayer: true,
    });
  });

  it("uses the same optimized font variables in MUI and document CSS", () => {
    expect(applicationFontFamily).toContain(`var(${fontVariableNames.latin})`);
    expect(applicationFontFamily).toContain(`var(${fontVariableNames.persian})`);
    expect(appTheme.typography.fontFamily).toBe(applicationFontFamily);
  });

  it("enables namespaced MUI CSS variables", () => {
    expect(appTheme.vars).toBeDefined();
    expect(appTheme.vars?.font).toBeDefined();
  });
});
