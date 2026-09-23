import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DishServiceError,
  createDishServices,
  type DishInput,
  type DishReferenceIssue,
  type DishServiceDependencies,
} from "@/server/modules/dishes/service/dish-crud";
import type {
  DishRepository,
  DishSnapshot,
  DishWrite,
} from "@/server/modules/dishes/repository/dish";

const actor = { id: "a".repeat(24), role: "catalog_editor" as const };
const firstCategoryId = "1".repeat(24);
const firstIngredientId = "2".repeat(24);
const firstMediaId = "3".repeat(24);

const input: DishInput = {
  translations: [
    {
      locale: "en",
      name: "Fesenjan",
      excerpt: "Persian walnut stew",
      description: null,
      specifications: [],
    },
  ],
  categoryIds: [firstCategoryId],
  ingredients: [
    {
      ingredientId: firstIngredientId,
      notes: [],
      quantityAmount: null,
      quantityUnit: null,
    },
  ],
  mediaIds: [firstMediaId],
  basePriceCents: 1_200,
};

function harness() {
  const records = new Map<string, DishSnapshot>();
  const missing = new Map<string, DishReferenceIssue>();
  const archived = new Map<string, DishReferenceIssue>();
  let counter = 10;
  let forceCycle = false;
  const audit = vi.fn(async () => undefined);
  const sync = vi.fn(async () => "f".repeat(24));
  const invalidate = vi.fn();
  const inspectReferences = vi.fn(async () => ({
    missing: [...missing.values()],
    archived: [...archived.values()],
  }));

  const asSnapshot = (id: string, value: DishWrite, existing?: DishSnapshot): DishSnapshot => ({
    id,
    ...value,
    seoPageId: existing?.seoPageId ?? null,
    soldCount: existing?.soldCount ?? 0,
    viewCount: existing?.viewCount ?? 0,
    deletedAt: existing?.deletedAt ?? null,
    version: (existing?.version ?? -1) + 1,
    createdAt: existing?.createdAt ?? "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
  });

  const repository: DishRepository = {
    findById: async (id) => records.get(id) ?? null,
    findBySlug: async (slug) =>
      [...records.values()].find((record) => record.slug === slug) ?? null,
    list: async () => ({ items: [...records.values()], total: records.size }),
    isSlugTaken: async (slug, excludingId) =>
      [...records.values()].some((record) => record.slug === slug && record.id !== excludingId),
    wouldCreateRelationshipCycle: async () => forceCycle,
    create: async (value) => {
      const id = String(++counter).padStart(24, "0");
      const record = asSnapshot(id, value);
      records.set(id, record);
      return record;
    },
    save: async (current, value) => {
      const record = asSnapshot(current.id, value, current);
      records.set(current.id, record);
      return record;
    },
    setSeoPageId: async (current, seoPageId) => {
      const record = { ...current, seoPageId, version: current.version + 1 };
      records.set(current.id, record);
      return record;
    },
    removeInboundRelationships: async (dishId) => {
      const affected: string[] = [];
      for (const [id, record] of records) {
        if (record.relatedDishIds.includes(dishId)) {
          affected.push(id);
          records.set(id, {
            ...record,
            relatedDishIds: record.relatedDishIds.filter((relatedId) => relatedId !== dishId),
            version: record.version + 1,
          });
        }
      }
      return affected;
    },
  };
  const dependencies: DishServiceDependencies = {
    repository,
    inspectReferences,
    seo: { sync },
    audit,
    invalidate,
  };

  return {
    services: createDishServices(dependencies),
    records,
    audit,
    sync,
    invalidate,
    inspectReferences,
    markMissing: (issue: DishReferenceIssue) => missing.set(`${issue.kind}:${issue.id}`, issue),
    markArchived: (issue: DishReferenceIssue) => archived.set(`${issue.kind}:${issue.id}`, issue),
    clearIssues: () => {
      missing.clear();
      archived.clear();
    },
    setCycle: (value: boolean) => {
      forceCycle = value;
    },
  };
}

