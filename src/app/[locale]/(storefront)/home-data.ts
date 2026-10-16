import "server-only";

import { unstable_cache } from "next/cache";
import type { SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";
import { CONTENT_REVALIDATE_SECONDS, contentItemTag, contentListTag } from "@/server/cache";
import { connectToDatabase } from "@/server/database";
import { createBlogRepository } from "@/server/modules/blogs";
import { createCategoryRepository } from "@/server/modules/categories";
import {
  calculateDishPrice,
  createDishCatalogRepository,
  createDishCatalogService,
  createDishRepository,
} from "@/server/modules/dishes";
import { createIngredientAllergenCatalog } from "@/server/modules/ingredients";
import { createMinioStorageProvider, resolveStorefrontMediaImage } from "@/server/modules/media";
import { createSettingsRuntime } from "@/server/modules/settings";
import {
  EMPTY_HOME_CONTENT,
  type HomeContent,
  type HomeDish,
  type HomeImage,
  type HomeLink,
} from "./home-content";

function publicLink(href: string | null, newTab: boolean): HomeLink | null {
  if (!href) return null;
  return { href, newTab };
}

/** Read only published settings and currently public referenced content. */
async function readHomeContent(locale: SupportedLocale): Promise<HomeContent> {
  const connection = await connectToDatabase();
  const settings = await createSettingsRuntime(connection, { requestId: "home-render" }).getPublic(
    "homepage",
    locale,
  );
  if (!settings) return EMPTY_HOME_CONTENT;

  const storage = createMinioStorageProvider();
  const dishRepository = createDishRepository(connection);
  const categoryRepository = createCategoryRepository(connection);
  const blogRepository = createBlogRepository(connection);
  const now = new Date();
  const localized = resolveTranslation(
    settings.translations.map((entry) => ({
      locale: entry.locale,
      ...entry.value,
    })),
    locale,
  )?.value;
  const imageCache = new Map<string, Promise<HomeImage | null>>();
  const image = (
    id: string | null,
    alt = "",
    size: "display" | "thumbnail" = "thumbnail",
  ): Promise<HomeImage | null> => {
    if (!id) return Promise.resolve(null);
    const cacheKey = `${id}:${size}`;
    let value = imageCache.get(cacheKey);
    if (!value) {
      value = resolveStorefrontMediaImage(connection, storage, id, locale, size)
        .then((found) => (found ? { url: found.url, alt: alt || found.alt || "" } : null))
        .catch(() => null);
      imageCache.set(cacheKey, value);
    }
    return value.then((found) => (found ? { ...found, alt: alt || found.alt } : null));
  };
  const dish = async (id: string): Promise<HomeDish | null> => {
    const record = await dishRepository.findById(id);
    if (!record || record.status !== "published" || record.availability.mode === "unavailable")
      return null;
    if (record.availability.availableFrom && record.availability.availableFrom > now) return null;
    if (record.availability.availableUntil && record.availability.availableUntil <= now)
      return null;
    const translation = resolveTranslation(record.translations, locale)?.value;
    if (!translation) return null;
    const price = calculateDishPrice({
      basePriceCents: record.basePriceCents,
      discount: record.discount,
      at: now,
    });
    return {
      id: record.id,
      slug: record.slug,
      name: translation.name,
      excerpt: translation.excerpt ?? "",
      image: await image(record.mediaIds[0] ?? null, translation.name),
      priceCents: price.effectivePriceCents,
      originalPriceCents: price.display.compareAtPriceCents,
    };
  };
  const compact = <T>(items: readonly (T | null)[]): T[] =>
    items.filter((item): item is T => item !== null);
  const [hero, banners, featured, benefits, categories, testimonials, blogs] = await Promise.all([
    Promise.all(
      settings.data.heroSlides
        .filter((item) => item.enabled)
        .map(async (item) => {
          const copy =
            localized?.heroSlides.find((entry) => entry.id === item.id) ??
            settings.translations
              .find((entry) => entry.locale === "en")
              ?.value.heroSlides.find((entry) => entry.id === item.id);
          const picture = await image(item.imageMediaId, copy?.imageAlt, "display");
          if (!picture || !copy) return null;
          return {
            id: item.id,
            title: copy.title,
            description: copy.description,
            ctaLabel: copy.ctaLabel,
            image: picture,
            mobileImage: await image(item.mobileImageMediaId, copy.imageAlt, "display"),
            link: publicLink(item.href, item.openInNewTab),
          };
        }),
    ),
    Promise.all(
      settings.data.linkedBanners
        .filter((item) => item.enabled)
        .map(async (item) => {
          const copy =
            localized?.linkedBanners.find((entry) => entry.id === item.id) ??
            settings.translations
              .find((entry) => entry.locale === "en")
              ?.value.linkedBanners.find((entry) => entry.id === item.id);
          const picture = await image(item.imageMediaId, copy?.imageAlt, "display");
          return picture
            ? {
                id: item.id,
                title: copy?.title ?? "",
                image: picture,
                link: publicLink(item.href, item.openInNewTab)!,
              }
            : null;
        }),
    ),
    Promise.all(settings.data.featuredDishIds.slice(0, 6).map(dish)),
    Promise.all(
      settings.data.benefits
        .filter((item) => item.enabled)
        .map(async (item) => {
          const copy =
            localized?.benefits.find((entry) => entry.id === item.id) ??
            settings.translations
              .find((entry) => entry.locale === "en")
              ?.value.benefits.find((entry) => entry.id === item.id);
          return copy
            ? {
                id: item.id,
                title: copy.title,
                description: copy.description,
                icon: await image(item.iconMediaId, ""),
              }
            : null;
        }),
    ),
    Promise.all(
      settings.data.categoryBanners
        .filter((item) => item.enabled)
        .map(async (item) => {
          const category = await categoryRepository.findById(item.categoryId);
          if (!category || category.status !== "published") return null;
          const name = resolveTranslation(category.translations, locale)?.value.name;
          if (!name) return null;
          return {
            id: category.id,
            slug: category.slug,
            name,
            image: await image(
              item.imageMediaId ?? category.bannerMediaId ?? category.imageMediaId,
              name,
            ),
          };
        }),
    ),
    Promise.all(
      settings.data.testimonials
        .filter((item) => item.enabled)
        .map(async (item) => {
          const copy =
            localized?.testimonials.find((entry) => entry.id === item.id) ??
            settings.translations
              .find((entry) => entry.locale === "en")
              ?.value.testimonials.find((entry) => entry.id === item.id);
          return copy
            ? {
                id: item.id,
                author: copy.authorName,
                role: copy.authorRole,
                quote: copy.quote,
                rating: item.rating,
                avatar: await image(item.avatarMediaId, copy.authorName),
              }
            : null;
        }),
    ),
    Promise.all(
      settings.data.blogIds.map(async (id) => {
        const record = await blogRepository.findById(id);
        if (
          !record ||
          record.status !== "published" ||
          !record.publishedAt ||
          new Date(record.publishedAt) > now
        )
          return null;
        const copy = resolveTranslation(record.translations, locale)?.value;
        if (!copy) return null;
        return {
          id: record.id,
          slug: record.slug,
          title: copy.title,
          excerpt: copy.excerpt,
          image: await image(record.imageMediaId ?? record.bannerMediaId, copy.title),
          readTimeMinutes: record.readTimeMinutes,
        };
      }),
    ),
  ]);
  const discount = settings.data.discountedSection;
  let discounted: HomeDish[] = [];
  if (discount.enabled) {
    if (discount.mode === "curated") {
      discounted = compact(
        await Promise.all(discount.dishIds.slice(0, discount.limit).map(dish)),
      ).filter((item) => item.originalPriceCents !== null);
    } else {
      const catalog = createDishCatalogService({
        repository: createDishCatalogRepository(connection),
        ingredients: createIngredientAllergenCatalog(connection),
      });
      const result = await catalog.list({
        locale,
        discounted: true,
        availability: "available",
        pageSize: discount.limit,
      });
      discounted = compact(await Promise.all(result.items.map((item) => dish(item.id))));
    }
  }
  return {
    hero: compact(hero),
    banners: compact(banners),
    featured: compact(featured),
    benefits: compact(benefits),
    discounted,
    categories: compact(categories),
    testimonials: compact(testimonials),
    blogs: compact(blogs),
    titles: localized?.sectionTitles ?? null,
  };
}

/** Signed image URLs outlive this bounded cache; source mutations invalidate their list tags. */
export function loadHomeContent(locale: SupportedLocale): Promise<HomeContent> {
  return unstable_cache(() => readHomeContent(locale), ["home-content", locale], {
    revalidate: CONTENT_REVALIDATE_SECONDS,
    tags: [
      contentItemTag("settings", "homepage"),
      contentListTag("dishes"),
      contentListTag("categories"),
      contentListTag("blogs"),
    ],
  })();
}
