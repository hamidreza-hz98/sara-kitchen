import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ContactPage } from "@/app/[locale]/(storefront)/contact/contact-page";
import { PROJECT_TIME_ZONE } from "@/constants";
import type { ContactPageData } from "@/app/[locale]/(storefront)/contact/contact-data";
import en from "@/locales/messages/en";
import fa from "@/locales/messages/fa";
import pt from "@/locales/messages/pt-PT";

describe("Contact page", () => {
  for (const { locale, messages, title } of [
    { locale: "en", messages: en, title: "Get in touch" },
    { locale: "pt-PT", messages: pt, title: "Entre em contacto" },
    { locale: "fa", messages: fa, title: "تماس با ما" },
  ] as const) {
    it(`shows the ${locale} form without inventing contact settings`, () => {
      const { unmount } = render(
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
          <ContactPage data={{ contact: null, social: null }} />
        </NextIntlClientProvider>,
      );
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByRole("form")).toHaveAttribute("action", "/api/contact-submissions/form");
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
      expect(screen.queryByRole("iframe")).not.toBeInTheDocument();
      unmount();
    });
  }

  it("renders published contact settings, hours, social links and attributed map", () => {
    const data: ContactPageData = {
      contact: {
        locale: { requested: "en", resolved: "en", isFallback: false },
        phones: [{ kind: "mobile", label: "Mobile", number: "+351912345678", primary: true }],
        whatsapp: { number: "+351912345678", prefilledMessage: "Hello" },
        email: "hello@sarakitchen.pt",
        address: {
          line1: "Rua da Cozinha 1",
          line2: "",
          city: "Porto",
          region: "",
          postalCode: "4000-100",
          country: "Portugal",
          countryCode: "PT",
        },
        location: { latitude: 41.15, longitude: -8.61 },
        serviceArea: { mode: "city", radiusKm: null, name: "Porto", description: "City delivery" },
        deliveryBands: [],
        businessHours: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ].map((day) => ({
          day: day as "monday",
          periods: day === "monday" ? [{ opensAt: "09:00", closesAt: "17:00" }] : [],
        })),
        businessHoursNote: "",
        timeZone: "Europe/Lisbon",
        map: {
          provider: "leaflet",
          zoom: 13,
          embedUrl: null,
          directionsUrl: null,
          label: "Sara Kitchen map",
        },
      },
      social: {
        locale: { requested: "en", resolved: "en", isFallback: false },
        links: [
          {
            platform: "instagram",
            label: "Instagram",
            href: "https://www.instagram.com/sara",
            iconKey: "instagram",
            order: 0,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        ],
      },
    };
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone={PROJECT_TIME_ZONE}>
        <ContactPage data={data} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("link", { name: /Mobile/iu })).toHaveAttribute(
      "href",
      "tel:+351912345678",
    );
    expect(screen.getByRole("link", { name: /hello@sarakitchen.pt/iu })).toHaveAttribute(
      "href",
      "mailto:hello@sarakitchen.pt",
    );
    expect(screen.getByRole("link", { name: /Instagram/iu })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByTitle("Sara Kitchen map")).toHaveAttribute(
      "src",
      expect.stringContaining("openstreetmap.org"),
    );
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
    expect(screen.getByText("Map data © OpenStreetMap contributors")).toBeInTheDocument();
  });
});
