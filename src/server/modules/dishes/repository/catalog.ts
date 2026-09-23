import "server-only";

import type { Connection } from "mongoose";

import type { IngredientAllergenTag } from "@/server/modules/ingredients";

import {
  getDishModel,
  type DishAvailability,
  type DishDietaryTag,
  type DishDiscount,
  type DishPortionUnit,
  type DishRecord,
  type DishTranslation,
} from "../model/dish";

export type DishCatalogRecord = Readonly<{
  id: string;
  translations: readonly DishTranslation[];
  slug: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredientIds: readonly string[];
  basePriceCents: number;
  discount: DishDiscount;
  portionAmount: number;
  portionUnit: DishPortionUnit;
  availability: DishAvailability;
  leadTimeMinutes: number;
  maxQuantityPerOrder: number;
  mayContainAllergenTags: readonly IngredientAllergenTag[];
  dietaryTags: readonly DishDietaryTag[];
  isFeatured: boolean;
  featuredOrder: number;
}>;

export type DishCatalogQueryPlan = Readonly<{
  filter: Readonly<Record<string, unknown>>;
  sort: Readonly<Record<string, 1 | -1>>;
  skip: number;
  limit: number;
}>;

export type DishCatalogRepositoryResult = Readonly<{
  items: readonly DishCatalogRecord[];
  total: number;
}>;

export interface DishCatalogRepository {
  list(plan: DishCatalogQueryPlan): Promise<DishCatalogRepositoryResult>;
}

const PUBLIC_CATALOG_PROJECTION = {
  translations: 1,
  slug: 1,
  mediaIds: 1,
  categoryIds: 1,
  "ingredients.ingredientId": 1,
  basePriceCents: 1,
  discount: 1,
  portionAmount: 1,
  portionUnit: 1,
  availability: 1,
  leadTimeMinutes: 1,
  maxQuantityPerOrder: 1,
  mayContainAllergenTags: 1,
  dietaryTags: 1,
  isFeatured: 1,
  featuredOrder: 1,
} as const;

type ProjectedDish = Pick<
  DishRecord,
  | "_id"
  | "translations"
  | "slug"
  | "mediaIds"
  | "categoryIds"
  | "ingredients"
  | "basePriceCents"
  | "discount"
  | "portionAmount"
  | "portionUnit"
  | "availability"
  | "leadTimeMinutes"
  | "maxQuantityPerOrder"
  | "mayContainAllergenTags"
  | "dietaryTags"
  | "isFeatured"
  | "featuredOrder"
>;

function toRecord(value: ProjectedDish): DishCatalogRecord {
  return {
    id: value._id.toHexString(),
    translations: value.translations,
    slug: value.slug,
    mediaIds: value.mediaIds.map((id) => id.toHexString()),
    categoryIds: value.categoryIds.map((id) => id.toHexString()),
    ingredientIds: value.ingredients.map((ingredient) => ingredient.ingredientId.toHexString()),
    basePriceCents: value.basePriceCents,
    discount: {
      type: value.discount.type,
      amountCents: value.discount.amountCents,
      basisPoints: value.discount.basisPoints,
      startsAt: value.discount.startsAt ? new Date(value.discount.startsAt) : null,
      endsAt: value.discount.endsAt ? new Date(value.discount.endsAt) : null,
    },
    portionAmount: value.portionAmount,
    portionUnit: value.portionUnit,
    availability: {
      mode: value.availability.mode,
      availableFrom: value.availability.availableFrom
        ? new Date(value.availability.availableFrom)
        : null,
      availableUntil: value.availability.availableUntil
        ? new Date(value.availability.availableUntil)
        : null,
    },
    leadTimeMinutes: value.leadTimeMinutes,
    maxQuantityPerOrder: value.maxQuantityPerOrder,
    mayContainAllergenTags: value.mayContainAllergenTags,
    dietaryTags: value.dietaryTags,
    isFeatured: value.isFeatured,
    featuredOrder: value.featuredOrder,
  };
}

export function createDishCatalogRepository(connection: Connection): DishCatalogRepository {
  const Dish = getDishModel(connection);
  return {
    async list(plan) {
      const [items, total] = await Promise.all([
        Dish.find(plan.filter, PUBLIC_CATALOG_PROJECTION)
          .sort(plan.sort)
          .skip(plan.skip)
          .limit(plan.limit)
          .lean<ProjectedDish[]>(),
        Dish.countDocuments(plan.filter),
      ]);
      return { items: items.map(toRecord), total };
    },
  };
}
