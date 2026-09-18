import "server-only";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { tagsForContentChange, type CacheTag } from "@/server/cache";
import { validateTranslationValues } from "@/server/database/schema";

import type {
  IngredientAllergenTag,
  IngredientStatus,
  IngredientTranslation,
} from "../model/ingredient";
import { INGREDIENT_ALLERGEN_TAGS } from "../model/ingredient";
import {
  IngredientRepositoryConflictError,
  type IngredientListOptions,
  type IngredientRepository,
  type IngredientSnapshot,
  type IngredientWrite,
} from "../repository/ingredient";

export type IngredientAction = "create" | "read" | "update" | "archive" | "restore" | "delete";
export type IngredientActor = Readonly<{ id: string; role: AdminRole }>;
export type IngredientAuditEvent = Readonly<{
  action: IngredientAction;
  outcome: "success" | "failure" | "denied";
  actorId: string;
  ingredientId: string | null;
}>;
export type IngredientInput = Readonly<{
  translations: readonly IngredientTranslation[];
  imageMediaId?: string | null;
  allergenTags?: readonly IngredientAllergenTag[];
  status?: IngredientStatus;
}>;
export type IngredientUpdate = Partial<IngredientInput>;
export type IngredientServiceDependencies = Readonly<{
  repository: IngredientRepository;
  validateImage(imageMediaId: string | null): Promise<void>;
  countDishReferences(ingredientId: string): Promise<number>;
  audit(event: IngredientAuditEvent): Promise<void>;
  invalidate(tag: CacheTag): void;
}>;

export class IngredientServiceError extends Error {
  constructor(
    readonly code:
      "forbidden" | "invalid_input" | "not_found" | "conflict" | "referenced" | "not_archived",
  ) {
    super(code);
    this.name = "IngredientServiceError";
  }
}

function validateTranslations(translations: readonly IngredientTranslation[]) {
  if (
    validateTranslationValues<IngredientTranslation>(translations, {
      canonicalTextFields: ["name"],
    }).length
  ) {
    throw new IngredientServiceError("invalid_input");
  }
  if (
    translations.some((entry) => entry.name.trim().length < 1 || entry.name.trim().length > 160)
  ) {
    throw new IngredientServiceError("invalid_input");
  }
}

function validateAllergens(tags: readonly IngredientAllergenTag[]) {
  const allowed = new Set<string>(INGREDIENT_ALLERGEN_TAGS);
  if (new Set(tags).size !== tags.length || tags.some((tag) => !allowed.has(tag))) {
    throw new IngredientServiceError("invalid_input");
  }
}

function requirePermission(actor: IngredientActor, action: IngredientAction) {
  const permission =
    action === "create"
      ? "ingredients:create"
      : action === "delete" || action === "restore"
        ? "ingredients:delete"
        : action === "read"
          ? "ingredients:read"
          : "ingredients:update";
  if (!hasAdminPermission({ role: actor.role, active: true }, permission)) {
    throw new IngredientServiceError("forbidden");
  }
}

function toWrite(current: IngredientSnapshot, update: IngredientUpdate): IngredientWrite {
  return {
    translations: update.translations ?? current.translations,
    imageMediaId: update.imageMediaId === undefined ? current.imageMediaId : update.imageMediaId,
    allergenTags: update.allergenTags ?? current.allergenTags,
    status: update.status ?? current.status,
  };
}

async function execute<T>(
  deps: IngredientServiceDependencies,
  actor: IngredientActor,
  action: IngredientAction,
  work: () => Promise<Readonly<{ value: T; id: string | null; changed?: boolean }>>,
): Promise<T> {
  let result: Readonly<{ value: T; id: string | null; changed?: boolean }>;
  try {
    requirePermission(actor, action);
    result = await work();
  } catch (error) {
    await deps.audit({
      action,
      actorId: actor.id,
      ingredientId: null,
      outcome:
        error instanceof IngredientServiceError && error.code === "forbidden"
          ? "denied"
          : "failure",
    });
    throw error;
  }
  try {
    await deps.audit({ action, actorId: actor.id, ingredientId: result.id, outcome: "success" });
  } finally {
    if (result.changed) {
      for (const tag of tagsForContentChange({
        area: "ingredients",
        ids: result.id ? [result.id] : [],
      })) {
        deps.invalidate(tag);
      }
    }
  }
  return result.value;
}

