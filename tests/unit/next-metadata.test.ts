import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createFallbackNextMetadata,
  createNextMetadata,
  type SeoMetadataRecord,
  type SeoSiteMetadataSettings,
} from "@/server/modules/seo";

const settings: SeoSiteMetadataSettings = {
  siteUrl: "https://sarakitchen.pt",
  siteName: "Sara Kitchen Porto",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

const record: SeoMetadataRecord = {
  path: "/menu/fesenjan",
  canonicalUrl: null,
  translations: [
    {
      locale: "en",
      title: "Fesenjan in Porto",
      description: "Order homemade Persian walnut stew.",
      keywords: ["Fesenjan", "Persian food"],
      openGraph: { title: "Fresh Fesenjan", description: null },
      twitter: { title: null, description: "Persian food delivered in Porto." },
    },
    {
      locale: "fa",
      title: "فسنجان در پورتو",
      description: "خورش فسنجان خانگی سفارش دهید.",
      keywords: ["فسنجان"],
      openGraph: { title: null, description: null },
      twitter: { title: null, description: null },
    },
  ],
  robots: {
    index: true,
    follow: true,
    noArchive: false,
    noImageIndex: false,
    noSnippet: false,
    maxSnippet: 180,
    maxImagePreview: "large",
    maxVideoPreview: 0,
  },
  openGraph: { type: "product", siteName: null },
  twitter: { card: "summary_large_image", site: "@sarakitchenpt", creator: null },
  shareImageMediaId: "507f1f77bcf86cd799439011",
};

describe("Next.js SEO metadata mapping", () => {
  it("maps localized SEO, robots, alternates, social cards, settings, icons, and media", () => {
    const metadata = createNextMetadata(record, "fa", settings, {
      url: "https://media.example/fesenjan.jpg",
      alt: "کاسه فسنجان",
      width: 1200,
      height: 630,
    });

    expect(metadata).toMatchObject({
      applicationName: "Sara Kitchen Porto",
      title: "فسنجان در پورتو",
      description: "خورش فسنجان خانگی سفارش دهید.",
      keywords: ["فسنجان"],
      alternates: {
        canonical: "https://sarakitchen.pt/menu/fesenjan",
        languages: {
          en: "https://sarakitchen.pt/menu/fesenjan",
          fa: "https://sarakitchen.pt/menu/fesenjan",
          "x-default": "https://sarakitchen.pt/menu/fesenjan",
        },
      },
      robots: {
        index: true,
        follow: true,
        "max-snippet": 180,
        "max-image-preview": "large",
        googleBot: { "max-video-preview": 0 },
      },
      openGraph: {
        type: "product",
        locale: "fa",
        alternateLocale: ["en"],
        siteName: "Sara Kitchen Porto",
        title: "فسنجان در پورتو",
        images: [
          {
            url: "https://media.example/fesenjan.jpg",
            alt: "کاسه فسنجان",
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        site: "@sarakitchenpt",
        title: "فسنجان در پورتو",
        images: [{ url: "https://media.example/fesenjan.jpg" }],
      },
      icons: settings.icons,
    });
  });

  it("uses English content when a requested translation is missing", () => {
    const metadata = createNextMetadata(
      { ...record, canonicalUrl: "https://sarakitchen.pt/special-fesenjan" },
      "pt-PT",
      settings,
    );
    expect(metadata.title).toBe("Fesenjan in Porto");
    expect(metadata.alternates?.canonical).toBe("https://sarakitchen.pt/special-fesenjan");
    expect(metadata.openGraph).toMatchObject({
      locale: "en",
      title: "Fresh Fesenjan",
      description: "Order homemade Persian walnut stew.",
    });
    expect(metadata.twitter).toMatchObject({
      title: "Fresh Fesenjan",
      description: "Persian food delivered in Porto.",
    });
  });

  it("builds complete localized defaults when persistence is unavailable", () => {
    const metadata = createFallbackNextMetadata(
      "/about",
      "pt-PT",
      { title: "Sobre nós", description: "A história da Sara Kitchen." },
      settings,
    );
    expect(metadata).toMatchObject({
      title: "Sobre nós",
      alternates: {
        canonical: "https://sarakitchen.pt/about",
        languages: {
          en: "https://sarakitchen.pt/about",
          "pt-PT": "https://sarakitchen.pt/about",
          fa: "https://sarakitchen.pt/about",
        },
      },
      openGraph: { locale: "pt_PT", type: "website" },
      twitter: { card: "summary_large_image" },
    });
  });
});
