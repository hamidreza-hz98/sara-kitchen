import { describe, expect, it } from "vitest";

import { blogHref, parseBlogQuery } from "@/app/[locale]/(storefront)/blog/blog-query";

describe("public blog index query", () => {
  it("keeps the clean default URL canonical", () => {
    const result = parseBlogQuery({});
    expect(result.canonical).toBe(true);
    expect(blogHref(result.query)).toBe("/blog");
  });

  it("canonicalizes filters, search, view, page, and unexpected parameters", () => {
    const result = parseBlogQuery({
      page: "02",
      sort: "popular",
      q: "  saffron  ",
      view: "list",
      secret: "x",
    });
    expect(result.canonical).toBe(false);
    expect(blogHref(result.query)).toBe("/blog?q=saffron&sort=popular&view=list&page=2");
  });

  it("drops duplicate, malformed, and overly deep values", () => {
    const result = parseBlogQuery({ q: ["one", "two"], sort: "random", page: "2000" });
    expect(result.canonical).toBe(false);
    expect(blogHref(result.query)).toBe("/blog");
  });
});
