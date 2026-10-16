import { describe, expect, it } from "vitest";

import { createBlogShareLinks } from "@/app/[locale]/(storefront)/blog/[blogSlug]/blog-share";

describe("blog sharing", () => {
  it("encodes the exact canonical URL and title for each provider", () => {
    const canonical = "https://sarakitchen.example/blog/saffron-rice?ref=summer&lang=fa";
    const links = createBlogShareLinks(canonical, "Saffron & rice");
    expect(new URL(links.facebook).searchParams.get("u")).toBe(canonical);
    expect(new URL(links.linkedin).searchParams.get("url")).toBe(canonical);
    expect(new URL(links.telegram).searchParams.get("url")).toBe(canonical);
    expect(new URL(links.telegram).searchParams.get("text")).toBe("Saffron & rice");
    expect(new URL(links.whatsapp).searchParams.get("text")).toBe(`Saffron & rice ${canonical}`);
    expect(links.facebook).toContain("%26lang%3Dfa");
  });
});
