import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { HomePage } from "@/app/[locale]/(storefront)/home-page";
import type { HomeContent } from "@/app/[locale]/(storefront)/home-content";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";

describe("Home", () => {
  it("renders the published-content fallback when optional sections are absent", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
        <HomePage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "The warmth of Persian home cooking",
    );
    expect(screen.getByRole("link", { name: "Explore the menu" })).toHaveAttribute("href", "/menu");
    expect(screen.queryByRole("heading", { name: "Featured dishes" })).not.toBeInTheDocument();
  });

  it("renders configured sections, authoritative prices, and semantic links", () => {
    const content: HomeContent = {
      hero: [],
      banners: [],
      benefits: [],
      categories: [],
      testimonials: [],
      blogs: [],
      featured: [
        {
          id: "dish-1",
          slug: "fesenjan",
          name: "Fesenjan",
          excerpt: "Walnut stew",
          image: null,
          priceCents: 1200,
          originalPriceCents: null,
        },
      ],
      discounted: [
        {
          id: "dish-2",
          slug: "kuku-sabzi",
          name: "Kuku Sabzi",
          excerpt: "Herb omelette",
          image: null,
          priceCents: 450,
          originalPriceCents: 550,
        },
      ],
      titles: null,
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
        <HomePage content={content} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Featured dishes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today's offers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View dish: Fesenjan" })).toHaveAttribute(
      "href",
      "/menu/fesenjan",
    );
    expect(screen.getByText("€4.50")).toBeInTheDocument();
    expect(screen.getByText("€5.50")).toBeInTheDocument();
  });

  it("renders published editorial sections and keyboard-operable hero slides", () => {
    const image = { url: "https://example.test/food.jpg", alt: "Persian food" };
    const content: HomeContent = {
      hero: [
        {
          id: "first",
          title: "A taste of home",
          description: "First slide",
          ctaLabel: "See dishes",
          image,
          mobileImage: null,
          link: { href: "/menu", newTab: false },
        },
        {
          id: "second",
          title: "A table together",
          description: "Second slide",
          ctaLabel: "Our story",
          image,
          mobileImage: null,
          link: { href: "/about", newTab: false },
        },
      ],
      banners: [
        {
          id: "banner",
          title: "Weekend menu",
          image,
          link: { href: "https://example.test/weekend", newTab: true },
        },
      ],
      featured: [],
      discounted: [],
      benefits: [
        { id: "care", title: "Made with care", description: "Prepared in Porto", icon: null },
      ],
      categories: [{ id: "category", slug: "stews", name: "Stews", image }],
      testimonials: [
        {
          id: "review",
          author: "A guest",
          role: "",
          quote: "Lovely dinner",
          rating: 5,
          avatar: null,
        },
      ],
      blogs: [
        {
          id: "story",
          slug: "saffron",
          title: "About saffron",
          excerpt: "A kitchen story",
          image,
          readTimeMinutes: 4,
        },
      ],
      titles: null,
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
        <HomePage content={content} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "A taste of home" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByRole("heading", { level: 1, name: "A table together" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Our story" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: /Weekend menu/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: "Stews" })).toHaveAttribute(
      "href",
      "/menu/category/stews",
    );
    expect(screen.getByText("Made with care")).toBeInTheDocument();
    expect(screen.getByText("Lovely dinner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read story" })).toHaveAttribute(
      "href",
      "/blog/saffron",
    );
  });
});
