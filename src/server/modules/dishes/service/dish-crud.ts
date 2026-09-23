import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { tagsForContentChange, type CacheTag } from "@/server/cache";
import { validateTranslationValues } from "@/server/database/schema";
import { INGREDIENT_ALLERGEN_TAGS, type IngredientAllergenTag } from "@/server/modules/ingredients";
import { resolveUniqueSlug } from "@/server/slugs";

import {
  DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
  DISH_DIETARY_TAGS,
  DISH_INGREDIENT_QUANTITY_UNITS,
  DISH_MAX_LEAD_TIME_MINUTES,
  DISH_MAX_QUANTITY_PER_ORDER,
  DISH_PORTION_UNITS,
  type DishAvailability,
  type DishDietaryTag,
  type DishDiscount,
  type DishStatus,
  type DishTranslation,
} from "../model/dish";
import { validateDishPricingDefinition } from "../pricing/dish-pricing";
import {
  DishRepositoryConflictError,
  type DishIngredientSnapshot,
  type DishListOptions,
  type DishRepository,
  type DishSnapshot,
  type DishWrite,
} from "../repository/dish";

export type DishAction = "create" | "read" | "update" | "archive" | "restore";
export type DishActor = Readonly<{ id: string; role: AdminRole }>;
export type DishAuditEvent = Readonly<{
  action: DishAction;
  outcome: "success" | "failure" | "denied";
  actorId: string;
  dishId: string | null;
}>;

export const DISH_REFERENCE_KINDS = ["media", "category", "ingredient", "dish", "blog"] as const;
export type DishReferenceKind = (typeof DISH_REFERENCE_KINDS)[number];
export type DishReferenceIssue = Readonly<{ kind: DishReferenceKind; id: string }>;
export type DishReferenceSet = Readonly<{
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredientIds: readonly string[];
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
}>;
export type DishReferenceInspection = Readonly<{
  missing: readonly DishReferenceIssue[];
  archived: readonly DishReferenceIssue[];
}>;

export type DishSeoPort = Readonly<{
  sync(dish: DishSnapshot): Promise<string>;
}>;

export type DishServiceDependencies = Readonly<{
  repository: DishRepository;
  inspectReferences(references: DishReferenceSet): Promise<DishReferenceInspection>;
  seo: DishSeoPort;
  audit(event: DishAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
}>;

export type DishInput = Readonly<{
  translations: readonly DishTranslation[];
  slugOverride?: string | null;
  mediaIds?: readonly string[];
  categoryIds?: readonly string[];
  ingredients?: readonly DishIngredientSnapshot[];
  basePriceCents: number;
  discount?: DishDiscount;
  portionAmount?: number;
  portionUnit?: DishWrite["portionUnit"];
  availability?: DishAvailability;
  leadTimeMinutes?: number;
  maxQuantityPerOrder?: number;
  mayContainAllergenTags?: readonly IngredientAllergenTag[];
  dietaryTags?: readonly DishDietaryTag[];
  isFeatured?: boolean;
  featuredOrder?: number;
  relatedDishIds?: readonly string[];
  relatedBlogIds?: readonly string[];
  status?: DishStatus;
}>;

export type DishUpdate = Partial<DishInput>;

export const DISH_SERVICE_ERROR_CODES = [
  "forbidden",
  "invalid_input",
  "not_found",
  "conflict",
  "missing_reference",
  "archived_reference",
  "self_relationship",
  "circular_relationship",
  "not_archived",
] as const;
export type DishServiceErrorCode = (typeof DISH_SERVICE_ERROR_CODES)[number];

export class DishServiceError extends Error {
  constructor(
    readonly code: DishServiceErrorCode,
    readonly issues: readonly DishReferenceIssue[] = [],
  ) {
    super(code);
    this.name = "DishServiceError";
  }
}

const objectId = z.string().regex(/^[a-f\d]{24}$/iu);
const optionalDate = z.date().nullable();
const specification = z.strictObject({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(240),
});
const richText = z
  .strictObject({ type: z.literal("doc"), content: z.array(z.unknown()).optional() })
  .nullable()
  .optional()
  .refine((value) => JSON.stringify(value).length <= 100_000);
const translation = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  name: z.string().trim().min(1).max(160),
  excerpt: z.string().trim().max(500).optional(),
  description: richText,
  specifications: z.array(specification).max(100),
});
const ingredient = z
  .strictObject({
    ingredientId: objectId,
    notes: z.array(
      z.strictObject({
        locale: z.enum(SUPPORTED_LOCALES),
        note: z.string().trim().min(1).max(240),
      }),
    ),
    quantityAmount: z.number().finite().positive().max(1_000_000).nullable(),
    quantityUnit: z.enum(DISH_INGREDIENT_QUANTITY_UNITS).nullable(),
  })
  .refine((value) => (value.quantityAmount === null) === (value.quantityUnit === null));
