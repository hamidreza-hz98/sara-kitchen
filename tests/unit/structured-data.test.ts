import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createStructuredDataGraph,
  serializeStructuredData,
  structuredDataGraphSchema,
  type SeoMetadataRecord,
  type SeoStructuredDataType,
  type StructuredDataSite,
} from "@/server/modules/seo";

const site: StructuredDataSite = {
  url: "https://sarakitchen.pt",
  name: "Sara Kitchen",
  logoUrl: "https://sarakitchen.pt/brand/sara-kitchen-logo.png",
  email: "hello@sarakitchen.pt",
  telephone: "+351220000000",
  address: {
    streetAddress: "10 Rua das Flores",
    addressLocality: "Porto",
    addressRegion: "Porto",
    postalCode: "4000-001",
    addressCountry: "PT",
  },
  latitude: 41.1579,
  longitude: -8.6291,
  priceRange: "€€",
  servesCuisine: ["Persian"],
  sameAs: ["https://www.instagram.com/sara_kitchenpt"],
};

function record(
  types: readonly SeoStructuredDataType[],
  options: Readonly<{
    entityKind?: SeoMetadataRecord["entityKind"];
    path?: string;
    inputs?: Readonly<Record<string, unknown>>;
  }> = {},
): SeoMetadataRecord {
  return {
    path: options.path ?? "/",
    canonicalUrl: null,
    translations: [
      {
        locale: "en",
        title: "Fesenjan in Porto",
        description: "Homemade Persian walnut and pomegranate stew.",
        keywords: [],
        openGraph: { title: null, description: null },
        twitter: { title: null, description: null },
      },
      {
        locale: "fa",
        title: "فسنجان در پورتو",
        description: "خورش فسنجان خانگی با گردو و رب انار.",
        keywords: [],
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
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1,
    },
    openGraph: { type: "website", siteName: null },
    twitter: { card: "summary_large_image", creator: null, site: null },
    shareImageMediaId: null,
    structuredData: { types: [...types], inputs: { ...(options.inputs ?? {}) } },
    targetType: options.entityKind ? "entity" : "static",
    entityKind: options.entityKind ?? null,
  };
}

function node(graph: NonNullable<ReturnType<typeof createStructuredDataGraph>>, type: string) {
  return graph["@graph"].find((entry) => entry["@type"] === type);
}

describe("validated structured data", () => {
  it("generates Organization, WebSite and localized WebPage nodes", () => {
    const graph = createStructuredDataGraph(
      record(["organization", "website", "web-page"]),
      "fa",
      site,
    );
    expect(graph).not.toBeNull();
    expect(structuredDataGraphSchema.safeParse(graph).success).toBe(true);
    expect(node(graph!, "Organization")).toMatchObject({
      name: "Sara Kitchen",
      logo: "https://sarakitchen.pt/brand/sara-kitchen-logo.png",
    });
    expect(node(graph!, "WebPage")).toMatchObject({
      name: "فسنجان در پورتو",
      inLanguage: "fa",
    });
  });

  it.each([
    ["local-business", "LocalBusiness"],
    ["food-establishment", "FoodEstablishment"],
    ["restaurant", "Restaurant"],
  ] as const)("generates a truthful %s business fixture", (requested, expected) => {
    const graph = createStructuredDataGraph(record([requested]), "en", site);
    expect(structuredDataGraphSchema.safeParse(graph).success).toBe(true);
    expect(node(graph!, expected)).toMatchObject({
      telephone: "+351220000000",
      address: { addressLocality: "Porto", addressCountry: "PT" },
    });
  });

  it("generates Product, MenuItem, Offer and breadcrumbs for a priced dish", () => {
    const graph = createStructuredDataGraph(
      record(["web-page", "product", "menu-item", "breadcrumb-list"], {
        entityKind: "dish",
        path: "/menu/fesenjan",
        inputs: { priceCents: 1_400, currency: "EUR", availability: "available" },
      }),
      "en",
      site,
      {
        url: "https://media.sarakitchen.pt/fesenjan.jpg",
        alt: "A bowl of Fesenjan",
        width: 1200,
        height: 630,
      },
    );
    expect(structuredDataGraphSchema.safeParse(graph).success).toBe(true);
    expect(node(graph!, "Product")).toMatchObject({
      offers: { price: "14.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
    });
    expect(node(graph!, "MenuItem")).toBeDefined();
    expect(node(graph!, "BreadcrumbList")).toMatchObject({
      itemListElement: [{ position: 1 }, { position: 2, name: "Fesenjan in Porto" }],
    });
  });

  it("generates Article and FAQPage only from complete content", () => {
    const article = createStructuredDataGraph(
      record(["article"], {
        entityKind: "blog",
        path: "/blog/persian-food",
        inputs: {
          author: "Sara Kazemi",
          publishedAt: "2026-09-20T10:00:00.000Z",
          modifiedAt: "2026-09-21T10:00:00.000Z",
        },
      }),
      "en",
      site,
    );
    const faq = createStructuredDataGraph(
      record(["faq-page"], {
        path: "/faq",
        inputs: {
          faqs: [{ question: "Where do you deliver?", answer: "Throughout the city of Porto." }],
        },
      }),
      "en",
      site,
    );
    expect(structuredDataGraphSchema.safeParse(article).success).toBe(true);
    expect(node(article!, "Article")).toMatchObject({
      author: { name: "Sara Kazemi" },
      datePublished: "2026-09-20T10:00:00.000Z",
    });
    expect(structuredDataGraphSchema.safeParse(faq).success).toBe(true);
    expect(node(faq!, "FAQPage")).toMatchObject({
      mainEntity: [{ name: "Where do you deliver?" }],
    });
  });

  it("omits unsupported claims when required source data is absent", () => {
    const incompleteSite = { url: site.url, name: site.name };
    expect(createStructuredDataGraph(record(["restaurant"]), "en", incompleteSite)).toBeNull();
    expect(
      createStructuredDataGraph(
        record(["product"], { entityKind: "dish", inputs: { priceCents: 1_400 } }),
        "en",
        site,
      ),
    ).toBeNull();
    expect(
      createStructuredDataGraph(
        record(["article"], { entityKind: "blog", inputs: { author: "Sara Kazemi" } }),
        "en",
        site,
      ),
    ).toBeNull();
    expect(
      createStructuredDataGraph(
        record(["faq-page"], { inputs: { faqs: [{ question: "Question", answer: "" }] } }),
        "en",
        site,
      ),
    ).toBeNull();
  });

  it("escapes script-breaking content and rejects structurally invalid fixtures", () => {
    const graph = createStructuredDataGraph(
      {
        ...record(["web-page"]),
        translations: [
          {
            ...record(["web-page"]).translations[0]!,
            title: "Safe </script><script>alert(1)</script>",
          },
        ],
      },
      "en",
      site,
    );
    const serialized = serializeStructuredData(graph!);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
    expect(
      structuredDataGraphSchema.safeParse({
        "@context": "https://schema.org",
        "@graph": [{ "@type": "FAQPage", "@id": "javascript:alert(1)", mainEntity: [] }],
      }).success,
    ).toBe(false);
  });
});
