import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { escapeSearchPattern } from "@/server/database";
import { createActorMetadata, normalizeSearchText } from "@/server/database/schema";
import type { IngredientAllergenTag } from "@/server/modules/ingredients";

import {
  getDishModel,
  type DishAvailability,
  type DishDietaryTag,
  type DishDiscount,
  type DishIngredientQuantityUnit,
  type DishPortionUnit,
  type DishStatus,
  type DishTranslation,
} from "../model/dish";

export type DishIngredientSnapshot = Readonly<{
  ingredientId: string;
  notes: readonly Readonly<{ locale: "en" | "pt-PT" | "fa"; note: string }>[];
  quantityAmount: number | null;
  quantityUnit: DishIngredientQuantityUnit | null;
}>;

export type DishSnapshot = Readonly<{
  id: string;
  translations: readonly DishTranslation[];
  slug: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredients: readonly DishIngredientSnapshot[];
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
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  seoPageId: string | null;
  soldCount: number;
  viewCount: number;
  status: DishStatus;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type DishWrite = Readonly<{
  translations: readonly DishTranslation[];
  slug: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredients: readonly DishIngredientSnapshot[];
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
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  status: DishStatus;
}>;

export type DishListOptions = Readonly<{
  page: number;
  pageSize: number;
  status?: DishStatus;
  categoryId?: string;
  availability?: DishAvailability["mode"];
  featured?: boolean;
  search?: string;
  sortBy?:
    | "name"
    | "createdAt"
    | "basePriceCents"
    | "status"
    | "soldCount"
    | "viewCount"
    | "featuredOrder";
  sortDirection?: "asc" | "desc";
}>;

export type DishListResult = Readonly<{ items: readonly DishSnapshot[]; total: number }>;

export class DishRepositoryConflictError extends Error {
  constructor() {
    super("dish_conflict");
    this.name = "DishRepositoryConflictError";
  }
}

export interface DishRepository {
  findById(id: string, includeDeleted?: boolean): Promise<DishSnapshot | null>;
  findBySlug(slug: string): Promise<DishSnapshot | null>;
  list(options: DishListOptions): Promise<DishListResult>;
  isSlugTaken(slug: string, excludingId?: string): Promise<boolean>;
  wouldCreateRelationshipCycle(dishId: string, relatedDishIds: readonly string[]): Promise<boolean>;
  create(value: DishWrite, actorId: string): Promise<DishSnapshot>;
  save(current: DishSnapshot, value: DishWrite, actorId: string): Promise<DishSnapshot>;
  setSeoPageId(current: DishSnapshot, seoPageId: string, actorId: string): Promise<DishSnapshot>;
  removeInboundRelationships(dishId: string, actorId: string): Promise<readonly string[]>;
}

function snapshot(document: InstanceType<ReturnType<typeof getDishModel>>): DishSnapshot {
  return {
    id: document._id.toHexString(),
    translations: document.translations.map((translation) => ({
      locale: translation.locale,
      name: translation.name,
      ...(translation.excerpt !== undefined ? { excerpt: translation.excerpt } : {}),
      ...(translation.description !== undefined ? { description: translation.description } : {}),
      specifications: translation.specifications.map((item) => ({ ...item })),
    })),
    slug: document.slug,
    mediaIds: document.mediaIds.map((id) => id.toHexString()),
    categoryIds: document.categoryIds.map((id) => id.toHexString()),
    ingredients: document.ingredients.map((ingredient) => ({
      ingredientId: ingredient.ingredientId.toHexString(),
      notes: ingredient.notes.map((note) => ({ ...note })),
      quantityAmount: ingredient.quantityAmount,
      quantityUnit: ingredient.quantityUnit,
    })),
    basePriceCents: document.basePriceCents,
    discount: {
      type: document.discount.type,
      amountCents: document.discount.amountCents,
      basisPoints: document.discount.basisPoints,
      startsAt: document.discount.startsAt ? new Date(document.discount.startsAt) : null,
      endsAt: document.discount.endsAt ? new Date(document.discount.endsAt) : null,
    },
    portionAmount: document.portionAmount,
    portionUnit: document.portionUnit,
    availability: {
      mode: document.availability.mode,
      availableFrom: document.availability.availableFrom
        ? new Date(document.availability.availableFrom)
        : null,
      availableUntil: document.availability.availableUntil
        ? new Date(document.availability.availableUntil)
        : null,
    },
    leadTimeMinutes: document.leadTimeMinutes,
    maxQuantityPerOrder: document.maxQuantityPerOrder,
    mayContainAllergenTags: [...document.mayContainAllergenTags],
    dietaryTags: [...document.dietaryTags],
    isFeatured: document.isFeatured,
    featuredOrder: document.featuredOrder,
    relatedDishIds: document.relatedDishIds.map((id) => id.toHexString()),
    relatedBlogIds: document.relatedBlogIds.map((id) => id.toHexString()),
    seoPageId: document.seoPageId?.toHexString() ?? null,
    soldCount: document.soldCount,
    viewCount: document.viewCount,
    status: document.status,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function objectIds(values: readonly string[]): Types.ObjectId[] {
  return values.map((value) => new Types.ObjectId(value));
}

function applyWrite(document: InstanceType<ReturnType<typeof getDishModel>>, value: DishWrite) {
  document.translations = value.translations.map((translation) => ({
    ...translation,
    specifications: translation.specifications.map((item) => ({ ...item })),
  }));
  document.slug = value.slug;
  document.mediaIds = objectIds(value.mediaIds);
  document.categoryIds = objectIds(value.categoryIds);
  document.ingredients = value.ingredients.map((ingredient) => ({
    ...ingredient,
    ingredientId: new Types.ObjectId(ingredient.ingredientId),
    notes: ingredient.notes.map((note) => ({ ...note })),
  }));
  document.basePriceCents = value.basePriceCents;
  document.discount = { ...value.discount };
  document.portionAmount = value.portionAmount;
  document.portionUnit = value.portionUnit;
  document.availability = { ...value.availability };
  document.leadTimeMinutes = value.leadTimeMinutes;
  document.maxQuantityPerOrder = value.maxQuantityPerOrder;
  document.mayContainAllergenTags = [...value.mayContainAllergenTags];
  document.dietaryTags = [...value.dietaryTags];
  document.isFeatured = value.isFeatured;
  document.featuredOrder = value.featuredOrder;
  document.relatedDishIds = objectIds(value.relatedDishIds);
  document.relatedBlogIds = objectIds(value.relatedBlogIds);
  document.status = value.status;
}

export function createDishRepository(connection: Connection): DishRepository {
  const Dish = getDishModel(connection);
  const load = async (current: DishSnapshot) => {
    const document = await Dish.findById(current.id);
    if (!document || document.get("__v") !== current.version) {
      throw new DishRepositoryConflictError();
    }
    return document;
  };

  return {
    async findById(id, includeDeleted = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Dish.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeDeleted ? { deletedAt: null } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async findBySlug(slug) {
      const document = await Dish.findOne({ slug, deletedAt: null });
      return document ? snapshot(document) : null;
    },
    async list(options) {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (options.status) filter.status = options.status;
      if (options.categoryId && Types.ObjectId.isValid(options.categoryId)) {
        filter.categoryIds = new Types.ObjectId(options.categoryId);
      }
      if (options.availability) filter["availability.mode"] = options.availability;
      if (options.featured !== undefined) filter.isFeatured = options.featured;
      if (options.search) {
        filter.normalizedSearchText = {
          $regex: escapeSearchPattern(normalizeSearchText(options.search)),
        };
      }
      const sortBy =
        options.sortBy === "name" ? "normalizedSearchText" : (options.sortBy ?? "createdAt");
      const direction = options.sortDirection === "asc" ? 1 : -1;
      const [documents, total] = await Promise.all([
        Dish.find(filter)
          .sort({ [sortBy]: direction, _id: direction })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Dish.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async isSlugTaken(slug, excludingId) {
      return Boolean(
        await Dish.exists({
          slug,
          ...(excludingId && Types.ObjectId.isValid(excludingId)
            ? { _id: { $ne: new Types.ObjectId(excludingId) } }
            : {}),
        }),
      );
    },
    async wouldCreateRelationshipCycle(dishId, relatedDishIds) {
      if (!Types.ObjectId.isValid(dishId)) return true;
      const target = dishId.toLowerCase();
      let frontier = [...relatedDishIds];
      const visited = new Set<string>();
      while (frontier.length > 0) {
        if (frontier.some((id) => id.toLowerCase() === target)) return true;
        const nextIds = frontier.filter((id) => !visited.has(id));
        if (nextIds.length === 0) return false;
        nextIds.forEach((id) => visited.add(id));
        if (visited.size > 10_000) return true;
        const documents = await Dish.find({
          _id: { $in: objectIds(nextIds) },
          deletedAt: null,
          status: { $ne: "archived" },
        }).select({ relatedDishIds: 1 });
        frontier = documents.flatMap((document) =>
          document.relatedDishIds.map((id) => id.toHexString()),
        );
      }
      return false;
    },
    async create(value, actorId) {
      const document = new Dish();
      applyWrite(document, value);
      document.createdBy = createActorMetadata("admin", actorId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new DishRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async save(current, value, actorId) {
      const document = await load(current);
      applyWrite(document, value);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new DishRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async setSeoPageId(current, seoPageId, actorId) {
      const document = await load(current);
      document.seoPageId = new Types.ObjectId(seoPageId);
      document.updatedBy = createActorMetadata("admin", actorId);
      try {
        await document.save();
      } catch (error) {
        if (isConflict(error)) throw new DishRepositoryConflictError();
        throw error;
      }
      return snapshot(document);
    },
    async removeInboundRelationships(dishId, actorId) {
      const id = new Types.ObjectId(dishId);
      const affected = await Dish.find({
        deletedAt: null,
        relatedDishIds: id,
      }).select({ _id: 1 });
      if (affected.length > 0) {
        await Dish.updateMany(
          { _id: { $in: affected.map((document) => document._id) } },
          {
            $pull: { relatedDishIds: id },
            $set: { updatedBy: createActorMetadata("admin", actorId) },
          },
          { timestamps: true },
        );
      }
      return affected.map((document) => document._id.toHexString());
    },
  };
}
