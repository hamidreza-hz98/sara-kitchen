import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { DishDetailPage } from "@/app/[locale]/(storefront)/menu/[dishSlug]/dish-detail-page";
import {
  DishGallery,
  DishPurchase,
} from "@/app/[locale]/(storefront)/menu/[dishSlug]/dish-interactions";
import type { DishDetailContent } from "@/app/[locale]/(storefront)/menu/[dishSlug]/dish-detail-content";
import { PROJECT_TIME_ZONE } from "@/constants";
import { CartContext, type CartContextValue } from "@/hooks/cart-context";
import messages from "@/locales/messages/en";

const dish: DishDetailContent = {
  id: "dish-id",
  slug: "fesenjan",
  name: "Fesenjan",
  excerpt: "Walnut stew",
  description: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Slow-cooked Persian food." }] },
    ],
  },
  images: [
    { url: "https://example.test/one.jpg", alt: "Fesenjan first view" },
    { url: "https://example.test/two.jpg", alt: "Fesenjan second view" },
  ],
  category: { slug: "stews", name: "Stews" },
  priceCents: 1200,
  basePriceCents: 1400,
  discount: { amountCents: 200, percentage: null },
  isOrderable: true,
  leadTimeMinutes: 90,
  maxQuantity: 3,
  portion: { amount: 1, unit: "serving" },
  ingredients: [
    { name: "Walnut", note: "Ground", image: null, quantityAmount: 100, quantityUnit: "gram" },
  ],
  allergens: { contains: ["tree_nuts"], mayContain: [] },
  dietaryTags: [],
  specifications: [{ label: "Origin", value: "Persian" }],
  relatedDishes: [
    {
      slug: "kuku-sabzi",
      name: "Kuku Sabzi",
      excerpt: "Herb omelette",
      image: null,
      priceCents: 550,
    },
  ],
  relatedBlogs: [
    {
      slug: "persian-rice",
      title: "Persian rice",
      excerpt: "How to cook rice",
      image: null,
      readTimeMinutes: 5,
    },
  ],
};

function wrap(component: React.ReactNode, addItem = vi.fn(async () => undefined)) {
  const cart: CartContextValue = {
    addItem,
    cart: null,
    clearCart: vi.fn(async () => undefined),
    clearError: vi.fn(),
    error: null,
    itemCount: 0,
    pendingDishIds: new Set(),
    refresh: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    setNotes: vi.fn(async () => undefined),
    status: "ready",
    updateQuantity: vi.fn(async () => undefined),
  };
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <CartContext.Provider value={cart}>{component}</CartContext.Provider>
    </NextIntlClientProvider>,
  );
  return addItem;
}

describe("dish details", () => {
  it("renders the visible price, content, relations, and semantic breadcrumbs", () => {
    wrap(<DishDetailPage dish={dish} />);
    expect(screen.getByRole("heading", { level: 1, name: "Fesenjan" })).toBeInTheDocument();
    expect(screen.getByText("€12.00")).toBeInTheDocument();
    expect(screen.getByText("€14.00")).toBeInTheDocument();
    expect(screen.getByText("Slow-cooked Persian food.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stews" })).toHaveAttribute(
      "href",
      "/menu/category/stews",
    );
    expect(screen.getByRole("link", { name: "View dish: Kuku Sabzi" })).toHaveAttribute(
      "href",
      "/menu/kuku-sabzi",
    );
    expect(screen.getByRole("link", { name: "Read post: Persian rice" })).toHaveAttribute(
      "href",
      "/blog/persian-rice",
    );
  });

  it("allows keyboard gallery navigation and thumbnail selection", () => {
    wrap(<DishGallery images={dish.images} name={dish.name} />);
    expect(screen.getByRole("button", { name: "Open image 1 of Fesenjan" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("region", { name: "Dish gallery" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Open image 2 of Fesenjan" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show image 1" }));
    expect(screen.getByRole("button", { name: "Show image 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open image 1 of Fesenjan" }));
    expect(screen.getByRole("dialog", { name: "Full-screen dish gallery" })).toBeInTheDocument();
  });

  it("uses bounded quantity and the authoritative cart operation", async () => {
    const addItem = vi.fn(async () => undefined);
    wrap(<DishPurchase dish={dish} />, addItem);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(addItem).toHaveBeenCalledWith("dish-id", 2));
    expect(await screen.findByText("Added to your cart.")).toBeInTheDocument();
  });

  it("does not offer ordering for temporarily unavailable published dishes", () => {
    wrap(<DishPurchase dish={{ ...dish, isOrderable: false }} />);
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByText("Currently unavailable")).toBeInTheDocument();
  });
});
