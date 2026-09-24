import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CategoryServiceError,
  createCategoryServices,
  type CategoryServiceDependencies,
} from "@/server/modules/categories/service/category-crud";
import type {
  CategoryRepository,
  CategorySnapshot,
  CategoryWrite,
} from "@/server/modules/categories/repository/category";

const actor = { id: "a".repeat(24), role: "catalog_editor" as const };
const input = {
  translations: [
    { locale: "en" as const, name: "Persian starters", description: "Fresh starters" },
  ],
  status: "published" as const,
};

function harness() {
  const records = new Map<string, CategorySnapshot>();
  let counter = 0;
  let dishReferences = 0;
  const audit = vi.fn(async () => undefined);
  const sync = vi.fn(async () => "f".repeat(24));
  const remove = vi.fn(async () => undefined);
  const invalidate = vi.fn();
  const validateMedia = vi.fn(async () => undefined);
  const asSnapshot = (
    id: string,
    value: CategoryWrite,
    existing?: CategorySnapshot,
  ): CategorySnapshot => ({
    id,
    translations: value.translations,
    slug: value.slug,
    bannerMediaId: value.bannerMediaId,
    imageMediaId: value.imageMediaId,
    seoPageId: existing?.seoPageId ?? null,
    status: value.status,
    sortOrder: value.sortOrder,
    deletedAt: existing?.deletedAt ?? null,
    version: (existing?.version ?? -1) + 1,
    createdAt: existing?.createdAt ?? "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  });
  const repository: CategoryRepository = {
    findById: async (id, includeDeleted) => {
      const record = records.get(id);
      return record && (includeDeleted || !record.deletedAt) ? record : null;
    },
    findBySlug: async (slug) =>
      [...records.values()].find((item) => item.slug === slug && !item.deletedAt) ?? null,
    list: async () => ({
      items: [...records.values()].filter((item) => !item.deletedAt),
      total: records.size,
    }),
    isSlugTaken: async (slug, excludingId) =>
      [...records.values()].some((item) => item.slug === slug && item.id !== excludingId),
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
    rollbackCreate: async (current) => records.delete(current.id),
    softDelete: async (current, _actorId, now) => {
      const record = { ...current, deletedAt: now.toISOString(), version: current.version + 1 };
      records.set(current.id, record);
      return record;
    },
    restore: async (current) => {
      const record = { ...current, deletedAt: null, version: current.version + 1 };
      records.set(current.id, record);
      return record;
    },
  };
  const deps: CategoryServiceDependencies = {
    repository,
    validateMedia,
    countDishReferences: async () => dishReferences,
    seo: { sync, remove },
    audit,
    invalidate,
  };
  return {
    services: createCategoryServices(deps),
    records,
    audit,
    sync,
    remove,
    invalidate,
    validateMedia,
    setDishReferences: (count: number) => {
      dishReferences = count;
    },
  };
}

describe("Category CRUD services", () => {
  it("creates collision-safe slugs, synchronizes SEO, audits, and invalidates exact tags", async () => {
    const test = harness();
    const first = await test.services.create(actor, input);
    const second = await test.services.create(actor, input);
    expect(first.slug).toBe("persian-starters");
    expect(second.slug).toBe("persian-starters-2");
    expect(second.seoPageId).toBe("f".repeat(24));
    expect(test.sync).toHaveBeenCalledTimes(2);
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "success", categoryId: second.id }),
    );
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:categories:list");
    expect(test.invalidate).toHaveBeenCalledWith(`sk:v1:categories:item:${second.id}`);
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:seo:list");
  });

  it("rolls back a newly created category when SEO synchronization fails", async () => {
    const test = harness();
    test.sync.mockRejectedValueOnce(new Error("seo unavailable"));
    await expect(test.services.create(actor, input)).rejects.toThrow("seo unavailable");
    expect(test.records.size).toBe(0);
    expect(test.remove).toHaveBeenCalledOnce();
  });

  it("preserves slug on translated updates and validates media references", async () => {
    const test = harness();
    const created = await test.services.create(actor, input);
    const updated = await test.services.update(actor, created.id, {
      translations: [
        { locale: "en", name: "Renamed starters", description: "Updated English copy" },
        { locale: "pt-PT", name: "Entradas persas", description: "Descrição portuguesa" },
        { locale: "fa", name: "پیش‌غذاهای ایرانی", description: "توضیح فارسی" },
      ],
      imageMediaId: "b".repeat(24),
    });
    expect(updated.slug).toBe(created.slug);
    expect(updated.translations).toHaveLength(3);
    expect(test.validateMedia).toHaveBeenLastCalledWith({
      bannerMediaId: null,
      imageMediaId: "b".repeat(24),
    });
    const overridden = await test.services.update(actor, created.id, {
      slugOverride: "new-starters",
    });
    expect(overridden.slug).toBe("new-starters");
  });

  it("blocks archive/delete while referenced and requires archive before soft deletion", async () => {
    const test = harness();
    const created = await test.services.create(actor, input);
    test.setDishReferences(2);
    await expect(test.services.archive(actor, created.id)).rejects.toMatchObject({
      code: "referenced",
    });
    test.setDishReferences(0);
    await expect(test.services.delete(actor, created.id)).rejects.toMatchObject({
      code: "not_archived",
    });
    await test.services.archive(actor, created.id);
    const deleted = await test.services.delete(actor, created.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(test.remove).toHaveBeenCalledOnce();
    const restored = await test.services.restore(actor, created.id);
    expect(restored.deletedAt).toBeNull();
    expect(test.sync).toHaveBeenCalledTimes(3);
  });

  it("denies unauthorized actions and audits the denial", async () => {
    const test = harness();
    await expect(
      test.services.create({ id: actor.id, role: "viewer" }, input),
    ).rejects.toBeInstanceOf(CategoryServiceError);
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "denied" }),
    );
    expect(test.records.size).toBe(0);
  });
});
