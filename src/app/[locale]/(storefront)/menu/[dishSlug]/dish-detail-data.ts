import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import type { SupportedLocale } from "@/constants";
import { sanitizeRichTextDocument } from "@/lib/rich-text";
import { resolveTranslation } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { createBlogRepository } from "@/server/modules/blogs";
import { createCategoryRepository } from "@/server/modules/categories";
import {
  calculateDishPrice,
  createDishCatalogRepository,
  createDishCatalogService,
  createDishRepository,
  DishCatalogQueryError,
} from "@/server/modules/dishes";
import {
  createIngredientAllergenCatalog,
  createIngredientRepository,
} from "@/server/modules/ingredients";
import { createMediaStorageProvider, resolveStorefrontMediaImage } from "@/server/modules/media";

import type { DishDetailContent, DishDetailImage } from "./dish-detail-content";

export const loadDishDetailContent = cache(async function readDishDetailContent(
  slug: string,
  locale: SupportedLocale,
): Promise<DishDetailContent> {
  const connection = await connectToDatabase();
  const catalog = createDishCatalogService({
    repository: createDishCatalogRepository(connection),
    ingredients: createIngredientAllergenCatalog(connection),
  });
  let detail;
  try {
    detail = await catalog.getBySlug({ slug, locale });
  } catch (error) {
    if (
      error instanceof DishCatalogQueryError &&
      (error.code === "not_found" || error.code === "invalid_query")
    )
      notFound();
    throw error;
  }

  const storage = createMediaStorageProvider();
  const image = async (
    id: string | null,
    alt: string,
    size: "display" | "thumbnail",
  ): Promise<DishDetailImage | null> => {
    if (!id) return null;
    try {
      const found = await resolveStorefrontMediaImage(connection, storage, id, locale, size);
      return found ? { url: found.url, alt: found.alt || alt } : null;
    } catch {
      return null;
    }
  };
  const [categoryRecord, ingredientRecords, relatedDishRecords, relatedBlogRecords, images] =
    await Promise.all([
      detail.categoryIds[0]
        ? createCategoryRepository(connection).findById(detail.categoryIds[0])
        : Promise.resolve(null),
      Promise.all(
        detail.ingredients.map((item) =>
          createIngredientRepository(connection).findById(item.ingredientId),
        ),
      ),
      Promise.all(
        detail.relatedDishIds
          .slice(0, 6)
          .map((id) => createDishRepository(connection).findById(id)),
      ),
      Promise.all(
        detail.relatedBlogIds
          .slice(0, 4)
          .map((id) => createBlogRepository(connection).findById(id)),
      ),
      Promise.all(detail.mediaIds.slice(0, 8).map((id) => image(id, detail.name.value, "display"))),
    ]);
  const now = new Date();
  const relatedDishes = (
    await Promise.all(
      relatedDishRecords.map(async (record) => {
        if (!record || record.status !== "published" || record.deletedAt || record.id === detail.id)
          return null;
        const available =
          record.availability.mode === "available" ||
          (record.availability.mode === "scheduled" &&
            (!record.availability.availableFrom || record.availability.availableFrom <= now) &&
            (!record.availability.availableUntil || record.availability.availableUntil > now));
        if (!available) return null;
        const translation = resolveTranslation(record.translations, locale)?.value;
        if (!translation) return null;
        return {
          slug: record.slug,
          name: translation.name,
          excerpt: translation.excerpt ?? "",
          image: await image(record.mediaIds[0] ?? null, translation.name, "thumbnail"),
          priceCents: calculateDishPrice({
            basePriceCents: record.basePriceCents,
            discount: record.discount,
            at: now,
          }).effectivePriceCents,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  const relatedBlogs = (
    await Promise.all(
      relatedBlogRecords.map(async (record) => {
        if (
          !record ||
          record.status !== "published" ||
          record.deletedAt ||
          !record.publishedAt ||
          new Date(record.publishedAt) > now
        )
          return null;
        const translation = resolveTranslation(record.translations, locale)?.value;
        if (!translation) return null;
        return {
          slug: record.slug,
          title: translation.title,
          excerpt: translation.excerpt,
          image: await image(
            record.imageMediaId ?? record.bannerMediaId,
            translation.title,
            "thumbnail",
          ),
          readTimeMinutes: record.readTimeMinutes,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  const ingredients = (
    await Promise.all(
      detail.ingredients.map(async (item, index) => {
        const record = ingredientRecords[index];
        if (!record || record.deletedAt) return null;
        const translation = resolveTranslation(record.translations, locale)?.value;
        if (!translation) return null;
        const note = resolveTranslation(item.notes, locale)?.value.note ?? "";
        return {
          name: translation.name,
          note,
          image: await image(record.imageMediaId, translation.name, "thumbnail"),
          quantityAmount: item.quantityAmount,
          quantityUnit: item.quantityUnit,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  const categoryTranslation =
    categoryRecord?.status === "published"
      ? resolveTranslation(categoryRecord.translations, locale)?.value
      : null;
  const gallery = images.filter((item): item is DishDetailImage => item !== null);
  const discount = detail.price.display.badge;
  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name.value,
    excerpt: detail.excerpt?.value ?? "",
    description: detail.description ? sanitizeRichTextDocument(detail.description) : null,
    images: gallery,
    category:
      categoryRecord && categoryTranslation
        ? { slug: categoryRecord.slug, name: categoryTranslation.name }
        : null,
    priceCents: detail.price.effectivePriceCents,
    basePriceCents: detail.price.basePriceCents,
    discount: discount
      ? {
          amountCents: detail.price.discountCents,
          percentage: discount.kind === "percentage" ? discount.basisPoints / 100 : null,
        }
      : null,
    isOrderable: detail.availability.isOrderable,
    leadTimeMinutes: detail.leadTimeMinutes,
    maxQuantity: detail.maxQuantityPerOrder,
    portion: detail.portion,
    ingredients,
    allergens: detail.allergens,
    dietaryTags: detail.dietaryTags,
    specifications: detail.specifications,
    relatedDishes,
    relatedBlogs,
  };
});
