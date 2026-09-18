import "server-only";

import { z } from "zod";

import { SUPPORTED_LOCALES } from "@/constants";
import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { tagsForContentChange, type CacheTag } from "@/server/cache";
import { validateTranslationValues } from "@/server/database/schema";
import { resolveUniqueSlug } from "@/server/slugs";

import type { CategoryStatus, CategoryTranslation } from "../model/category";
import {
  CategoryRepositoryConflictError,
  type CategoryListOptions,
  type CategoryRepository,
  type CategorySnapshot,
  type CategoryWrite,
} from "../repository/category";

export type CategoryAction = "create" | "read" | "update" | "archive" | "restore" | "delete";
export type CategoryActor = Readonly<{ id: string; role: AdminRole }>;
export type CategoryAuditEvent = Readonly<{
  action: CategoryAction;
  outcome: "success" | "failure" | "denied";
  actorId: string;
  categoryId: string | null;
}>;

export type CategorySeoPort = Readonly<{
  sync(category: CategorySnapshot): Promise<string>;
  remove(category: CategorySnapshot): Promise<void>;
}>;

export type CategoryServiceDependencies = Readonly<{
  repository: CategoryRepository;
  validateMedia(
    references: Readonly<{ bannerMediaId: string | null; imageMediaId: string | null }>,
  ): Promise<void>;
  countDishReferences(categoryId: string): Promise<number>;
  seo: CategorySeoPort;
  audit(event: CategoryAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
}>;

export type CategoryInput = Readonly<{
  translations: readonly CategoryTranslation[];
  bannerMediaId?: string | null;
  imageMediaId?: string | null;
  slugOverride?: string | null;
  status?: CategoryStatus;
  sortOrder?: number;
}>;

export type CategoryUpdate = Partial<CategoryInput>;

export class CategoryServiceError extends Error {
  constructor(
    readonly code:
      "forbidden" | "invalid_input" | "not_found" | "conflict" | "referenced" | "not_archived",
  ) {
    super(code);
    this.name = "CategoryServiceError";
  }
}

const translationSchema = z.strictObject({
  locale: z.enum(SUPPORTED_LOCALES),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(1).max(20_000),
});
const inputSchema = z.strictObject({
  translations: z.array(translationSchema).min(1).max(SUPPORTED_LOCALES.length),
  bannerMediaId: z
    .string()
    .regex(/^[a-f\d]{24}$/iu)
    .nullable()
    .optional(),
  imageMediaId: z
    .string()
    .regex(/^[a-f\d]{24}$/iu)
    .nullable()
    .optional(),
  slugOverride: z.string().trim().min(1).max(160).nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  sortOrder: z.number().int().nonnegative().safe().optional(),
});
const updateSchema = inputSchema.partial().refine((value) => Object.keys(value).length > 0);

function canonicalName(translations: readonly CategoryTranslation[]): string {
  const name = translations.find((entry) => entry.locale === "en")?.name;
  if (!name) throw new CategoryServiceError("invalid_input");
  return name;
}

function validateTranslations(translations: readonly CategoryTranslation[]): void {
  if (
    validateTranslationValues<CategoryTranslation>(translations, {
      canonicalTextFields: ["name", "description"],
    }).length
  ) {
    throw new CategoryServiceError("invalid_input");
  }
}

function parseInput(input: CategoryInput): CategoryInput {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || parsed.data.status === "archived")
    throw new CategoryServiceError("invalid_input");
  validateTranslations(parsed.data.translations);
  return parsed.data as CategoryInput;
}

function parseUpdate(input: CategoryUpdate): CategoryUpdate {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success || parsed.data.status === "archived")
    throw new CategoryServiceError("invalid_input");
  if (parsed.data.translations) validateTranslations(parsed.data.translations);
  return parsed.data as CategoryUpdate;
}

function requirePermission(actor: CategoryActor, action: CategoryAction): void {
  const permission =
    action === "create"
      ? "categories:create"
      : action === "delete" || action === "restore"
        ? "categories:delete"
        : action === "read"
          ? "categories:read"
          : "categories:update";
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new CategoryServiceError("forbidden");
  }
}

function invalidate(dependencies: CategoryServiceDependencies, ids: readonly string[]): void {
  for (const tag of tagsForContentChange({ area: "categories", ids })) dependencies.invalidate(tag);
}

function toWrite(current: CategorySnapshot, update: CategoryUpdate, slug: string): CategoryWrite {
  return {
    translations: update.translations ?? current.translations,
    slug,
    bannerMediaId:
      update.bannerMediaId === undefined ? current.bannerMediaId : update.bannerMediaId,
    imageMediaId: update.imageMediaId === undefined ? current.imageMediaId : update.imageMediaId,
    status: update.status ?? current.status,
    sortOrder: update.sortOrder ?? current.sortOrder,
  };
}

async function log(
  deps: CategoryServiceDependencies,
  actor: CategoryActor,
  action: CategoryAction,
  outcome: CategoryAuditEvent["outcome"],
  categoryId: string | null,
) {
  await deps.audit({ actorId: actor.id, action, outcome, categoryId });
}