describe("Dish CRUD services", () => {
  it("creates collision-safe slugs, synchronizes SEO, audits, and invalidates cache tags", async () => {
    const test = harness();
    const first = await test.services.create(actor, input);
    const second = await test.services.create(actor, input);

    expect(first.slug).toBe("fesenjan");
    expect(second.slug).toBe("fesenjan-2");
    expect(second.seoPageId).toBe("f".repeat(24));
    expect(test.sync).toHaveBeenCalledTimes(2);
    expect(test.audit).toHaveBeenLastCalledWith({
      action: "create",
      actorId: actor.id,
      dishId: second.id,
      outcome: "success",
    });
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:dishes:list");
    expect(test.invalidate).toHaveBeenCalledWith(`sk:v1:dishes:item:${second.id}`);
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:seo:list");
  });

  it("rejects missing references with typed, field-safe issue metadata", async () => {
    const test = harness();
    test.markMissing({ kind: "ingredient", id: firstIngredientId });

    await expect(test.services.create(actor, input)).rejects.toMatchObject({
      code: "missing_reference",
      issues: [{ kind: "ingredient", id: firstIngredientId }],
    });
    expect(test.records.size).toBe(0);
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "failure" }),
    );
  });

  it("rejects archived dependencies on update and restore", async () => {
    const test = harness();
    const created = await test.services.create(actor, input);
    test.markArchived({ kind: "category", id: firstCategoryId });

    await expect(
      test.services.update(actor, created.id, { basePriceCents: 1_300 }),
    ).rejects.toMatchObject({ code: "archived_reference" });

    test.clearIssues();
    await test.services.archive(actor, created.id);
    test.markArchived({ kind: "ingredient", id: firstIngredientId });
    await expect(test.services.restore(actor, created.id)).rejects.toMatchObject({
      code: "archived_reference",
    });
    expect(test.records.get(created.id)?.status).toBe("archived");
  });

  it("blocks self-related and transitively circular dish relationships", async () => {
    const test = harness();
    const created = await test.services.create(actor, input);

    await expect(
      test.services.update(actor, created.id, { relatedDishIds: [created.id] }),
    ).rejects.toMatchObject({ code: "self_relationship" });

    test.setCycle(true);
    await expect(
      test.services.update(actor, created.id, { relatedDishIds: ["9".repeat(24)] }),
    ).rejects.toMatchObject({ code: "circular_relationship" });
  });

  it("cleans inbound relationships on archive and restores safely as a draft", async () => {
    const test = harness();
    const target = await test.services.create(actor, input);
    const related = await test.services.create(actor, {
      ...input,
      translations: [
        {
          locale: "en",
          name: "Ghormeh sabzi",
          excerpt: "Persian herb stew",
          description: null,
          specifications: [],
        },
      ],
      relatedDishIds: [target.id],
    });

    const archived = await test.services.archive(actor, target.id);
    expect(archived.status).toBe("archived");
    expect(archived.isFeatured).toBe(false);
    expect(test.records.get(related.id)?.relatedDishIds).toEqual([]);
    expect(test.invalidate).toHaveBeenCalledWith(`sk:v1:dishes:item:${related.id}`);

    const restored = await test.services.restore(actor, target.id);
    expect(restored.status).toBe("draft");
    expect(test.inspectReferences).toHaveBeenCalled();
  });

  it("enforces publication requirements and never uses UI permissions as authorization", async () => {
    const test = harness();
    await expect(
      test.services.create(actor, { ...input, status: "published" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(test.services.create({ ...actor, role: "viewer" }, input)).rejects.toBeInstanceOf(
      DishServiceError,
    );
    expect(test.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "create", outcome: "denied" }),
    );
  });

  it("preserves a stable slug unless an administrator deliberately overrides it", async () => {
    const test = harness();
    const created = await test.services.create(actor, input);
    const renamed = await test.services.update(actor, created.id, {
      translations: [
        {
          locale: "en",
          name: "Walnut stew",
          excerpt: "Persian walnut stew",
          description: null,
          specifications: [],
        },
      ],
    });
    expect(renamed.slug).toBe("fesenjan");

    const overridden = await test.services.update(actor, created.id, {
      slugOverride: "traditional-fesenjan",
    });
    expect(overridden.slug).toBe("traditional-fesenjan");
  });
});
