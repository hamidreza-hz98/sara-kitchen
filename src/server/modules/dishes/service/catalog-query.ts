import "server-only";

import { z } from "zod";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@/constants";
import { resolveLocalizedValue } from "@/locales/translation-selection";
import { normalizeSearchText } from "@/server/database/schema";
import { pageResult, type PageMetadata } from "@/server/database/query-controls";
import {
  INGREDIENT_ALLERGEN_TAGS,
  type IngredientAllergenCatalog,
  type IngredientAllergenTag,
} from "@/server/modules/ingredients";

import { DISH_DIETARY_TAGS, type DishDietaryTag } from "../model/dish";
import { calculateDishPrice, type DishPriceResult } from "../pricing/dish-pricing";
import type {
  DishCatalogQueryPlan,
  DishCatalogRecord,
  DishCatalogRepository,
  DishCatalogDetailRecord,
} from "../repository/catalog";

export const DISH_CATALOG_AVAILABILITY_FILTERS = ["all", "available", "unavailable"] as const;
export const DISH_CATALOG_SORTS = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
  "popular",
  "best_selling",
] as const;
export const DISH_CATALOG_VIEW_MODES = ["grid", "list"] as const;

export type DishCatalogAvailabilityFilter = (typeof DISH_CATALOG_AVAILABILITY_FILTERS)[number];
export type DishCatalogSort = (typeof DISH_CATALOG_SORTS)[number];
export type DishCatalogViewMode = (typeof DISH_CATALOG_VIEW_MODES)[number];

export type DishCatalogQueryInput = Readonly<{
  locale?: SupportedLocale;
  fallbackLocale?: SupportedLocale | null;
  search?: string;
  categoryId?: string;
  availability?: DishCatalogAvailabilityFilter;
  featured?: boolean;
  discounted?: boolean;
  dietaryTags?: readonly DishDietaryTag[];
  excludeAllergens?: readonly IngredientAllergenTag[];
  sort?: DishCatalogSort;
  viewMode?: DishCatalogViewMode;
  page?: number;
  pageSize?: number;
}>;

export type DishCatalogLocalizedText = Readonly<{
  value: string;
  resolvedLocale: SupportedLocale;
  isFallback: boolean;
  direction: "ltr" | "rtl";
}>;

export type DishCatalogItem = Readonly<{
  id: string;
  slug: string;
  name: DishCatalogLocalizedText;
  excerpt: DishCatalogLocalizedText | null;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  price: DishPriceResult;
  portion: Readonly<{ amount: number; unit: DishCatalogRecord["portionUnit"] }>;
  availability: Readonly<{
    mode: DishCatalogRecord["availability"]["mode"];
    isOrderable: boolean;
    nextChangeAt: string | null;
  }>;
  leadTimeMinutes: number;
  maxQuantityPerOrder: number;
  dietaryTags: readonly DishDietaryTag[];
  allergens: Readonly<{
    contains: readonly IngredientAllergenTag[];
    mayContain: readonly IngredientAllergenTag[];
  }>;
  isFeatured: boolean;
}>;

export type DishCatalogResult = Readonly<{
  items: readonly DishCatalogItem[];
  meta: PageMetadata &
    Readonly<{
      locale: SupportedLocale;
      viewMode: DishCatalogViewMode;
      evaluatedAt: string;
    }>;
}>;

export type DishCatalogDetail = DishCatalogItem &
  Readonly<{
    description: DishCatalogDetailRecord["translations"][number]["description"] | null;
    specifications: DishCatalogDetailRecord["translations"][number]["specifications"];
    ingredients: DishCatalogDetailRecord["ingredients"];
    relatedDishIds: readonly string[];
    relatedBlogIds: readonly string[];
  }>;

export type DishCatalogDependencies = Readonly<{
  repository: DishCatalogRepository;
  ingredients: IngredientAllergenCatalog;
  now?: () => Date;
}>;

export class DishCatalogQueryError extends Error {
  constructor(readonly code: "invalid_query" | "invalid_catalog_data" | "not_found") {
    super(code);
    this.name = "DishCatalogQueryError";
  }
}

const detailSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
  fallbackLocale: z.enum(SUPPORTED_LOCALES).nullable().optional(),
});

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const querySchema = z
  .strictObject({
    locale: z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE),
    fallbackLocale: z.enum(SUPPORTED_LOCALES).nullable().optional(),
    search: z.string().trim().min(2).max(80).optional(),
    categoryId: objectId.optional(),
    availability: z.enum(DISH_CATALOG_AVAILABILITY_FILTERS).default("all"),
    featured: z.boolean().optional(),
    discounted: z.boolean().optional(),
    dietaryTags: z.array(z.enum(DISH_DIETARY_TAGS)).max(DISH_DIETARY_TAGS.length).default([]),
    excludeAllergens: z
      .array(z.enum(INGREDIENT_ALLERGEN_TAGS))
      .max(INGREDIENT_ALLERGEN_TAGS.length)
      .default([]),
    sort: z.enum(DISH_CATALOG_SORTS).default("recommended"),
    viewMode: z.enum(DISH_CATALOG_VIEW_MODES).default("grid"),
    page: z.number().int().safe().min(1).default(1),
    pageSize: z.number().int().safe().min(1).max(60).default(12),
  })
  .superRefine((value, context) => {
    if (value.page * value.pageSize > 10_000) {
      context.addIssue({
        code: "custom",
        message: "Catalog result window is too large.",
        path: ["page"],
      });
    }
    if (new Set(value.dietaryTags).size !== value.dietaryTags.length) {
      context.addIssue({
        code: "custom",
        message: "Dietary filters must be unique.",
        path: ["dietaryTags"],
      });
    }
    if (new Set(value.excludeAllergens).size !== value.excludeAllergens.length) {
      context.addIssue({
        code: "custom",
        message: "Allergen filters must be unique.",
        path: ["excludeAllergens"],
      });
    }
  });