async function execute<T>(
  deps: CategoryServiceDependencies,
  actor: CategoryActor,
  action: CategoryAction,
  work: () => Promise<Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>>,
): Promise<T> {
  let result: Readonly<{ value: T; id: string | null; changedIds?: readonly string[] }>;
  try {
    requirePermission(actor, action);
    result = await work();
  } catch (error) {
    await log(
      deps,
      actor,
      action,
      error instanceof CategoryServiceError && error.code === "forbidden" ? "denied" : "failure",
      null,
    );
    throw error;
  }
  try {
    await log(deps, actor, action, "success", result.id);
  } finally {
    if (result.changedIds) invalidate(deps, result.changedIds);
  }
  return result.value;
}

async function synchronizeSeo(
  deps: CategoryServiceDependencies,
  category: CategorySnapshot,
  actorId: string,
): Promise<CategorySnapshot> {
  const seoPageId = await deps.seo.sync(category);
  if (category.seoPageId === seoPageId) return category;
  return deps.repository.setSeoPageId(category, seoPageId, actorId);
}

export function createCategoryServices(deps: CategoryServiceDependencies) {
  return {
    async create(actor: CategoryActor, raw: CategoryInput): Promise<CategorySnapshot> {
      return execute(deps, actor, "create", async () => {
        const input = parseInput(raw);
        const references = {
          bannerMediaId: input.bannerMediaId ?? null,
          imageMediaId: input.imageMediaId ?? null,
        };
        await deps.validateMedia(references);
        const name = canonicalName(input.translations);
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const slug = (
            await resolveUniqueSlug({
              canonicalText: name,
              ...(input.slugOverride !== undefined ? { adminOverride: input.slugOverride } : {}),
              isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate),
            })
          ).slug;
          try {
            const created = await deps.repository.create(
              {
                translations: input.translations,
                slug,
                ...references,
                status: input.status ?? "draft",
                sortOrder: input.sortOrder ?? 0,
              },
              actor.id,
            );
            const synced = await synchronizeSeo(deps, created, actor.id);
            return { value: synced, id: synced.id, changedIds: [synced.id, synced.slug] };
          } catch (error) {
            if (!(error instanceof CategoryRepositoryConflictError)) throw error;
          }
        }
        throw new CategoryServiceError("conflict");
      });
    },
    async get(actor: CategoryActor, id: string): Promise<CategorySnapshot> {
      return execute(deps, actor, "read", async () => {
        const found = await deps.repository.findById(id);
        if (!found) throw new CategoryServiceError("not_found");
        return { value: found, id: found.id };
      });
    },
    async list(actor: CategoryActor, options: CategoryListOptions) {
      return execute(deps, actor, "read", async () => {
        if (
          !Number.isSafeInteger(options.page) ||
          options.page < 1 ||
          !Number.isSafeInteger(options.pageSize) ||
          options.pageSize < 1 ||
          options.pageSize > 100 ||
          (options.search && options.search.length > 80)
        ) {
          throw new CategoryServiceError("invalid_input");
        }
        const result = await deps.repository.list(options);
        return { value: result, id: null };
      });
    },
    async update(actor: CategoryActor, id: string, raw: CategoryUpdate): Promise<CategorySnapshot> {
      return execute(deps, actor, "update", async () => {
        const update = parseUpdate(raw);
        const current = await deps.repository.findById(id);
        if (!current) throw new CategoryServiceError("not_found");
        const slug = (
          await resolveUniqueSlug({
            canonicalText: canonicalName(update.translations ?? current.translations),
            ...(update.slugOverride !== undefined ? { adminOverride: update.slugOverride } : {}),
            currentSlug: current.slug,
            isSlugTaken: (candidate) => deps.repository.isSlugTaken(candidate, id),
          })
        ).slug;
        const value = toWrite(current, update, slug);
        await deps.validateMedia({
          bannerMediaId: value.bannerMediaId,
          imageMediaId: value.imageMediaId,
        });
        const saved = await deps.repository.save(current, value, actor.id);
        const synced = await synchronizeSeo(deps, saved, actor.id);
        return { value: synced, id, changedIds: [id, current.slug, synced.slug] };
      });
    },
    async archive(actor: CategoryActor, id: string): Promise<CategorySnapshot> {
      return execute(deps, actor, "archive", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new CategoryServiceError("not_found");
        if (await deps.countDishReferences(id)) throw new CategoryServiceError("referenced");
        const saved = await deps.repository.save(
          current,
          toWrite(current, { status: "archived" }, current.slug),
          actor.id,
        );
        const synced = await synchronizeSeo(deps, saved, actor.id);
        return { value: synced, id, changedIds: [id, current.slug] };
      });
    },
    async restore(actor: CategoryActor, id: string): Promise<CategorySnapshot> {
      return execute(deps, actor, "restore", async () => {
        const current = await deps.repository.findById(id, true);
        if (!current?.deletedAt) throw new CategoryServiceError("not_found");
        const restored = await deps.repository.restore(current, actor.id);
        const synced = await synchronizeSeo(deps, restored, actor.id);
        return { value: synced, id, changedIds: [id, synced.slug] };
      });
    },
    async delete(actor: CategoryActor, id: string): Promise<CategorySnapshot> {
      return execute(deps, actor, "delete", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new CategoryServiceError("not_found");
        if (current.status !== "archived") throw new CategoryServiceError("not_archived");
        if (await deps.countDishReferences(id)) throw new CategoryServiceError("referenced");
        const deleted = await deps.repository.softDelete(current, actor.id, new Date());
        await deps.seo.remove(deleted);
        return { value: deleted, id, changedIds: [id, current.slug] };
      });
    },
  };
}
