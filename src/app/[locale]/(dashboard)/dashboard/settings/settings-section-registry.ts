export const SETTINGS_PAGE_SECTIONS = [
  "homepage",
  "contact",
  "social",
  "about",
  "faq",
  "terms",
  "languages",
] as const;

export type SettingsPageSection = (typeof SETTINGS_PAGE_SECTIONS)[number];
export type SettingsPagePolicy = "direct" | "staged" | "versioned";

export type SettingsPageDefinition = Readonly<{
  key: SettingsPageSection;
  labelKey: SettingsPageSection;
  policy: SettingsPagePolicy;
  supportsMedia: boolean;
}>;

export const SETTINGS_PAGE_REGISTRY = Object.freeze({
  homepage: { key: "homepage", labelKey: "homepage", policy: "staged", supportsMedia: true },
  contact: { key: "contact", labelKey: "contact", policy: "direct", supportsMedia: false },
  social: { key: "social", labelKey: "social", policy: "direct", supportsMedia: false },
  about: { key: "about", labelKey: "about", policy: "staged", supportsMedia: true },
  faq: { key: "faq", labelKey: "faq", policy: "staged", supportsMedia: false },
  terms: { key: "terms", labelKey: "terms", policy: "versioned", supportsMedia: false },
  languages: { key: "languages", labelKey: "languages", policy: "direct", supportsMedia: false },
} as const satisfies Record<SettingsPageSection, SettingsPageDefinition>);

export function isSettingsPageSection(value: unknown): value is SettingsPageSection {
  return typeof value === "string" && (SETTINGS_PAGE_SECTIONS as readonly string[]).includes(value);
}

const EMPTY_RICH_TEXT = Object.freeze({
  schemaVersion: 1,
  document: { type: "doc", content: [] as unknown[] },
});

export function createInitialSettingsPayload(
  section: SettingsPageSection,
): Record<string, unknown> {
  if (section === "homepage") {
    return {
      data: {
        heroSlides: [],
        linkedBanners: [],
        featuredDishIds: [],
        benefits: [],
        testimonials: [],
        categoryBanners: [],
        discountedSection: { enabled: true, mode: "automatic", dishIds: [], limit: 6 },
        blogIds: [],
      },
      translations: [
        {
          locale: "en",
          value: {
            heroSlides: [],
            linkedBanners: [],
            benefits: [],
            testimonials: [],
            categoryBanners: [],
            sectionTitles: {
              featured: "Featured dishes",
              benefits: "Why Sara Kitchen",
              testimonials: "What guests say",
              categories: "Categories",
              discounted: "Special offers",
              blog: "From our kitchen",
            },
          },
        },
      ],
    };
  }
  if (section === "contact") {
    return {
      data: {
        phones: [
          {
            id: "main-mobile",
            kind: "mobile",
            number: "+351939086377",
            primary: true,
            public: true,
          },
        ],
        whatsapp: { enabled: true, number: "+351939086377" },
        email: "hello@sarakitchen.pt",
        address: { postalCode: "4000-008", countryCode: "PT" },
        location: { latitude: 41.1579, longitude: -8.6291 },
        serviceArea: { mode: "city", radiusKm: null },
        businessHours: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ].map((day) => ({ day, periods: [] })),
        timeZone: "Europe/Lisbon",
        map: { provider: "leaflet", zoom: 14, embedUrl: null, directionsUrl: null },
      },
      translations: [
        {
          locale: "en",
          value: {
            phoneLabels: [{ id: "main-mobile", label: "Mobile" }],
            address: {
              line1: "Sara Kitchen",
              line2: "",
              city: "Porto",
              region: "Porto",
              country: "Portugal",
            },
            serviceArea: { name: "Porto city", description: "Delivery throughout Porto city." },
            businessHoursNote: "Orders require 24 hours notice.",
            whatsappPrefilledMessage: "Hello Sara Kitchen",
            mapLabel: "Sara Kitchen location",
          },
        },
      ],
    };
  }
  if (section === "social") {
    return { data: { links: [] }, translations: [{ locale: "en", value: { labels: [] } }] };
  }
  if (section === "about") {
    return {
      data: {
        heroMediaId: null,
        kitchenMediaIds: [],
        teamMembers: [],
        values: [],
        storySections: [],
        callsToAction: [],
      },
      translations: [
        {
          locale: "en",
          value: {
            eyebrow: "Our kitchen",
            title: "Persian food, made with care",
            summary: "Sara Kitchen brings homemade Persian food to Porto.",
            content: EMPTY_RICH_TEXT,
            heroMediaAlt: "",
            kitchenMedia: [],
            teamMembers: [],
            values: [],
            storySections: [],
            callsToAction: [],
          },
        },
      ],
    };
  }
  if (section === "faq") {
    return {
      data: { entries: [] },
      translations: [
        {
          locale: "en",
          value: {
            title: "Frequently asked questions",
            description: "Answers about ordering from Sara Kitchen.",
            entries: [],
          },
        },
      ],
    };
  }
  if (section === "languages") {
    return {
      data: {
        locales: [
          { locale: "en", visibility: "active", order: 0 },
          { locale: "pt-PT", visibility: "active", order: 1 },
          { locale: "fa", visibility: "active", order: 2 },
        ],
        defaultLocale: "en",
        fallbackOrder: ["en", "pt-PT", "fa"],
      },
      translations: [
        {
          locale: "en",
          value: {
            displayNames: [
              { locale: "en", name: "English", shortName: "EN" },
              { locale: "pt-PT", name: "Portuguese", shortName: "PT" },
              { locale: "fa", name: "Persian", shortName: "FA" },
            ],
          },
        },
      ],
    };
  }
  return {
    documentType: "terms-of-service",
    version: 1,
    effectiveAt: new Date().toISOString().slice(0, 10),
    sectionIds: ["introduction"],
    translations: [
      {
        locale: "en",
        title: "Terms of service",
        summary: "Terms for ordering from Sara Kitchen.",
        sections: [
          {
            id: "introduction",
            title: "Introduction",
            content: EMPTY_RICH_TEXT,
          },
        ],
      },
    ],
  };
}
