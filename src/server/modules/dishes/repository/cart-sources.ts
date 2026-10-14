import "server-only";

import { Types, type ClientSession, type Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import { resolveLocalizedValue } from "@/locales/translation-selection";

import {
  getDishModel,
  type DishAvailability,
  type DishDiscount,
  type DishRecord,
  type DishStatus,
} from "../model/dish";

export type DishCartSource = Readonly<{
  availability: Readonly<{
    availability: DishAvailability;
    deletedAt: Date | null;
    id: string;
    leadTimeMinutes: number;
    maxQuantityPerOrder: number;
    stockQuantity: null;
    status: DishStatus;
  }>;
  pricing: Readonly<{
    basePriceCents: number;
    discount: DishDiscount;
    id: string;
  }>;
}>;

export type DishCartPresentation = Readonly<{
  id: string;
  imageMediaId: string | null;
  name: string;
  slug: string;
}>;

type ProjectedDish = Pick<
  DishRecord,
  | "_id"
  | "availability"
  | "basePriceCents"
  | "deletedAt"
  | "discount"
  | "leadTimeMinutes"
  | "maxQuantityPerOrder"
  | "status"
>;

/** Public Carts-facing projection; callers never receive or query the Dish model. */
export async function loadDishCartSources(
  connection: Connection,
  dishIds: readonly string[],
  session: ClientSession | null = null,
): Promise<readonly DishCartSource[]> {
  const validIds = [...new Set(dishIds)].filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];
  const query = getDishModel(connection)
    .find(
      { _id: { $in: validIds } },
      {
        availability: 1,
        basePriceCents: 1,
        deletedAt: 1,
        discount: 1,
        leadTimeMinutes: 1,
        maxQuantityPerOrder: 1,
        status: 1,
      },
      session ? { session } : {},
    )
    .lean<ProjectedDish[]>();
  const records = await query;
  const byId = new Map(records.map((record) => [record._id.toHexString(), record]));
  return validIds.flatMap((id) => {
    const record = byId.get(id);
    if (!record) return [];
    return [
      {
        availability: {
          id,
          status: record.status,
          deletedAt: record.deletedAt,
          availability: {
            mode: record.availability.mode,
            availableFrom: record.availability.availableFrom,
            availableUntil: record.availability.availableUntil,
          },
          leadTimeMinutes: record.leadTimeMinutes,
          maxQuantityPerOrder: record.maxQuantityPerOrder,
          stockQuantity: null,
        },
        pricing: {
          id,
          basePriceCents: record.basePriceCents,
          discount: {
            type: record.discount.type,
            amountCents: record.discount.amountCents,
            basisPoints: record.discount.basisPoints,
            startsAt: record.discount.startsAt,
            endsAt: record.discount.endsAt,
          },
        },
      },
    ];
  });
}

type PresentationDish = Pick<DishRecord, "_id" | "mediaIds" | "slug" | "translations">;

/** Localized, public-safe identity fields used to render cart lines. */
export async function loadDishCartPresentations(
  connection: Connection,
  dishIds: readonly string[],
  locale: SupportedLocale,
): Promise<readonly DishCartPresentation[]> {
  const validIds = [...new Set(dishIds)].filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];
  const records = await getDishModel(connection)
    .find({ _id: { $in: validIds } }, { mediaIds: { $slice: 1 }, slug: 1, translations: 1 })
    .lean<PresentationDish[]>();
  const byId = new Map(records.map((record) => [record._id.toHexString(), record]));
  return validIds.flatMap((id) => {
    const record = byId.get(id);
    const name = record
      ? resolveLocalizedValue(record.translations, "name", locale)?.value
      : undefined;
    return record && name
      ? [
          {
            id,
            imageMediaId: record.mediaIds[0]?.toHexString() ?? null,
            name,
            slug: record.slug,
          },
        ]
      : [];
  });
}
