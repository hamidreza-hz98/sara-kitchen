import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  IngredientRepositoryConflictError,
  IngredientServiceError,
  createIngredientServices,
  type IngredientRepository,
  type IngredientServiceDependencies,
  type IngredientSnapshot,
} from "@/server/modules/ingredients";

const actor = { id: "507f1f77bcf86cd799439011", role: "owner" as const };
const snapshot: IngredientSnapshot = {
  id: "507f1f77bcf86cd799439012",
  translations: [{ locale: "en", name: "Saffron" }],
  imageMediaId: null,
  allergenTags: [],
  status: "draft",
  deletedAt: null,
  version: 0,
  createdAt: "2026-09-18T00:00:00.000Z",
  updatedAt: "2026-09-18T00:00:00.000Z",
};

const mocks = {
  findById: vi.fn(),
  list: vi.fn(),
  isCanonicalNameTaken: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  softDelete: vi.fn(),
  restore: vi.fn(),
  validateImage: vi.fn(),
  countDishReferences: vi.fn(),
  audit: vi.fn(),
  invalidate: vi.fn(),
};

function services() {
  const repository: IngredientRepository = {
    findById: mocks.findById,
    list: mocks.list,
    isCanonicalNameTaken: mocks.isCanonicalNameTaken,
    create: mocks.create,
    save: mocks.save,
    softDelete: mocks.softDelete,
    restore: mocks.restore,
  };
  const dependencies: IngredientServiceDependencies = {
    repository,
    validateImage: mocks.validateImage,
    countDishReferences: mocks.countDishReferences,
    audit: mocks.audit,
    invalidate: mocks.invalidate,
  };
  return createIngredientServices(dependencies);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isCanonicalNameTaken.mockResolvedValue(false);
  mocks.validateImage.mockResolvedValue(undefined);
  mocks.countDishReferences.mockResolvedValue(0);
  mocks.audit.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue(snapshot);
  mocks.save.mockResolvedValue(snapshot);
  mocks.softDelete.mockResolvedValue({ ...snapshot, status: "archived", deletedAt: "now" });
  mocks.restore.mockResolvedValue({ ...snapshot, deletedAt: null });
  mocks.findById.mockResolvedValue(snapshot);
  mocks.list.mockResolvedValue({ items: [snapshot], total: 1 });
});

describe("ingredient CRUD service", () => {
  it("creates after canonical duplicate and media checks, then audits and invalidates", async () => {
    await expect(
      services().create(actor, {
        translations: [{ locale: "en", name: "Saffron" }],
        imageMediaId: "507f1f77bcf86cd799439013",
        allergenTags: [],
        status: "published",
      }),
    ).resolves.toEqual(snapshot);
    expect(mocks.isCanonicalNameTaken).toHaveBeenCalledWith("Saffron");
    expect(mocks.validateImage).toHaveBeenCalledWith("507f1f77bcf86cd799439013");
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "success", ingredientId: snapshot.id }),
    );
    expect(mocks.invalidate).toHaveBeenCalledWith("sk:v1:ingredients:list");
    expect(mocks.invalidate).toHaveBeenCalledWith(`sk:v1:ingredients:item:${snapshot.id}`);
  });

  it("rejects canonical duplicates and repository races as conflicts", async () => {
    mocks.isCanonicalNameTaken.mockResolvedValueOnce(true);
    await expect(
      services().create(actor, { translations: [{ locale: "en", name: "Saffron" }] }),
    ).rejects.toMatchObject({ code: "conflict" });
    mocks.isCanonicalNameTaken.mockResolvedValueOnce(false);
    mocks.create.mockRejectedValueOnce(new IngredientRepositoryConflictError());
    await expect(
      services().create(actor, { translations: [{ locale: "en", name: "Saffron" }] }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("enforces permissions in the service and writes a denied audit", async () => {
    await expect(
      services().create(
        { ...actor, role: "viewer" },
        { translations: [{ locale: "en", name: "Saffron" }] },
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });

  it("reads, lists, and updates through repository contracts", async () => {
    await expect(services().get(actor, snapshot.id)).resolves.toEqual(snapshot);
    await expect(services().list(actor, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 1,
    });
    await expect(
      services().update(actor, snapshot.id, { allergenTags: ["milk"] }),
    ).resolves.toEqual(snapshot);
    expect(mocks.save).toHaveBeenCalledWith(
      snapshot,
      expect.objectContaining({ allergenTags: ["milk"] }),
      actor.id,
    );
  });

  it("archives without destroying the record", async () => {
    await services().archive(actor, snapshot.id);
    expect(mocks.save).toHaveBeenCalledWith(
      snapshot,
      expect.objectContaining({ status: "archived" }),
      actor.id,
    );
    expect(mocks.softDelete).not.toHaveBeenCalled();
  });

  it("refuses destructive deletion of active ingredients", async () => {
    await expect(services().delete(actor, snapshot.id)).rejects.toMatchObject({
      code: "not_archived",
    });
    expect(mocks.countDishReferences).not.toHaveBeenCalled();
    expect(mocks.softDelete).not.toHaveBeenCalled();
  });

  it("refuses destructive deletion when any dish references the ingredient", async () => {
    mocks.findById.mockResolvedValueOnce({ ...snapshot, status: "archived" });
    mocks.countDishReferences.mockResolvedValueOnce(2);
    await expect(services().delete(actor, snapshot.id)).rejects.toMatchObject({
      code: "referenced",
    });
    expect(mocks.softDelete).not.toHaveBeenCalled();
  });

  it("soft-deletes an unreferenced archived ingredient and supports safe restore", async () => {
    const archived = { ...snapshot, status: "archived" as const };
    mocks.findById.mockResolvedValueOnce(archived);
    await services().delete(actor, snapshot.id);
    expect(mocks.softDelete).toHaveBeenCalledWith(archived, actor.id, expect.any(Date));

    mocks.findById.mockResolvedValueOnce({ ...archived, deletedAt: "2026-09-18T00:00:00.000Z" });
    await services().restore(actor, snapshot.id);
    expect(mocks.restore).toHaveBeenCalled();
  });

  it("uses stable domain errors", () => {
    expect(new IngredientServiceError("referenced").message).toBe("referenced");
  });
});
