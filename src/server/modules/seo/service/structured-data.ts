import "server-only";

import { z } from "zod";

import { resolveTranslation } from "@/locales/translation-selection";
import type { SupportedLocale } from "@/constants";

import type { SeoMetadataImage } from "./next-metadata";
import type { SeoMetadataRecord } from "../repository/metadata-read";

const absoluteHttpUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});
const nonEmpty = z.string().trim().min(1);
const countryCode = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/u);

const postalAddressSchema = z.strictObject({
  "@type": z.literal("PostalAddress"),
  streetAddress: nonEmpty,
  addressLocality: nonEmpty,
  addressRegion: nonEmpty.optional(),
  postalCode: nonEmpty,
  addressCountry: countryCode,
});
const offerSchema = z.strictObject({
  "@type": z.literal("Offer"),
  price: z.string().regex(/^\d+\.\d{2}$/u),
  priceCurrency: z.string().regex(/^[A-Z]{3}$/u),
  availability: absoluteHttpUrl,
  url: absoluteHttpUrl,
});
const imageSchema = z.strictObject({
  "@type": z.literal("ImageObject"),
  url: absoluteHttpUrl,
  caption: nonEmpty.optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const organizationSchema = z.strictObject({
  "@type": z.literal("Organization"),
  "@id": absoluteHttpUrl,
  name: nonEmpty,
  url: absoluteHttpUrl,
  logo: absoluteHttpUrl.optional(),
  email: z.email().optional(),
  telephone: nonEmpty.optional(),
  sameAs: z.array(absoluteHttpUrl).min(1).optional(),
});
const businessShape = {
  "@id": absoluteHttpUrl,
  name: nonEmpty,
  url: absoluteHttpUrl,
  address: postalAddressSchema,
  telephone: nonEmpty,
  email: z.email().optional(),
  image: absoluteHttpUrl.optional(),
  priceRange: nonEmpty.optional(),
  geo: z
    .strictObject({
      "@type": z.literal("GeoCoordinates"),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  sameAs: z.array(absoluteHttpUrl).min(1).optional(),
};
const localBusinessSchema = z.strictObject({
  "@type": z.literal("LocalBusiness"),
  ...businessShape,
});
const foodEstablishmentSchema = z.strictObject({
  "@type": z.literal("FoodEstablishment"),
  ...businessShape,
  servesCuisine: z.array(nonEmpty).min(1).optional(),
});
const restaurantSchema = z.strictObject({
  "@type": z.literal("Restaurant"),
  ...businessShape,
  servesCuisine: z.array(nonEmpty).min(1),
});
const productSchema = z.strictObject({
  "@type": z.literal("Product"),
  "@id": absoluteHttpUrl,
  name: nonEmpty,
  description: nonEmpty,
  url: absoluteHttpUrl,
  brand: z.strictObject({ "@id": absoluteHttpUrl }),
  image: imageSchema.optional(),
  offers: offerSchema,
});
const menuItemSchema = z.strictObject({
  "@type": z.literal("MenuItem"),
  "@id": absoluteHttpUrl,
  name: nonEmpty,
  description: nonEmpty,
  url: absoluteHttpUrl,
  image: imageSchema.optional(),
  offers: offerSchema,
});
const articleSchema = z.strictObject({
  "@type": z.literal("Article"),
  "@id": absoluteHttpUrl,
  headline: nonEmpty,
  description: nonEmpty,
  url: absoluteHttpUrl,
  mainEntityOfPage: z.strictObject({ "@id": absoluteHttpUrl }),
  author: z.strictObject({ "@type": z.literal("Person"), name: nonEmpty }),
  publisher: z.strictObject({ "@id": absoluteHttpUrl }),
  datePublished: z.iso.datetime({ offset: true }),
  dateModified: z.iso.datetime({ offset: true }).optional(),
  image: imageSchema.optional(),
});
const breadcrumbSchema = z
  .strictObject({
    "@type": z.literal("BreadcrumbList"),
    "@id": absoluteHttpUrl,
    itemListElement: z
      .array(
        z.strictObject({
          "@type": z.literal("ListItem"),
          position: z.number().int().positive(),
          name: nonEmpty,
          item: absoluteHttpUrl,
        }),
      )
      .min(2),
  })
  .superRefine((value, context) => {
    value.itemListElement.forEach((item, index) => {
      if (item.position !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["itemListElement", index, "position"],
          message: "Breadcrumb positions must be consecutive and one-based.",
        });
      }
    });
  });
const faqSchema = z.strictObject({
  "@type": z.literal("FAQPage"),
  "@id": absoluteHttpUrl,
  mainEntity: z
    .array(
      z.strictObject({
        "@type": z.literal("Question"),
        name: nonEmpty,
        acceptedAnswer: z.strictObject({
          "@type": z.literal("Answer"),
          text: nonEmpty,
        }),
      }),
    )
    .min(1),
});
const webPageSchema = z.strictObject({
  "@type": z.literal("WebPage"),
  "@id": absoluteHttpUrl,
  url: absoluteHttpUrl,
  name: nonEmpty,
  description: nonEmpty,
  inLanguage: nonEmpty,
  isPartOf: z.strictObject({ "@id": absoluteHttpUrl }),
  primaryImageOfPage: imageSchema.optional(),
});
const webSiteSchema = z.strictObject({
  "@type": z.literal("WebSite"),
  "@id": absoluteHttpUrl,
  url: absoluteHttpUrl,
  name: nonEmpty,
  inLanguage: z.array(nonEmpty).min(1),
  publisher: z.strictObject({ "@id": absoluteHttpUrl }),
});
const menuSchema = z.strictObject({
  "@type": z.literal("Menu"),
  "@id": absoluteHttpUrl,
  name: nonEmpty,
  description: nonEmpty,
  url: absoluteHttpUrl,
  inLanguage: nonEmpty,
});

const structuredNodeSchema = z.union([
  organizationSchema,
  localBusinessSchema,
  foodEstablishmentSchema,
  restaurantSchema,
  productSchema,
  menuItemSchema,
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  webPageSchema,
  webSiteSchema,
  menuSchema,
]);

export const structuredDataGraphSchema = z.strictObject({
  "@context": z.literal("https://schema.org"),
  "@graph": z.array(structuredNodeSchema).min(1),
});

export type StructuredDataGraph = z.infer<typeof structuredDataGraphSchema>;
export type StructuredDataAddress = Readonly<{
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode: string;
  addressCountry: string;
}>;
export type StructuredDataSite = Readonly<{
  url: string;
  name: string;
  logoUrl?: string;
  email?: string;
  telephone?: string;
  address?: StructuredDataAddress;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  priceRange?: string;
  servesCuisine?: readonly string[];
  sameAs?: readonly string[];
}>;

type Inputs = Readonly<Record<string, unknown>>;

function optionalString(inputs: Inputs, key: string): string | undefined {
  const value = inputs[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function validDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function imageNode(image: SeoMetadataImage | null): z.infer<typeof imageSchema> | undefined {
  if (!image || !absoluteHttpUrl.safeParse(image.url).success) return undefined;
  return {
    "@type": "ImageObject",
    url: image.url,
    ...(image.alt?.trim() ? { caption: image.alt.trim() } : {}),
    ...(image.width === undefined ? {} : { width: image.width }),
    ...(image.height === undefined ? {} : { height: image.height }),
  };
}

function addressNode(site: StructuredDataSite): z.infer<typeof postalAddressSchema> | null {
  const parsed = postalAddressSchema.safeParse(
    site.address ? { "@type": "PostalAddress", ...site.address } : null,
  );
  return parsed.success ? parsed.data : null;
}

function organizationNode(site: StructuredDataSite): z.infer<typeof organizationSchema> | null {
  const candidate = {
    "@type": "Organization" as const,
    "@id": new URL("/#organization", site.url).toString(),
    name: site.name,
    url: site.url,
    ...(site.logoUrl ? { logo: site.logoUrl } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(site.telephone ? { telephone: site.telephone } : {}),
    ...(site.sameAs?.length ? { sameAs: [...site.sameAs] } : {}),
  };
  const parsed = organizationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function businessNode(
  kind: "LocalBusiness" | "FoodEstablishment" | "Restaurant",
  site: StructuredDataSite,
):
  | z.infer<typeof localBusinessSchema>
  | z.infer<typeof foodEstablishmentSchema>
  | z.infer<typeof restaurantSchema>
  | null {
  const address = addressNode(site);
  if (!address || !site.telephone?.trim()) return null;
  const candidate = {
    "@type": kind,
    "@id": new URL("/#business", site.url).toString(),
    name: site.name,
    url: site.url,
    address,
    telephone: site.telephone.trim(),
    ...(site.email ? { email: site.email } : {}),
    ...(site.imageUrl ? { image: site.imageUrl } : {}),
    ...(site.priceRange ? { priceRange: site.priceRange } : {}),
    ...(site.sameAs?.length ? { sameAs: [...site.sameAs] } : {}),
    ...(site.latitude !== undefined && site.longitude !== undefined
      ? {
          geo: {
            "@type": "GeoCoordinates" as const,
            latitude: site.latitude,
            longitude: site.longitude,
          },
        }
      : {}),
    ...(kind !== "LocalBusiness" && site.servesCuisine?.length
      ? { servesCuisine: [...site.servesCuisine] }
      : {}),
  };
  const schema =
    kind === "Restaurant"
      ? restaurantSchema
      : kind === "FoodEstablishment"
        ? foodEstablishmentSchema
        : localBusinessSchema;
  const parsed = schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function availabilityUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (["available", "in-stock", "instock"].includes(normalized)) {
    return "https://schema.org/InStock";
  }
  if (["scheduled", "preorder", "pre-order"].includes(normalized)) {
    return "https://schema.org/PreOrder";
  }
  if (["unavailable", "out-of-stock", "outofstock"].includes(normalized)) {
    return "https://schema.org/OutOfStock";
  }
  return null;
}

function offer(inputs: Inputs, pageUrl: string): z.infer<typeof offerSchema> | null {
  const cents = inputs.priceCents;
  const currency = optionalString(inputs, "currency")?.toUpperCase();
  const availability = availabilityUrl(inputs.availability);
  if (
    typeof cents !== "number" ||
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !currency ||
    !/^[A-Z]{3}$/u.test(currency) ||
    !availability
  ) {
    return null;
  }
  return {
    "@type": "Offer",
    price: (cents / 100).toFixed(2),
    priceCurrency: currency,
    availability,
    url: pageUrl,
  };
}

function faqs(inputs: Inputs): z.infer<typeof faqSchema>["mainEntity"] | null {
  const source = inputs.faqs;
  if (!Array.isArray(source) || source.length === 0) return null;
  const result = source.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const question =
      "question" in entry && typeof entry.question === "string" ? entry.question : "";
    const answer = "answer" in entry && typeof entry.answer === "string" ? entry.answer : "";
    if (!question.trim() || !answer.trim()) return [];
    return [
      {
        "@type": "Question" as const,
        name: question.trim(),
        acceptedAnswer: { "@type": "Answer" as const, text: answer.trim() },
      },
    ];
  });
  return result.length === source.length && result.length > 0 ? result : null;
}

/** Build only schema nodes whose required source data is complete and truthful. */
export function createStructuredDataGraph(
  record: SeoMetadataRecord,
  locale: SupportedLocale,
  site: StructuredDataSite,
  image: SeoMetadataImage | null = null,
): StructuredDataGraph | null {
  const selection = resolveTranslation(record.translations, locale);
  if (!selection) return null;
  const pageUrl = record.canonicalUrl ?? new URL(record.path, site.url).toString();
  if (!absoluteHttpUrl.safeParse(pageUrl).success) return null;
  const title = selection.value.title.trim();
  const description = selection.value.description.trim();
  const requested = new Set(record.structuredData.types);
  const inputs = record.structuredData.inputs;
  const imageValue = imageNode(image);
  const nodes: z.input<typeof structuredNodeSchema>[] = [];
  const organizationId = new URL("/#organization", site.url).toString();
  const websiteId = new URL("/#website", site.url).toString();

  if (requested.has("website")) {
    nodes.push({
      "@type": "WebSite",
      "@id": websiteId,
      url: site.url,
      name: site.name,
      inLanguage: record.translations.map((entry) => entry.locale),
      publisher: { "@id": organizationId },
    });
  }
  if (requested.has("web-page")) {
    nodes.push({
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: selection.resolvedLocale,
      isPartOf: { "@id": websiteId },
      ...(imageValue ? { primaryImageOfPage: imageValue } : {}),
    });
  }

  const business = requested.has("restaurant")
    ? businessNode("Restaurant", site)
    : requested.has("food-establishment")
      ? businessNode("FoodEstablishment", site)
      : requested.has("local-business")
        ? businessNode("LocalBusiness", site)
        : null;
  if (business) nodes.push(business);
  else if (requested.has("organization")) {
    const organization = organizationNode(site);
    if (organization) nodes.push(organization);
  }

  if (requested.has("menu")) {
    nodes.push({
      "@type": "Menu",
      "@id": `${pageUrl}#menu`,
      name: title,
      description,
      url: pageUrl,
      inLanguage: selection.resolvedLocale,
    });
  }

  const offerValue = offer(inputs, pageUrl);
  if (record.entityKind === "dish" && offerValue) {
    const common = {
      "@id": `${pageUrl}#dish`,
      name: title,
      description,
      url: pageUrl,
      ...(imageValue ? { image: imageValue } : {}),
      offers: offerValue,
    };
    if (requested.has("product")) {
      nodes.push({ "@type": "Product", ...common, brand: { "@id": organizationId } });
    }
    if (requested.has("menu-item")) nodes.push({ "@type": "MenuItem", ...common });
  }

  if (record.entityKind === "blog" && requested.has("article")) {
    const author = optionalString(inputs, "author");
    const publishedAt = validDate(optionalString(inputs, "publishedAt"));
    const modifiedAt = validDate(optionalString(inputs, "modifiedAt"));
    if (author && publishedAt) {
      nodes.push({
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: title,
        description,
        url: pageUrl,
        mainEntityOfPage: { "@id": `${pageUrl}#webpage` },
        author: { "@type": "Person", name: author },
        publisher: { "@id": organizationId },
        datePublished: publishedAt,
        ...(modifiedAt ? { dateModified: modifiedAt } : {}),
        ...(imageValue ? { image: imageValue } : {}),
      });
    }
  }

  if (requested.has("breadcrumb-list") && record.path !== "/") {
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: site.name, item: site.url },
        { "@type": "ListItem", position: 2, name: title, item: pageUrl },
      ],
    });
  }

  if (requested.has("faq-page")) {
    const questions = faqs(inputs);
    if (questions) {
      nodes.push({
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: questions,
      });
    }
  }

  if (nodes.length === 0) return null;
  return structuredDataGraphSchema.parse({ "@context": "https://schema.org", "@graph": nodes });
}

export function serializeStructuredData(graph: StructuredDataGraph): string {
  return JSON.stringify(graph)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