const discount = z.strictObject({
  type: z.enum(["none", "fixed", "percentage"]),
  amountCents: z.number().nullable(),
  basisPoints: z.number().nullable(),
  startsAt: optionalDate,
  endsAt: optionalDate,
});
const availability = z.strictObject({
  mode: z.enum(["available", "unavailable", "scheduled"]),
  availableFrom: optionalDate,
  availableUntil: optionalDate,
});
const inputSchema = z.strictObject({
  translations: z.array(translation).min(1).max(SUPPORTED_LOCALES.length),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  mediaIds: z.array(objectId).max(30).optional(),
  categoryIds: z.array(objectId).max(20).optional(),
  ingredients: z.array(ingredient).max(200).optional(),
  basePriceCents: z.number().int().safe().nonnegative(),
  discount: discount.optional(),
  portionAmount: z.number().int().safe().positive().max(1_000_000).optional(),
  portionUnit: z.enum(DISH_PORTION_UNITS).optional(),
  availability: availability.optional(),
  leadTimeMinutes: z.number().int().safe().min(0).max(DISH_MAX_LEAD_TIME_MINUTES).optional(),
  maxQuantityPerOrder: z.number().int().min(1).max(DISH_MAX_QUANTITY_PER_ORDER).optional(),
  mayContainAllergenTags: z.array(z.enum(INGREDIENT_ALLERGEN_TAGS)).optional(),
  dietaryTags: z.array(z.enum(DISH_DIETARY_TAGS)).optional(),
  isFeatured: z.boolean().optional(),
  featuredOrder: z.number().int().safe().nonnegative().optional(),
  relatedDishIds: z.array(objectId).max(30).optional(),
  relatedBlogIds: z.array(objectId).max(30).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});
