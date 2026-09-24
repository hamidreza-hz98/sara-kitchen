import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import type { BlogSnapshot } from "@/server/modules/blogs";
import type { CategorySnapshot } from "@/server/modules/categories";
import type { DishSnapshot } from "@/server/modules/dishes";

import {
  getPageSeoModel,
  type PageSeoTranslation,
  type SeoEntityKind,
  type SeoManualOverrides,
  type SeoManualTranslationField,
  type SeoOpenGraphType,
  type SeoStructuredData,
} from "../model/page-seo";

type GeneratedTranslation = Readonly<{
  locale: SupportedLocale;
  title: string;
  description: string;
  keywords: readonly string[];
}>;

type GeneratedEntitySeo = Readonly<{
  active: boolean;
  canonicalUrl: string | null;
  entityId: string;
  entityKind: SeoEntityKind;
  openGraphType: SeoOpenGraphType;
  path: string;
  shareImageMediaId: string | null;
  slug: string;
  structuredData: SeoStructuredData;
  translations: readonly GeneratedTranslation[];
}>;

export type AutomaticSeoSynchronizer = Readonly<{
  category(category: CategorySnapshot): Promise<string>;
  dish(dish: DishSnapshot): Promise<string>;
  blog(blog: BlogSnapshot): Promise<string>;
  remove(entityKind: SeoEntityKind, entityId: string): Promise<void>;
}>;

export class AutomaticSeoError extends Error {
  constructor(
    readonly code: "invalid_site_url" | "persistence_failed",
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AutomaticSeoError";
  }
}

function text(value: string | undefined, fallback: string, maximum: number): string {
  const normalized = (value ?? fallback)
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized.slice(0, maximum).trim() || fallback.slice(0, maximum).trim();
}

function keywords(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim().slice(0, 60);
    const key = value.toLocaleLowerCase("en");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length === 20) break;
  }
  return result;
}

function canonical(siteUrl: URL, path: string): string | null {
  return siteUrl.protocol === "https:" ? new URL(path, siteUrl).toString() : null;
}

function categoryDefaults(category: CategorySnapshot, siteUrl: URL): GeneratedEntitySeo {
  const path = `/menu/category/${category.slug}`;
  return {
    active: category.status !== "archived" && category.deletedAt === null,
    canonicalUrl: canonical(siteUrl, path),
    entityId: category.id,
    entityKind: "category",
    openGraphType: "website",
    path,
    shareImageMediaId: category.imageMediaId ?? category.bannerMediaId,
    slug: category.slug,
    structuredData: { types: ["web-page", "menu", "breadcrumb-list"], inputs: {} },
    translations: category.translations.map((entry) => ({
      locale: entry.locale,
      title: text(entry.name, "Sara Kitchen menu", 70),
      description: text(entry.description, entry.name, 170),
      keywords: keywords([entry.name, "Sara Kitchen", "Persian food"]),
    })),
  };
}

function dishDefaults(dish: DishSnapshot, siteUrl: URL): GeneratedEntitySeo {
  const path = `/menu/${dish.slug}`;
  return {
    active: dish.status !== "archived" && dish.deletedAt === null,
    canonicalUrl: canonical(siteUrl, path),
    entityId: dish.id,
    entityKind: "dish",
    openGraphType: "product",
    path,
    shareImageMediaId: dish.mediaIds[0] ?? null,
    slug: dish.slug,
    structuredData: {
      types: ["web-page", "product", "breadcrumb-list"],
      inputs: {
        priceCents: dish.basePriceCents,
        currency: "EUR",
        availability: dish.availability.mode,
      },
    },
    translations: dish.translations.map((entry) => ({
      locale: entry.locale,
      title: text(entry.name, "Sara Kitchen dish", 70),
      description: text(entry.excerpt, entry.name, 170),
      keywords: keywords([entry.name, ...dish.dietaryTags, ...dish.mayContainAllergenTags]),
    })),
  };
}

function blogDefaults(blog: BlogSnapshot, siteUrl: URL): GeneratedEntitySeo {
  const path = `/blog/${blog.slug}`;
  return {
    active: blog.status !== "archived" && blog.deletedAt === null,
    canonicalUrl: canonical(siteUrl, path),
    entityId: blog.id,
    entityKind: "blog",
    openGraphType: "article",
    path,
    shareImageMediaId: blog.imageMediaId ?? blog.bannerMediaId,
    slug: blog.slug,
    structuredData: {
      types: ["web-page", "article", "breadcrumb-list"],
      inputs: {
        author: blog.authorSnapshot.displayName,
        ...(blog.publishedAt ? { publishedAt: blog.publishedAt } : {}),
      },
    },
    translations: blog.translations.map((entry) => ({
      locale: entry.locale,
      title: text(entry.title, "Sara Kitchen article", 70),
      description: text(entry.excerpt, entry.title, 170),
      keywords: keywords([entry.title, ...blog.tags]),
    })),
  };
}

