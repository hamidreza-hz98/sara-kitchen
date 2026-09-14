// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { designTokens } from "@/theme";

function flattenTokenPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenTokenPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linearChannels = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * linearChannels[0]! + 0.7152 * linearChannels[1]! + 0.0722 * linearChannels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe("design tokens", () => {
  it("maps every token leaf to a source in the design-token record", () => {
    const documentation = fs.readFileSync(
      path.join(process.cwd(), "docs", "design-tokens.md"),
      "utf8",
    );

    for (const tokenPath of flattenTokenPaths(designTokens)) {
      expect(documentation, `missing source mapping for ${tokenPath}`).toContain(
        `designTokens.${tokenPath}`,
      );
    }
  });

  it("keeps primary text combinations at AA normal-text contrast", () => {
    expect(
      contrastRatio(designTokens.color.brand.primaryText, designTokens.color.light.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.color.brand.onPrimary, designTokens.color.brand.primary),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.color.light.textPrimary, designTokens.color.light.canvas),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(designTokens.color.dark.textPrimary, designTokens.color.dark.canvas),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps spacing, breakpoints, and motion ordered", () => {
    const spacing = Object.values(designTokens.spacing);
    const breakpoints = Object.values(designTokens.breakpoint);
    const durations = Object.values(designTokens.motion.duration);

    expect(spacing).toEqual([...spacing].sort((first, second) => first - second));
    expect(breakpoints).toEqual([...breakpoints].sort((first, second) => first - second));
    expect(durations).toEqual([...durations].sort((first, second) => first - second));
  });
});
