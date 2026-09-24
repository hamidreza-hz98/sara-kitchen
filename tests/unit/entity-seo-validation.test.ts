import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { entitySeoUpdateSchema } from "@/server/modules/seo/validation/entity-seo-request";

describe("entity SEO validation", () => {
  const field = (mode: "automatic" | "manual", value?: string | string[]) => ({
    mode,
    ...(value === undefined ? {} : { value }),
  });

  const input = () => ({
    translations: [
      {
        locale: "en",
        title: field("manual", "Persian food in Porto"),
        description: field("automatic"),
        keywords: field("manual", ["Persian food", "Porto"]),
        openGraphTitle: field("automatic"),
        openGraphDescription: field("automatic"),
        twitterTitle: field("automatic"),
        twitterDescription: field("automatic"),
      },
    ],
    canonicalUrl: field("manual", "https://sarakitchen.pt/menu/fesenjan"),
  });

  it("accepts an explicit mix of automatic and manual ownership", () => {
    expect(entitySeoUpdateSchema.safeParse(input()).success).toBe(true);
  });

  it("requires values for manual fields and safe canonical URLs", () => {
    const missing = input();
    missing.translations[0]!.title = field("manual") as never;
    expect(entitySeoUpdateSchema.safeParse(missing).success).toBe(false);

    const unsafe = input();
    unsafe.canonicalUrl = field("manual", "https://example.com/menu?tracking=1") as never;
    expect(entitySeoUpdateSchema.safeParse(unsafe).success).toBe(false);
  });

  it("rejects duplicate locale and keyword ownership payloads", () => {
    const duplicateLocale = input();
    duplicateLocale.translations.push(structuredClone(duplicateLocale.translations[0]!));
    expect(entitySeoUpdateSchema.safeParse(duplicateLocale).success).toBe(false);

    const duplicateKeyword = input();
    duplicateKeyword.translations[0]!.keywords = field("manual", ["Porto", "porto"]) as never;
    expect(entitySeoUpdateSchema.safeParse(duplicateKeyword).success).toBe(false);
  });
});
