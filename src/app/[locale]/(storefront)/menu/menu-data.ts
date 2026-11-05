import "server-only";

import { notFound } from "next/navigation";

import type { SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { createCategoryRepository } from "@/server/modules/categories";
import {
  createDishCatalogRepository,
  createDishCatalogService,
  type DishCatalogItem,
} from "@/server/modules/dishes";
import { createIngredientAllergenCatalog } from "@/server/modules/ingredients";
import { createMediaStorageProvider, resolveStorefrontMediaImage } from "@/server/modules/media";

import { MENU_PAGE_SIZE, type MenuQuery } from "./menu-query";

export type MenuImage = Readonly<{ url: string; alt: string }>;
export type MenuCategory = Readonly<{
  slug: string;
  name: string;
  description: string;
  image?: MenuImage | null;
  banner?: MenuImage | null;
}>;
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
export type MenuCategoryShowcase = Readonly<{
  category: MenuCategory;
  dishes: readonly MenuDish[];
  totalItems: number;
  totalPages: number;
}>;
export type MenuContent = Readonly<{
  categories: readonly MenuCategory[];
  categoryShowcases?: readonly MenuCategoryShowcase[];
  selectedCategory: MenuCategory | null;
  banner: MenuImage | null;
  dishes: readonly MenuDish[];
  totalItems: number;
  totalPages: number;
}>;

type MenuLoadOptions = Readonly<{
  includeCategoryList?: boolean;
  includeCategoryImages?: boolean;
  includeCategoryShowcases?: boolean;
}>;

export async function loadMenuContent(
  locale: SupportedLocale,
  query: MenuQuery,
  forcedCategorySlug?: string,
  options: MenuLoadOptions = {},
): Promise<MenuContent> {
  const connection = await connectToDatabase();
  const categoriesRepository = createCategoryRepository(connection);
  const categoryRecords =
    options.includeCategoryList === false
      ? []
      : await (async () => {
          const firstCategoryPage = await categoriesRepository.list({
            page: 1,
            pageSize: 100,
            status: "published",
            sortBy: "sortOrder",
            sortDirection: "asc",
          });
          const remainingCategoryPages = await Promise.all(
            Array.from({ length: Math.ceil(firstCategoryPage.total / 100) - 1 }, (_, index) =>
              categoriesRepository.list({
                page: index + 2,
                pageSize: 100,
                status: "published",
                sortBy: "sortOrder",
                sortDirection: "asc",
              }),
            ),
          );
          return [
            ...firstCategoryPage.items,
            ...remainingCategoryPages.flatMap((page) => page.items),
          ];
        })();
  const categorySlug = forcedCategorySlug ?? query.category;
  const selectedRecord = categorySlug ? await categoriesRepository.findBySlug(categorySlug) : null;
  if (forcedCategorySlug && (!selectedRecord || selectedRecord.status !== "published")) notFound();

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
  const toMenuCategory = async (
    record: NonNullable<typeof selectedRecord>,
  ): Promise<MenuCategory> => {
    const translation = resolveTranslation(record.translations, locale)?.value;
    const name = translation?.name ?? record.slug;
    const [categoryImage, banner] =
      options.includeCategoryImages === false
        ? [null, null]
        : await Promise.all([
            image(record.imageMediaId ?? record.bannerMediaId, name, "thumbnail"),
            image(record.bannerMediaId ?? record.imageMediaId, name, "display"),
          ]);
    return {
      slug: record.slug,
      name,
      description: translation?.description ?? "",
      image: categoryImage,
      banner,
    };
  };
  const categories = await Promise.all(categoryRecords.map(toMenuCategory));
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const selectedCategory = selectedRecord
    ? (categories.find((category) => category.slug === selectedRecord.slug) ??
      (await toMenuCategory(selectedRecord)))
    : null;

  const catalog = createDishCatalogService({
    repository: createDishCatalogRepository(connection),
    ingredients: createIngredientAllergenCatalog(connection),
  });
  const baseQuery = {
    locale,
    ...(query.search ? { search: query.search } : {}),
    availability: query.availability,
    ...(query.featured ? { featured: true } : {}),
    ...(query.discounted ? { discounted: true } : {}),
    dietaryTags: query.dietaryTags,
    excludeAllergens: query.excludeAllergens,
    sort: query.sort,
    viewMode: query.view,
  } as const;
  const listDishes = async (items: readonly DishCatalogItem[]): Promise<readonly MenuDish[]> =>
    Promise.all(
      items.map(async (item) => ({
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

  // An unknown category query is never broadened into an all-catalog result.
  const canQueryCatalog = !query.invalid && (!categorySlug || selectedCategory);
  const categoryResult =
    canQueryCatalog && selectedCategory
      ? await catalog.list({
          ...baseQuery,
          categoryId: selectedRecord?.id ?? "",
          page: query.page,
          pageSize: MENU_PAGE_SIZE,
        })
      : null;
  const totalResult =
    options.includeCategoryShowcases !== false && canQueryCatalog && !categorySlug
      ? await catalog.list({ ...baseQuery, page: 1, pageSize: 1 })
      : null;
  const categoryShowcases =
    canQueryCatalog && !categorySlug
      ? (
          await Promise.all(
            categoryRecords.map(async (record) => {
              const category = categoryBySlug.get(record.slug);
              if (!category) return null;
              const result = await catalog.list({
                ...baseQuery,
                categoryId: record.id,
                page: 1,
                pageSize: MENU_PAGE_SIZE,
              });
              return {
                category,
                dishes: await listDishes(result.items),
                totalItems: result.meta.pagination.totalItems,
                totalPages: result.meta.pagination.totalPages,
              };
            }),
          )
        ).filter((showcase): showcase is MenuCategoryShowcase => showcase !== null)
      : [];
  const dishes = await listDishes(categoryResult?.items ?? []);

  return {
    categories,
    categoryShowcases,
    selectedCategory,
    banner: selectedCategory?.banner ?? null,
    dishes,
    totalItems:
      categoryResult?.meta.pagination.totalItems ?? totalResult?.meta.pagination.totalItems ?? 0,
    totalPages: categoryResult?.meta.pagination.totalPages ?? 0,
  };
}
