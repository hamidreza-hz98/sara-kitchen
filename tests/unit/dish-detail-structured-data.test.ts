import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dishDetailStructuredData } from "@/app/[locale]/(storefront)/menu/[dishSlug]/dish-detail-structured-data";
import type { DishDetailContent } from "@/app/[locale]/(storefront)/menu/[dishSlug]/dish-detail-content";

const dish: DishDetailContent = {
  id: "dish-id",
  slug: "fesenjan",
  name: "Fesenjan",
  excerpt: "Walnut stew",
  description: null,
  images: [],
  category: { slug: "stews", name: "Stews" },
  priceCents: 1200,
  basePriceCents: 1400,
  discount: { amountCents: 200, percentage: null },
  isOrderable: true,
  leadTimeMinutes: 90,
  maxQuantity: 10,
  portion: { amount: 1, unit: "serving" },
  ingredients: [],
  allergens: { contains: ["tree_nuts"], mayContain: [] },
  dietaryTags: [],
  specifications: [],
  relatedDishes: [],
  relatedBlogs: [],
};

describe("dish detail structured data", () => {
  it("uses the same effective price, availability, name, and breadcrumb as the page", () => {
    const graph = dishDetailStructuredData(dish, "https://sarakitchen.pt");
    const product = graph["@graph"].find((node) => node["@type"] === "Product");
    const menuItem = graph["@graph"].find((node) => node["@type"] === "MenuItem");
    const breadcrumbs = graph["@graph"].find((node) => node["@type"] === "BreadcrumbList");
    expect(product).toMatchObject({
      name: "Fesenjan",
      offers: { price: "12.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    });
    expect(menuItem).toMatchObject({ name: "Fesenjan", offers: { price: "12.00" } });
    expect(breadcrumbs).toMatchObject({
      itemListElement: [
        { name: "Sara Kitchen" },
        { name: "Menu" },
        { name: "Stews" },
        { name: "Fesenjan" },
      ],
    });
    const unavailable = dishDetailStructuredData(
      { ...dish, isOrderable: false },
      "https://sarakitchen.pt",
    );
    expect(unavailable["@graph"].find((node) => node["@type"] === "Product")).toMatchObject({
      offers: { availability: "https://schema.org/OutOfStock" },
    });
    const persian = dishDetailStructuredData(dish, "https://sarakitchen.pt", {
      home: "خانه",
      menu: "منو",
    });
    expect(persian["@graph"].find((node) => node["@type"] === "BreadcrumbList")).toMatchObject({
      itemListElement: [{ name: "خانه" }, { name: "منو" }, { name: "Stews" }, { name: "Fesenjan" }],
    });
  });
});
