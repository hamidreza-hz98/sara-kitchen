import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { AboutPage } from "@/app/[locale]/(storefront)/about/about-page";
import type { AboutContent } from "@/app/[locale]/(storefront)/about/about-content";
import { PROJECT_TIME_ZONE } from "@/constants";
import en from "@/locales/messages/en";
import fa from "@/locales/messages/fa";
import pt from "@/locales/messages/pt-PT";

const fixtures = [
  {
    locale: "en",
    messages: en,
    title: "Our Story",
    action: "Explore the menu",
  },
  {
    locale: "pt-PT",
    messages: pt,
    title: "A nossa história",
    action: "Explorar a ementa",
  },
  { locale: "fa", messages: fa, title: "داستان ما", action: "مشاهده منو" },
] as const;

describe("About page", () => {
  for (const fixture of fixtures) {
    it(`renders a complete no-media ${fixture.locale} fallback`, () => {
      const { unmount } = render(
        <NextIntlClientProvider
          locale={fixture.locale}
          messages={fixture.messages}
          timeZone={PROJECT_TIME_ZONE}
        >
          <AboutPage content={null} />
        </NextIntlClientProvider>,
      );
      expect(screen.getByRole("heading", { level: 1, name: fixture.title })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: fixture.action })).toHaveAttribute("href", "/menu");
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
      unmount();
    });
  }

  it("renders published story, team, values, and safe calls to action without images", () => {
    const content: AboutContent = {
      eyebrow: "Our kitchen",
      title: "Sara's story",
      summary: "Persian home cooking in Porto",
      story: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "A genuine story" }],
          },
        ],
      },
      hero: null,
      kitchen: [],
      values: [
        {
          id: "care",
          title: "Care",
          description: "Made with care",
          icon: null,
        },
      ],
      sections: [],
      team: [
        {
          id: "sara",
          name: "Sara Kazemi",
          role: "Chef",
          bio: "",
          portrait: null,
        },
      ],
      actions: [
        {
          id: "menu",
          label: "See menu",
          href: "/menu",
          newTab: false,
          variant: "primary",
        },
      ],
      embeddedMedia: {},
    };
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone={PROJECT_TIME_ZONE}>
        <AboutPage content={content} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sara's story" })).toBeInTheDocument();
    expect(screen.getByText("A genuine story")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Care" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sara Kazemi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See menu" })).toHaveAttribute("href", "/menu");
  });
});
