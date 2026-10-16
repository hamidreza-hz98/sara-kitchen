import { describe, expect, it } from "vitest";

import { menuHref, parseMenuQuery } from "@/app/[locale]/(storefront)/menu/menu-query";

describe("menu URL query", () => {
  it("uses bounded public defaults", () => {
    expect(parseMenuQuery({})).toMatchObject({
      page: 1,
      view: "grid",
      sort: "recommended",
      availability: "available",
      invalid: false,
    });
  });

  it("rejects malformed or expensive input without broadening category searches", () => {
    expect(parseMenuQuery({ page: "834" }).invalid).toBe(true);
    expect(parseMenuQuery({ sort: "$where", q: "x" }).invalid).toBe(true);
    expect(parseMenuQuery({ category: "bad/slug" }).invalid).toBe(true);
    expect(parseMenuQuery({ q: ["a", "b"] }).invalid).toBe(true);
  });

  it("retains filters across view and pagination links", () => {
    const query = parseMenuQuery({ q: "rice", category: "stews", diet: ["vegan"], page: "2" });
    expect(menuHref(query, { view: "list", page: null })).toBe(
      "/menu?q=rice&category=stews&diet=vegan&view=list",
    );
  });
});
