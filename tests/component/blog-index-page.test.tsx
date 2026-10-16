import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { BlogIndexPage } from "@/app/[locale]/(storefront)/blog/blog-page";
import type { BlogIndexContent } from "@/app/[locale]/(storefront)/blog/blog-data";
import type { BlogQuery } from "@/app/[locale]/(storefront)/blog/blog-query";
import { PROJECT_TIME_ZONE } from "@/constants";
import en from "@/locales/messages/en";
import fa from "@/locales/messages/fa";
import pt from "@/locales/messages/pt-PT";

const query: BlogQuery = { search: "", sort: "newest", view: "grid", page: 1 };

function page(
  locale: "en" | "pt-PT" | "fa",
  messages: typeof en,
  content: BlogIndexContent,
  current = query,
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <BlogIndexPage content={content} query={current} />
    </NextIntlClientProvider>,
  );
}

describe("public blog index", () => {
  it.each([
    ["en", en, "Stories from Sara Kitchen"],
    ["pt-PT", pt, "Histórias da Sara Kitchen"],
    ["fa", fa, "داستان‌های آشپزخانه سارا"],
  ] as const)("renders a localized empty state in %s", (locale, messages, title) => {
    const { unmount } = page(locale, messages, { items: [], total: 0, totalPages: 0 });
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.storefront.blog.clearFilters }),
    ).toHaveAttribute("href", "/blog");
    unmount();
  });

  it("renders story cards, query controls, and accessible pagination", () => {
    const content: BlogIndexContent = {
      items: [
        {
          slug: "saffron-story",
          title: "Saffron story",
          excerpt: "A Persian favorite",
          image: null,
          author: "Sara",
          publishedAt: "2026-10-01T12:00:00.000Z",
          readTimeMinutes: 5,
          tags: ["ingredients"],
        },
      ],
      total: 19,
      totalPages: 3,
    };
    page("en", en, content);
    expect(screen.getAllByRole("link", { name: /Saffron story/u })).toHaveLength(2);
    expect(screen.getByRole("searchbox", { name: "Search stories" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("href", "/blog?page=2");
  });
});