export function createIngredientServices(deps: IngredientServiceDependencies) {
  return {
    async create(actor: IngredientActor, input: IngredientInput): Promise<IngredientSnapshot> {
      return execute(deps, actor, "create", async () => {
        validateTranslations(input.translations);
        const allergens = input.allergenTags ?? [];
        validateAllergens(allergens);
        if (input.status && input.status !== "draft" && input.status !== "published") {
          throw new IngredientServiceError("invalid_input");
        }
        const englishName = input.translations.find((entry) => entry.locale === "en")?.name ?? "";
        if (await deps.repository.isCanonicalNameTaken(englishName)) {
          throw new IngredientServiceError("conflict");
        }
        const imageMediaId = input.imageMediaId ?? null;
        await deps.validateImage(imageMediaId);
        try {
          const created = await deps.repository.create(
            {
              translations: input.translations,
              imageMediaId,
              allergenTags: allergens,
              status: input.status ?? "draft",
            },
            actor.id,
          );
          return { value: created, id: created.id, changed: true };
        } catch (error) {
          if (error instanceof IngredientRepositoryConflictError) {
            throw new IngredientServiceError("conflict");
          }
          throw error;
        }
      });
    },
    async get(actor: IngredientActor, id: string): Promise<IngredientSnapshot> {
      return execute(deps, actor, "read", async () => {
        const found = await deps.repository.findById(id);
        if (!found) throw new IngredientServiceError("not_found");
        return { value: found, id: found.id };
      });
    },
    async list(actor: IngredientActor, options: IngredientListOptions) {
      return execute(deps, actor, "read", async () => {
        if (
          !Number.isSafeInteger(options.page) ||
          options.page < 1 ||
          !Number.isSafeInteger(options.pageSize) ||
          options.pageSize < 1 ||
          options.pageSize > 100
        ) {
          throw new IngredientServiceError("invalid_input");
        }
        return { value: await deps.repository.list(options), id: null };
      });
    },
    async update(
      actor: IngredientActor,
      id: string,
      update: IngredientUpdate,
    ): Promise<IngredientSnapshot> {
      return execute(deps, actor, "update", async () => {
        if (
          Object.keys(update).length === 0 ||
          (update.status && update.status !== "draft" && update.status !== "published")
        ) {
          throw new IngredientServiceError("invalid_input");
        }
        const current = await deps.repository.findById(id);
        if (!current) throw new IngredientServiceError("not_found");
        const value = toWrite(current, update);
        validateTranslations(value.translations);
        validateAllergens(value.allergenTags);
        const englishName = value.translations.find((entry) => entry.locale === "en")?.name ?? "";
        if (await deps.repository.isCanonicalNameTaken(englishName, id)) {
          throw new IngredientServiceError("conflict");
        }
        await deps.validateImage(value.imageMediaId);
        try {
          const saved = await deps.repository.save(current, value, actor.id);
          return { value: saved, id, changed: true };
        } catch (error) {
          if (error instanceof IngredientRepositoryConflictError) {
            throw new IngredientServiceError("conflict");
          }
          throw error;
        }
      });
    },
    async archive(actor: IngredientActor, id: string): Promise<IngredientSnapshot> {
      return execute(deps, actor, "archive", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new IngredientServiceError("not_found");
        const saved = await deps.repository.save(
          current,
          toWrite(current, { status: "archived" }),
          actor.id,
        );
        return { value: saved, id, changed: true };
      });
    },
    async restore(actor: IngredientActor, id: string): Promise<IngredientSnapshot> {
      return execute(deps, actor, "restore", async () => {
        const current = await deps.repository.findById(id, true);
        if (!current?.deletedAt) throw new IngredientServiceError("not_found");
        if (
          await deps.repository.isCanonicalNameTaken(
            current.translations.find((entry) => entry.locale === "en")?.name ?? "",
            id,
          )
        ) {
          throw new IngredientServiceError("conflict");
        }
        const restored = await deps.repository.restore(current, actor.id);
        return { value: restored, id, changed: true };
      });
    },
    async delete(actor: IngredientActor, id: string): Promise<IngredientSnapshot> {
      return execute(deps, actor, "delete", async () => {
        const current = await deps.repository.findById(id);
        if (!current) throw new IngredientServiceError("not_found");
        if (current.status !== "archived") throw new IngredientServiceError("not_archived");
        if (await deps.countDishReferences(id)) throw new IngredientServiceError("referenced");
        const deleted = await deps.repository.softDelete(current, actor.id, new Date());
        return { value: deleted, id, changed: true };
      });
    },
  };
}