type ParsedDishCatalogQuery = z.output<typeof querySchema>;

const SORTS: Readonly<Record<DishCatalogSort, Readonly<Record<string, 1 | -1>>>> = {
  recommended: { isFeatured: -1, featuredOrder: 1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  price_asc: { basePriceCents: 1, _id: 1 },
  price_desc: { basePriceCents: -1, _id: -1 },
  popular: { viewCount: -1, _id: 1 },
  best_selling: { soldCount: -1, _id: 1 },
};

type CatalogFilter = Readonly<Record<string, unknown>>;

function availableAt(at: Date): CatalogFilter {
  return {
    $or: [
      { "availability.mode": "available" },
      {
        "availability.mode": "scheduled",
        $and: [
          {
            $or: [
              { "availability.availableFrom": null },
              { "availability.availableFrom": { $lte: at } },
            ],
          },
          {
            $or: [
              { "availability.availableUntil": null },
              { "availability.availableUntil": { $gt: at } },
            ],
          },
        ],
      },
    ],
  };
}

function unavailableAt(at: Date): CatalogFilter {
  return {
    $or: [
      { "availability.mode": "unavailable" },
      {
        "availability.mode": "scheduled",
        $or: [
          { "availability.availableFrom": { $gt: at } },
          { "availability.availableUntil": { $lte: at } },
        ],
      },
    ],
  };
}

function discountedAt(at: Date): CatalogFilter {
  return {
    "discount.type": { $in: ["fixed", "percentage"] },
    $and: [
      { $or: [{ "discount.startsAt": null }, { "discount.startsAt": { $lte: at } }] },
      { $or: [{ "discount.endsAt": null }, { "discount.endsAt": { $gt: at } }] },
    ],
  };
}

async function createPlan(
  query: ParsedDishCatalogQuery,
  at: Date,
  ingredients: IngredientAllergenCatalog,
): Promise<DishCatalogQueryPlan> {
  const filter: Record<string, unknown> = { deletedAt: null, status: "published" };
  const conditions: CatalogFilter[] = [];

  if (query.search) filter.$text = { $search: normalizeSearchText(query.search) };
  if (query.categoryId) filter.categoryIds = query.categoryId;
  if (query.featured !== undefined) filter.isFeatured = query.featured;
  if (query.dietaryTags.length > 0) filter.dietaryTags = { $all: query.dietaryTags };
  if (query.availability === "available") conditions.push(availableAt(at));
  if (query.availability === "unavailable") conditions.push(unavailableAt(at));
  if (query.discounted === true) conditions.push(discountedAt(at));
  if (query.discounted === false) conditions.push({ $nor: [discountedAt(at)] });

  if (query.excludeAllergens.length > 0) {
    filter.mayContainAllergenTags = { $nin: query.excludeAllergens };
    const unsafeIngredientIds = await ingredients.findIngredientIdsContainingAny(
      query.excludeAllergens,
    );
    if (unsafeIngredientIds.length > 0) {
      filter["ingredients.ingredientId"] = { $nin: unsafeIngredientIds };
    }
  }
  if (conditions.length > 0) filter.$and = conditions;

  return {
    filter,
    sort: SORTS[query.sort],
    skip: (query.page - 1) * query.pageSize,
    limit: query.pageSize,
  };
}

function localizedText(
  record: DishCatalogRecord,
  field: "name" | "excerpt",
  locale: SupportedLocale,
  fallbackLocale: SupportedLocale | null | undefined,
): DishCatalogLocalizedText | null {
  const selection = resolveLocalizedValue(record.translations, field, locale, {
    ...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
  });
  if (!selection) return null;
  return {
    value: selection.value,
    resolvedLocale: selection.resolvedLocale,
    isFallback: selection.isFallback,
    direction: selection.direction,
  };
}

function resolveAvailability(record: DishCatalogRecord, at: Date): DishCatalogItem["availability"] {
  const { availability } = record;
  const from = availability.availableFrom?.getTime() ?? null;
  const until = availability.availableUntil?.getTime() ?? null;
  const now = at.getTime();
  const isOrderable =
    availability.mode === "available" ||
    (availability.mode === "scheduled" &&
      (from === null || now >= from) &&
      (until === null || now < until));
  const next = [from, until]
    .filter((instant): instant is number => instant !== null && instant > now)
    .sort((left, right) => left - right)[0];
  return {
    mode: availability.mode,
    isOrderable,
    nextChangeAt: next === undefined ? null : new Date(next).toISOString(),
  };
}

function allergensFor(
  record: DishCatalogRecord,
  ingredientAllergens: Awaited<
    ReturnType<IngredientAllergenCatalog["getAllergensByIngredientIds"]>
  >,
) {
  const contained = new Set<IngredientAllergenTag>();
  for (const ingredientId of record.ingredientIds) {
    for (const allergen of ingredientAllergens[ingredientId] ?? []) contained.add(allergen);
  }
  return {
    contains: INGREDIENT_ALLERGEN_TAGS.filter((allergen) => contained.has(allergen)),
    mayContain: INGREDIENT_ALLERGEN_TAGS.filter((allergen) =>
      record.mayContainAllergenTags.includes(allergen),
    ),
  };
}

function toCatalogItem(
  record: DishCatalogRecord,
  parsed: Pick<ParsedDishCatalogQuery, "locale" | "fallbackLocale">,
  at: Date,
  ingredientAllergens: Awaited<
    ReturnType<IngredientAllergenCatalog["getAllergensByIngredientIds"]>
  >,
): DishCatalogItem {
  const name = localizedText(record, "name", parsed.locale, parsed.fallbackLocale);
  if (!name) throw new DishCatalogQueryError("invalid_catalog_data");
  return {
    id: record.id,
    slug: record.slug,
    name,
    excerpt: localizedText(record, "excerpt", parsed.locale, parsed.fallbackLocale),
    mediaIds: record.mediaIds,
    categoryIds: record.categoryIds,
    price: calculateDishPrice({
      basePriceCents: record.basePriceCents,
      discount: record.discount,
      at,
    }),
    portion: { amount: record.portionAmount, unit: record.portionUnit },
    availability: resolveAvailability(record, at),
    leadTimeMinutes: record.leadTimeMinutes,
    maxQuantityPerOrder: record.maxQuantityPerOrder,
    dietaryTags: record.dietaryTags,
    allergens: allergensFor(record, ingredientAllergens),
    isFeatured: record.isFeatured,
  };
}

export function createDishCatalogService(dependencies: DishCatalogDependencies) {
  return {
    async list(raw: DishCatalogQueryInput = {}): Promise<DishCatalogResult> {
      const parsed = querySchema.safeParse(raw);
      if (!parsed.success) throw new DishCatalogQueryError("invalid_query");
      const at = dependencies.now?.() ?? new Date();
      if (!Number.isFinite(at.getTime())) throw new DishCatalogQueryError("invalid_catalog_data");

      const plan = await createPlan(parsed.data, at, dependencies.ingredients);
      const result = await dependencies.repository.list(plan);
      const ingredientIds = result.items.flatMap((item) => item.ingredientIds);
      const ingredientAllergens =
        await dependencies.ingredients.getAllergensByIngredientIds(ingredientIds);
      const items = result.items.map((record) =>
        toCatalogItem(record, parsed.data, at, ingredientAllergens),
      );
      const pagination = pageResult(items, result.total, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        sortBy: parsed.data.sort,
        sortDirection:
          parsed.data.sort === "price_asc" || parsed.data.sort === "recommended" ? "asc" : "desc",
      });
      return {
        items: pagination.data,
        meta: {
          ...pagination.meta,
          locale: parsed.data.locale,
          viewMode: parsed.data.viewMode,
          evaluatedAt: at.toISOString(),
        },
      };
    },
    async getBySlug(raw: {
      slug: string;
      locale?: SupportedLocale;
      fallbackLocale?: SupportedLocale | null;
    }): Promise<DishCatalogDetail> {
      const parsed = detailSchema.safeParse(raw);
      if (!parsed.success) throw new DishCatalogQueryError("invalid_query");
      const record = await dependencies.repository.findBySlug(parsed.data.slug);
      if (!record) throw new DishCatalogQueryError("not_found");
      const at = dependencies.now?.() ?? new Date();
      const ingredientAllergens = await dependencies.ingredients.getAllergensByIngredientIds(
        record.ingredientIds,
      );
      const item = toCatalogItem(record, parsed.data, at, ingredientAllergens);
      const localeOptions = {
        ...(parsed.data.fallbackLocale !== undefined
          ? { fallbackLocale: parsed.data.fallbackLocale }
          : {}),
      };
      const description = resolveLocalizedValue(
        record.translations,
        "description",
        parsed.data.locale,
        localeOptions,
      );
      const specifications = resolveLocalizedValue(
        record.translations,
        "specifications",
        parsed.data.locale,
        localeOptions,
      );
      return {
        ...item,
        description: description?.value ?? null,
        specifications: specifications?.value ?? [],
        ingredients: record.ingredients,
        relatedDishIds: record.relatedDishIds,
        relatedBlogIds: record.relatedBlogIds,
      };
    },
  };
}
