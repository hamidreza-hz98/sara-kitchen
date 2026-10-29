import "server-only";

import { notFound } from "next/navigation";

import type { SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { createCategoryRepository } from "@/server/modules/categories";
import { createDishCatalogRepository, createDishCatalogService } from "@/server/modules/dishes";
import { createIngredientAllergenCatalog } from "@/server/modules/ingredients";
import { createMediaStorageProvider, resolveStorefrontMediaImage } from "@/server/modules/media";

import { MENU_PAGE_SIZE, type MenuQuery } from "./menu-query";

export type MenuImage = Readonly<{ url: string; alt: string }>;
export type MenuCategory = Readonly<{ slug: string; name: string; description: string }>;
export type MenuDish = Readonly<{
  slug: string;
  name: string;
  excerpt: string;
  image: MenuImage | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  isOrderable: boolean;
  dietaryTags: readonly string[];
}>;
export type MenuContent = Readonly<{
  categories: readonly MenuCategory[];
  selectedCategory: MenuCategory | null;
  banner: MenuImage | null;
  dishes: readonly MenuDish[];
  totalItems: number;
  totalPages: number;
}>;

export async function loadMenuContent(
  locale: SupportedLocale,
  query: MenuQuery,
  forcedCategorySlug?: string,
): Promise<MenuContent> {
  const connection = await connectToDatabase();
  const categoriesRepository = createCategoryRepository(connection);
  const categoryRecords = await categoriesRepository.list({
    page: 1,
    pageSize: 100,
    status: "published",
    sortBy: "sortOrder",
  });
  const categorySlug = forcedCategorySlug ?? query.category;
  const selectedRecord = categorySlug ? await categoriesRepository.findBySlug(categorySlug) : null;
  if (forcedCategorySlug && (!selectedRecord || selectedRecord.status !== "published")) notFound();
  const selectedCategory = selectedRecord?.status === "published" ? selectedRecord : null;
  const categories = categoryRecords.items.map((item) => {
    const translation = resolveTranslation(item.translations, locale)?.value;
    return {
      slug: item.slug,
      name: translation?.name ?? item.slug,
      description: translation?.description ?? "",
    };
  });
  const selected =
    categories.find((item) => item.slug === selectedCategory?.slug) ??
    (selectedCategory
      ? {
          slug: selectedCategory.slug,
          name:
            resolveTranslation(selectedCategory.translations, locale)?.value.name ??
            selectedCategory.slug,
          description:
            resolveTranslation(selectedCategory.translations, locale)?.value.description ?? "",
        }
      : null);
  const storage = createMediaStorageProvider();
  const image = async (id: string | null, alt: string, size: "display" | "thumbnail") => {
    if (!id) return null;
    try {
      const found = await resolveStorefrontMediaImage(connection, storage, id, locale, size);
      return found ? { url: found.url, alt: alt || found.alt || "" } : null;
    } catch {
      return null;
    }
  };
  // An unknown category query is never broadened into an all-catalog result.
  const result =
    !query.invalid && (!categorySlug || selectedCategory)
      ? await createDishCatalogService({
          repository: createDishCatalogRepository(connection),
          ingredients: createIngredientAllergenCatalog(connection),
        }).list({
          locale,
          ...(query.search ? { search: query.search } : {}),
          ...(selectedCategory ? { categoryId: selectedCategory.id } : {}),
          availability: query.availability,
          ...(query.featured ? { featured: true } : {}),
          ...(query.discounted ? { discounted: true } : {}),
          dietaryTags: query.dietaryTags,
          excludeAllergens: query.excludeAllergens,
          sort: query.sort,
          viewMode: query.view,
          page: query.page,
          pageSize: MENU_PAGE_SIZE,
        })
      : null;
  const dishes = await Promise.all(
    (result?.items ?? []).map(async (item) => ({
      slug: item.slug,
      name: item.name.value,
      excerpt: item.excerpt?.value ?? "",
      image: await image(item.mediaIds[0] ?? null, item.name.value, "thumbnail"),
      priceCents: item.price.effectivePriceCents,
      compareAtPriceCents: item.price.display.compareAtPriceCents,
      isOrderable: item.availability.isOrderable,
      dietaryTags: item.dietaryTags,
    })),
  );
  return {
    categories,
    selectedCategory: selected,
    banner: await image(selectedCategory?.bannerMediaId ?? null, selected?.name ?? "", "display"),
    dishes,
    totalItems: result?.meta.pagination.totalItems ?? 0,
    totalPages: result?.meta.pagination.totalPages ?? 0,
  };
}