const updateSchema = inputSchema.partial().refine((value) => Object.keys(value).length > 0);
const listOptionsSchema = z.strictObject({
  page: z.number().int().safe().min(1),
  pageSize: z.number().int().safe().min(1).max(100),
  status: z.enum(["draft", "published", "archived"]).optional(),
  categoryId: objectId.optional(),
  search: z.string().trim().max(80).optional(),
  sortBy: z.enum(["name", "createdAt", "basePriceCents", "status"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

const NONE_DISCOUNT: DishDiscount = {
  type: "none",
  amountCents: null,
  basisPoints: null,
  startsAt: null,
  endsAt: null,
};
const AVAILABLE: DishAvailability = {
  mode: "available",
  availableFrom: null,
  availableUntil: null,
};

function unique(values: readonly string[]): boolean {
  return new Set(values.map((value) => value.toLowerCase())).size === values.length;
}

function canonicalName(translations: readonly DishTranslation[]): string {
  const value = translations.find((entry) => entry.locale === "en")?.name;
  if (!value) throw new DishServiceError("invalid_input");
  return value;
}

function normalizeDietaryTags(tags: readonly DishDietaryTag[]): readonly DishDietaryTag[] {
  const normalized = new Set(tags);
  if (normalized.has("vegan")) normalized.add("vegetarian");
  return DISH_DIETARY_TAGS.filter((tag) => normalized.has(tag));
}

function validateTranslations(translations: readonly DishTranslation[]): void {
  if (
    validateTranslationValues<DishTranslation>(translations, { canonicalTextFields: ["name"] })
      .length ||
    translations.some(
      (entry) =>
        new Set(entry.specifications.map((item) => item.label.trim().toLocaleLowerCase("en")))
          .size !== entry.specifications.length,
    )
  ) {
    throw new DishServiceError("invalid_input");
  }
}

function validateAvailability(value: DishAvailability): void {
  const from = value.availableFrom?.getTime() ?? null;
  const until = value.availableUntil?.getTime() ?? null;
  if (
    (from !== null && !Number.isFinite(from)) ||
    (until !== null && !Number.isFinite(until)) ||
    (value.mode === "scheduled" && from === null && until === null) ||
    (value.mode !== "scheduled" && (from !== null || until !== null)) ||
    (from !== null && until !== null && until <= from)
  ) {
    throw new DishServiceError("invalid_input");
  }
}

function validateWrite(value: DishWrite): void {
  validateTranslations(value.translations);
  if (
    !unique(value.mediaIds) ||
    !unique(value.categoryIds) ||
    !unique(value.ingredients.map((item) => item.ingredientId)) ||
    !unique(value.relatedDishIds) ||
    !unique(value.relatedBlogIds) ||
    !unique(value.mayContainAllergenTags) ||
    !unique(value.dietaryTags) ||
    value.ingredients.some(
      (item) =>
        item.notes.length > 0 &&
        validateTranslationValues<(typeof item.notes)[number]>(item.notes, {
          canonicalTextFields: ["note"],
        }).length > 0,
    ) ||
    validateDishPricingDefinition(value.basePriceCents, value.discount).length > 0
  ) {
    throw new DishServiceError("invalid_input");
  }
  validateAvailability(value.availability);
  if (
    value.status === "published" &&
    (value.translations.length !== SUPPORTED_LOCALES.length ||
      value.mediaIds.length === 0 ||
      value.categoryIds.length === 0 ||
      value.ingredients.length === 0)
  ) {
    throw new DishServiceError("invalid_input");
  }
}

function referencesFrom(value: DishWrite): DishReferenceSet {
  return {
    mediaIds: value.mediaIds,
    categoryIds: value.categoryIds,
    ingredientIds: value.ingredients.map((item) => item.ingredientId),
    relatedDishIds: value.relatedDishIds,
    relatedBlogIds: value.relatedBlogIds,
  };
}

async function validateReferences(
  deps: DishServiceDependencies,
  value: DishWrite,
  dishId?: string,
): Promise<void> {
  if (dishId && value.relatedDishIds.some((id) => id.toLowerCase() === dishId.toLowerCase())) {
    throw new DishServiceError("self_relationship", [{ kind: "dish", id: dishId }]);
  }
  const inspection = await deps.inspectReferences(referencesFrom(value));
  if (inspection.missing.length > 0) {
    throw new DishServiceError("missing_reference", inspection.missing);
  }
  if (inspection.archived.length > 0) {
    throw new DishServiceError("archived_reference", inspection.archived);
  }
  if (
    dishId &&
    value.relatedDishIds.length > 0 &&
    (await deps.repository.wouldCreateRelationshipCycle(dishId, value.relatedDishIds))
  ) {
    throw new DishServiceError("circular_relationship");
  }
}

function createWrite(input: DishInput, slug: string): DishWrite {
  return {
    translations: input.translations,
    slug,
    mediaIds: input.mediaIds ?? [],
    categoryIds: input.categoryIds ?? [],
    ingredients: input.ingredients ?? [],
    basePriceCents: input.basePriceCents,
    discount: input.discount ?? NONE_DISCOUNT,
    portionAmount: input.portionAmount ?? 1,
    portionUnit: input.portionUnit ?? "serving",
    availability: input.availability ?? AVAILABLE,
    leadTimeMinutes: input.leadTimeMinutes ?? 0,
    maxQuantityPerOrder: input.maxQuantityPerOrder ?? DISH_DEFAULT_MAX_QUANTITY_PER_ORDER,
    mayContainAllergenTags: input.mayContainAllergenTags ?? [],
    dietaryTags: normalizeDietaryTags(input.dietaryTags ?? []),
    isFeatured: input.isFeatured ?? false,
    featuredOrder: input.featuredOrder ?? 0,
    relatedDishIds: input.relatedDishIds ?? [],
    relatedBlogIds: input.relatedBlogIds ?? [],
    status: input.status ?? "draft",
  };
}

function updateWrite(current: DishSnapshot, update: DishUpdate, slug: string): DishWrite {
  return {
    translations: update.translations ?? current.translations,
    slug,
    mediaIds: update.mediaIds ?? current.mediaIds,
    categoryIds: update.categoryIds ?? current.categoryIds,
    ingredients: update.ingredients ?? current.ingredients,
    basePriceCents: update.basePriceCents ?? current.basePriceCents,
    discount: update.discount ?? current.discount,
    portionAmount: update.portionAmount ?? current.portionAmount,
    portionUnit: update.portionUnit ?? current.portionUnit,
    availability: update.availability ?? current.availability,
    leadTimeMinutes: update.leadTimeMinutes ?? current.leadTimeMinutes,
    maxQuantityPerOrder: update.maxQuantityPerOrder ?? current.maxQuantityPerOrder,
    mayContainAllergenTags: update.mayContainAllergenTags ?? current.mayContainAllergenTags,
    dietaryTags: normalizeDietaryTags(update.dietaryTags ?? current.dietaryTags),
    isFeatured: update.isFeatured ?? current.isFeatured,
    featuredOrder: update.featuredOrder ?? current.featuredOrder,
    relatedDishIds: update.relatedDishIds ?? current.relatedDishIds,
    relatedBlogIds: update.relatedBlogIds ?? current.relatedBlogIds,
    status: update.status ?? current.status,
  };
}

function requirePermission(actor: DishActor, action: DishAction): void {
  const permission =
    action === "create"
      ? "dishes:create"
      : action === "read"
        ? "dishes:read"
        : action === "restore"
          ? "dishes:delete"
          : "dishes:update";
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new DishServiceError("forbidden");
  }
}

async function execute<T>(
  deps: DishServiceDependencies,
  actor: DishActor,
  action: DishAction,
  work: () => Promise<Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>>,
): Promise<T> {
  let result: Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>;
  try {
    requirePermission(actor, action);
    result = await work();
  } catch (error) {
    await deps.audit({
      action,
      actorId: actor.id,
      dishId: null,
      outcome:
        error instanceof DishServiceError && error.code === "forbidden" ? "denied" : "failure",
    });
    throw error;
  }
  try {
    await deps.audit({ action, actorId: actor.id, dishId: result.id, outcome: "success" });
  } finally {
    if (result.changedIds) {
      for (const tag of tagsForContentChange({ area: "dishes", ids: result.changedIds })) {
        deps.invalidate(tag);
      }
    }
  }
  return result.value;
}

async function synchronizeSeo(
  deps: DishServiceDependencies,
  dish: DishSnapshot,
  actorId: string,
): Promise<DishSnapshot> {
  const seoPageId = await deps.seo.sync(dish);
  return dish.seoPageId === seoPageId
    ? dish
    : deps.repository.setSeoPageId(dish, seoPageId, actorId);
}

export function createDishServices(deps: DishServiceDependencies) {
  return {
    async create(actor: DishActor, raw: DishInput): Promise<DishSnapshot> {
      return execute(deps, actor, "create", async () => {
        const parsed = inputSchema.safeParse(raw);
        if (!parsed.success || parsed.data.status === "archived") {
          throw new DishServiceError("invalid_input");
        }
        const input = parsed.data as DishInput;
        const name = canonicalName(input.translations);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const slug = (
            await resolveUniqueSlug({
              canonicalText: name,
              ...(input.slugOverride !== undefined ? { adminOverride: input.slugOverride } : {}),
              isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate),
            })
          ).slug;
          const value = createWrite(input, slug);
          validateWrite(value);
          await validateReferences(deps, value);
          let created: DishSnapshot;
          try {
            created = await deps.repository.create(value, actor.id);
          } catch (error) {
            if (!(error instanceof DishRepositoryConflictError)) throw error;
            continue;
          }
          const synced = await synchronizeSeo(deps, created, actor.id);
          return { value: synced, id: synced.id, changedIds: [synced.id, synced.slug] };
        }
        throw new DishServiceError("conflict");
      });
    },
    async get(actor: DishActor, id: string): Promise<DishSnapshot> {
      return execute(deps, actor, "read", async () => {
        const found = await deps.repository.findById(id);
        if (!found) throw new DishServiceError("not_found");
        return { value: found, id: found.id };
      });
    },
    async list(
      actor: DishActor,
      options: DishListOptions,
    ): Promise<Awaited<ReturnType<DishRepository["list"]>>> {
      return execute(deps, actor, "read", async () => {
        const parsed = listOptionsSchema.safeParse(options);
        if (!parsed.success) {
          throw new DishServiceError("invalid_input");
        }
        const validated: DishListOptions = {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
          ...(parsed.data.search !== undefined ? { search: parsed.data.search } : {}),
          ...(parsed.data.sortBy !== undefined ? { sortBy: parsed.data.sortBy } : {}),
          ...(parsed.data.sortDirection !== undefined
            ? { sortDirection: parsed.data.sortDirection }
            : {}),
        };
        return { value: await deps.repository.list(validated), id: null };
      });
    },
    async update(actor: DishActor, id: string, raw: DishUpdate): Promise<DishSnapshot> {
      return execute(deps, actor, "update", async () => {
        const parsed = updateSchema.safeParse(raw);
        if (!parsed.success || parsed.data.status === "archived") {
          throw new DishServiceError("invalid_input");
        }
        const current = await deps.repository.findById(id);
        if (!current) throw new DishServiceError("not_found");
        const update = parsed.data as DishUpdate;
        const slug = (
          await resolveUniqueSlug({
            canonicalText: canonicalName(update.translations ?? current.translations),
            ...(update.slugOverride !== undefined ? { adminOverride: update.slugOverride } : {}),
            currentSlug: current.slug,
            isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate, id),
          })
        ).slug;
        const value = updateWrite(current, update, slug);
        validateWrite(value);
        await validateReferences(deps, value, id);
        try {
          const saved = await deps.repository.save(current, value, actor.id);
          const synced = await synchronizeSeo(deps, saved, actor.id);
          return { value: synced, id, changedIds: [id, current.slug, synced.slug] };
        } catch (error) {
          if (error instanceof DishRepositoryConflictError) {
            throw new DishServiceError("conflict");
          }
          throw error;
        }
      });
    },
    async archive(actor: DishActor, id: string): Promise<DishSnapshot> {
      return execute(deps, actor, "archive", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new DishServiceError("not_found");
        try {
          const saved = await deps.repository.save(
            current,
            updateWrite(current, { status: "archived", isFeatured: false }, current.slug),
            actor.id,
          );
          const affectedIds = await deps.repository.removeInboundRelationships(id, actor.id);
          const synced = await synchronizeSeo(deps, saved, actor.id);
          return {
            value: synced,
            id,
            changedIds: [id, current.slug, ...affectedIds],
          };
        } catch (error) {
          if (error instanceof DishRepositoryConflictError) {
            throw new DishServiceError("conflict");
          }
          throw error;
        }
      });
    },
    async restore(actor: DishActor, id: string): Promise<DishSnapshot> {
      return execute(deps, actor, "restore", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new DishServiceError("not_found");
        if (current.status !== "archived") throw new DishServiceError("not_archived");
        const value = updateWrite(current, { status: "draft" }, current.slug);
        validateWrite(value);
        await validateReferences(deps, value, id);
        try {
          const restored = await deps.repository.save(current, value, actor.id);
          const synced = await synchronizeSeo(deps, restored, actor.id);
          return { value: synced, id, changedIds: [id, current.slug] };
        } catch (error) {
          if (error instanceof DishRepositoryConflictError) {
            throw new DishServiceError("conflict");
          }
          throw error;
        }
      });
    },
  };
}
