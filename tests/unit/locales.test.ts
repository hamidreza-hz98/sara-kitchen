import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  isRtlLocale,
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from "@/constants/locales";

describe("locale policy", () => {
  it("keeps English as the default and supports the three launch locales", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toEqual(["en", "pt-PT", "fa"]);
  });

  it("recognizes supported locales without accepting arbitrary browser values", () => {
    expect(isSupportedLocale("pt-PT")).toBe(true);
    expect(isSupportedLocale("pt")).toBe(false);
  });

  it("uses right-to-left direction only for Farsi", () => {
    expect(isRtlLocale("fa")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("pt-PT")).toBe(false);
  });
});