function translationOverrides(
  overrides: SeoManualOverrides,
  locale: SupportedLocale,
): ReadonlySet<SeoManualTranslationField> {
  return new Set(overrides.translations.find((entry) => entry.locale === locale)?.fields ?? []);
}

function mergeTranslation(
  current: PageSeoTranslation | undefined,
  generated: GeneratedTranslation,
  overrides: ReadonlySet<SeoManualTranslationField>,
): PageSeoTranslation {
  if (!current) {
    return {
      ...generated,
      keywords: [...generated.keywords],
      openGraph: { title: null, description: null },
      twitter: { title: null, description: null },
    };
  }
  return {
    locale: generated.locale,
    title: overrides.has("title") ? current.title : generated.title,
    description: overrides.has("description") ? current.description : generated.description,
    keywords: overrides.has("keywords") ? [...current.keywords] : [...generated.keywords],
    openGraph: {
      title: overrides.has("openGraphTitle") ? current.openGraph.title : generated.title,
      description: overrides.has("openGraphDescription")
        ? current.openGraph.description
        : generated.description,
    },
    twitter: {
      title: overrides.has("twitterTitle") ? current.twitter.title : generated.title,
      description: overrides.has("twitterDescription")
        ? current.twitter.description
        : generated.description,
    },
  };
}

export function createAutomaticSeoSynchronizer(
  connection: Connection,
  options: Readonly<{ siteUrl: string }>,
): AutomaticSeoSynchronizer {
  let siteUrl: URL;
  try {
    siteUrl = new URL(options.siteUrl);
    if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") throw new Error();
    siteUrl.pathname = "/";
    siteUrl.search = "";
    siteUrl.hash = "";
  } catch (cause) {
    throw new AutomaticSeoError("invalid_site_url", { cause });
  }

  const PageSeo = getPageSeoModel(connection);

  const sync = async (generated: GeneratedEntitySeo): Promise<string> => {
    const targetKey = `entity:${generated.entityKind}:${generated.entityId}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        let document = await PageSeo.findOne({ targetKey }).select("+targetKey");
        if (!document) {
          document = new PageSeo({
            targetType: "entity",
            entityKind: generated.entityKind,
            entityId: new Types.ObjectId(generated.entityId),
            targetKey,
            path: generated.path,
            slug: generated.slug,
            translations: generated.translations.map((entry) => ({
              ...entry,
              keywords: [...entry.keywords],
              openGraph: { title: entry.title, description: entry.description },
              twitter: { title: entry.title, description: entry.description },
            })),
            canonicalUrl: generated.canonicalUrl,
            openGraph: { type: generated.openGraphType },
            shareImageMediaId: generated.shareImageMediaId
              ? new Types.ObjectId(generated.shareImageMediaId)
              : null,
            structuredData: structuredClone(generated.structuredData),
            active: generated.active,
            createdBy: { kind: "system" },
            updatedBy: { kind: "system" },
          });
        } else {
          const manual = document.manualOverrides;
          const root = new Set(manual.root);
          if (!root.has("route")) {
            document.path = generated.path;
            document.slug = generated.slug;
          }
          if (!root.has("canonicalUrl")) document.canonicalUrl = generated.canonicalUrl;
          if (!root.has("shareImage")) {
            document.shareImageMediaId = generated.shareImageMediaId
              ? new Types.ObjectId(generated.shareImageMediaId)
              : null;
          }
          if (!root.has("openGraphType")) document.openGraph.type = generated.openGraphType;
          if (!root.has("structuredData")) {
            document.structuredData = structuredClone(generated.structuredData);
          }
          const currentByLocale = new Map(
            document.translations.map((entry) => [entry.locale, entry]),
          );
          document.translations = generated.translations.map((entry) =>
            mergeTranslation(
              currentByLocale.get(entry.locale),
              entry,
              translationOverrides(manual, entry.locale),
            ),
          );
          document.active = generated.active;
          document.deletedAt = null;
          document.deletedBy = null;
          document.updatedBy = { kind: "system" };
        }
        await document.save();
        return document._id.toHexString();
      } catch (error) {
        const retryable =
          typeof error === "object" &&
          error !== null &&
          (("code" in error && error.code === 11000) ||
            ("name" in error && error.name === "VersionError"));
        if (retryable && attempt < 2) continue;
        throw new AutomaticSeoError("persistence_failed", { cause: error });
      }
    }
    throw new AutomaticSeoError("persistence_failed");
  };

  return {
    category: (category) => sync(categoryDefaults(category, siteUrl)),
    dish: (dish) => sync(dishDefaults(dish, siteUrl)),
    blog: (blog) => sync(blogDefaults(blog, siteUrl)),
    async remove(entityKind, entityId) {
      if (!Types.ObjectId.isValid(entityId)) return;
      const document = await PageSeo.findOne({
        targetKey: `entity:${entityKind}:${entityId}`,
      }).select("+targetKey");
      if (!document || document.deletedAt) return;
      const now = new Date();
      document.active = false;
      document.deletedAt = now;
      document.deletedBy = { kind: "system" };
      document.updatedBy = { kind: "system" };
      await document.save();
    },
  };
}
