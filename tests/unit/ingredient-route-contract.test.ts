// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/ingredients/route-helper", async () => {
  const { ApiError } = await import("@/server/http");
  const { IngredientServiceError } = await import("@/server/modules/ingredients");
  return {
    ingredientRequestContext: state.authorize,
    resolveIngredientServices: () => ({
      list: state.list,
      create: state.create,
      get: state.get,
      update: state.update,
      archive: state.archive,
      restore: state.restore,
      delete: state.delete,
    }),
    translateIngredientServiceError(error: unknown): never {
      if (error instanceof IngredientServiceError) {
        if (error.code === "not_found") throw ApiError.notFound("ingredient");
        if (["conflict", "referenced", "not_archived"].includes(error.code)) {
          throw ApiError.conflict({ resource: "ingredient" });
        }
      }
      throw error;
    },
  };
});

import { POST as archive } from "@/app/api/ingredients/[ingredientId]/archive/route";
import {
  DELETE as remove,
  GET as detail,
  PATCH as update,
} from "@/app/api/ingredients/[ingredientId]/route";
import { POST as restore } from "@/app/api/ingredients/[ingredientId]/restore/route";
import { GET as list, POST as create } from "@/app/api/ingredients/route";
import { ApiError } from "@/server/http";
import { IngredientServiceError } from "@/server/modules/ingredients";

const id = "507f1f77bcf86cd799439011";
const context = { params: Promise.resolve({ ingredientId: id }) };
const body = {
  translations: [{ locale: "en", name: "Saffron" }],
  allergenTags: [],
  status: "published",
};

function request(path: string, method = "GET", value?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: value === undefined ? {} : { "content-type": "application/json" },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.authorize.mockResolvedValue({
    connection: {},
    actor: { id, role: "owner" },
    validation: { translate: () => "Invalid request." },
  });
  state.list.mockResolvedValue({ items: [{ id }], total: 1 });
  for (const operation of [
    state.create,
    state.get,
    state.update,
    state.archive,
    state.restore,
    state.delete,
  ]) {
    operation.mockResolvedValue({ id });
  }
});

describe("ingredient Route Handler contracts", () => {
  it("lists with bounded filters and pagination metadata", async () => {
    const response = await list(
      request(
        "/api/ingredients?page=2&pageSize=10&status=published&allergen=milk&sortBy=createdAt&sortDirection=desc",
      ),
    );
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(
      { id, role: "owner" },
      {
        page: 2,
        pageSize: 10,
        status: "published",
        allergen: "milk",
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      meta: { pagination: { page: 2, pageSize: 10, totalItems: 1 } },
    });
    expect((await list(request("/api/ingredients?pageSize=1000"))).status).toBe(400);
  });

  it("creates and updates only validated payloads", async () => {
    expect((await create(request("/api/ingredients", "POST", body))).status).toBe(201);
    expect(state.create).toHaveBeenCalledWith(
      { id, role: "owner" },
      expect.objectContaining({ translations: body.translations, status: "published" }),
    );
    expect((await create(request("/api/ingredients", "POST", { translations: [] }))).status).toBe(
      400,
    );
    expect(
      (
        await update(
          request(`/api/ingredients/${id}`, "PATCH", { allergenTags: ["milk"] }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(state.update).toHaveBeenCalledWith({ id, role: "owner" }, id, {
      allergenTags: ["milk"],
    });
  });

  it("supports detail, archive, restore, and reference-safe delete handlers", async () => {
    expect((await detail(request(`/api/ingredients/${id}`), context)).status).toBe(200);
    expect(
      (await archive(request(`/api/ingredients/${id}/archive`, "POST", {}), context)).status,
    ).toBe(200);
    expect(
      (await restore(request(`/api/ingredients/${id}/restore`, "POST", {}), context)).status,
    ).toBe(200);
    expect((await remove(request(`/api/ingredients/${id}`, "DELETE"), context)).status).toBe(200);
    expect(state.delete).toHaveBeenCalledWith({ id, role: "owner" }, id);
  });

  it("maps missing and referenced resources and preserves authorization failures", async () => {
    state.get.mockRejectedValueOnce(new IngredientServiceError("not_found"));
    expect((await detail(request(`/api/ingredients/${id}`), context)).status).toBe(404);
    state.delete.mockRejectedValueOnce(new IngredientServiceError("referenced"));
    expect((await remove(request(`/api/ingredients/${id}`, "DELETE"), context)).status).toBe(409);
    state.authorize.mockRejectedValueOnce(ApiError.authentication());
    expect((await list(request("/api/ingredients"))).status).toBe(401);
  });
});
