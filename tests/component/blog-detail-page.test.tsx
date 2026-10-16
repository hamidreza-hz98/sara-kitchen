import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { BlogDetailPage } from "@/app/[locale]/(storefront)/blog/[blogSlug]/blog-detail-page";
import type { BlogDetailContent } from "@/app/[locale]/(storefront)/blog/[blogSlug]/blog-detail-content";
import { PROJECT_TIME_ZONE } from "@/constants";
import en from "@/locales/messages/en";
import fa from "@/locales/messages/fa";
import pt from "@/locales/messages/pt-PT";

const article: BlogDetailContent = {
  id: "a".repeat(24),
  slug: "saffron-rice",
  title: "Saffron rice",
  excerpt: "A Persian classic",
  author: "Chef Sara",
  publishedAt: "2026-10-01T12:00:00.000Z",
  readTimeMinutes: 6,
  banner: null,
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "<img src=x onerror=alert(1)>",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  },
  embeddedMedia: {},
  relatedDishes: [{ slug: "kebab", name: "Kebab", image: null, priceCents: 1400 }],
  relatedBlogs: [{ slug: "herbs", title: "Persian herbs", image: null, readTimeMinutes: 4 }],
  canonicalUrl: "https://sarakitchen.example/blog/saffron-rice",
};

describe("public blog detail", () => {
  it.each([
    ["en", en],
    ["pt-PT", pt],
    ["fa", fa],
  ] as const)("renders published article content safely in %s", (locale, messages) => {
    const { container, unmount } = render(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
        <BlogDetailPage article={article} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Saffron rice" })).toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(container.querySelector("img[src='x'], script, a[href^='javascript:']")).toBeNull();
    expect(container.querySelector('a[href="/menu/kebab"]')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Persian herbs/u })).toHaveAttribute(
      "href",
      "/blog/herbs",
    );
    unmount();
  });
});
