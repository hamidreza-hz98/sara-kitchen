import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { MenuPage } from "@/app/[locale]/(storefront)/menu/menu-page";
import { parseMenuQuery } from "@/app/[locale]/(storefront)/menu/menu-query";
import type { MenuContent } from "@/app/[locale]/(storefront)/menu/menu-data";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";

const content: MenuContent = {
  categories: [{ slug: "stews", name: "Stews", description: "Slow-cooked food" }],
  selectedCategory: null,
  banner: null,
  dishes: [
    {
      slug: "fesenjan",
      name: "Fesenjan",
      excerpt: "Walnut stew",
      image: null,
      priceCents: 1200,
      compareAtPriceCents: 1400,
      isOrderable: true,
      dietaryTags: [],
    },
  ],
  totalItems: 24,
  totalPages: 2,
};

function renderMenu(value: MenuContent, query = parseMenuQuery({})) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <MenuPage content={value} query={query} />
    </NextIntlClientProvider>,
  );
}

describe("public menu", () => {
  it("renders indexable cards, labelled filters, and URL-backed pagination", () => {
    renderMenu(content);
    expect(screen.getByRole("heading", { level: 1, name: "Our menu" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search dishes" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View dish: Fesenjan" })).toHaveAttribute(
      "href",
      "/menu/fesenjan",
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("href", "/menu?page=2");
    expect(screen.getByText("€12.00")).toBeInTheDocument();
  });

  it("renders recoverable no-results guidance for filtered searches", () => {
    renderMenu(
      { ...content, dishes: [], totalItems: 0, totalPages: 0 },
      parseMenuQuery({ q: "rare dish", view: "list" }),
    );
    expect(
      screen.getByRole("heading", { name: "No dishes match these filters" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear filters" })[0]).toHaveAttribute(
      "href",
      "/menu",
    );
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("aria-current", "page");
  });
});
