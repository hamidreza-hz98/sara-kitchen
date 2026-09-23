// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  publicContext: vi.fn(),
  adminContext: vi.fn(),
  catalogList: vi.fn(),
  catalogDetail: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/dishes/route-helper", async () => {
  const { ApiError } = await import("@/server/http");
  const { DishCatalogQueryError, DishServiceError } = await import("@/server/modules/dishes");
  return {
    DISH_PUBLIC_CACHE_CONTROL: "public, s-maxage=60, stale-while-revalidate=300",
    dishPublicRequestContext: state.publicContext,
    dishAdminRequestContext: state.adminContext,
    publicDishQueryLocale: (queryLocale: string | undefined, cookieLocale: string) =>
      queryLocale ?? cookieLocale,
    resolveDishCatalog: () => ({ list: state.catalogList, getBySlug: state.catalogDetail }),
    resolveDishServices: () => ({
      list: state.list,
      create: state.create,
      get: state.get,
      update: state.update,
      archive: state.archive,
      restore: state.restore,
    }),
    translateDishError(error: unknown): never {
      if (error instanceof DishCatalogQueryError && error.code === "not_found") {
        throw ApiError.notFound("dish");
      }
      if (error instanceof DishServiceError) {
        if (error.code === "not_found") throw ApiError.notFound("dish");
        if (error.code === "conflict") throw ApiError.conflict({ resource: "dish" });
      }
      throw error;
    },
  };
});

import { GET as publicDetail } from "@/app/api/dishes/[dishSlug]/route";
import { POST as archive } from "@/app/api/dishes/manage/[dishId]/archive/route";
import { POST as restore } from "@/app/api/dishes/manage/[dishId]/restore/route";
import { GET as managementDetail, PATCH as update } from "@/app/api/dishes/manage/[dishId]/route";
import { GET as managementList } from "@/app/api/dishes/manage/route";
import { GET as publicList, POST as create } from "@/app/api/dishes/route";
import { ApiError } from "@/server/http";
import { DishCatalogQueryError, DishServiceError } from "@/server/modules/dishes";

const dishId = "507f1f77bcf86cd799439011";
const actor = { id: "507f191e810c19729de860ea", role: "owner" as const };
const validation = { translate: () => "Invalid request." };
const dishContext = { params: Promise.resolve({ dishId }) };
const slugContext = { params: Promise.resolve({ dishSlug: "fesenjan" }) };
const createBody = {
  translations: [{ locale: "en", name: "Fesenjan", specifications: [] }],
  basePriceCents: 1_200,
  status: "draft",
};

function request(path: string, method = "GET", body?: unknown, admin = false) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(admin ? { cookie: "sara_admin_dev=test-token" } : {}),
      ...(body === undefined
        ? {}
        : { "content-type": "application/json", origin: "http://localhost:3000" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.publicContext.mockResolvedValue({ connection: {}, locale: "en", validation });
  state.adminContext.mockResolvedValue({ connection: {}, actor, validation });
  state.catalogList.mockResolvedValue({
    items: [{ id: dishId, slug: "fesenjan" }],
    meta: { pagination: { page: 2, pageSize: 10, totalItems: 1 } },
  });
  state.catalogDetail.mockResolvedValue({ id: dishId, slug: "fesenjan" });
  state.list.mockResolvedValue({ items: [{ id: dishId }], total: 1 });
  for (const operation of [state.create, state.get, state.update, state.archive, state.restore]) {
    operation.mockResolvedValue({ id: dishId });
  }
});

describe("Dish Route Handler contracts", () => {
  it("serves a bounded localized public catalog with explicit shared caching", async () => {
    const response = await publicList(
      request(
        "/api/dishes?page=2&pageSize=10&locale=fa&featured=false&dietaryTags=halal&excludeAllergens=milk",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(state.publicContext).toHaveBeenCalledWith(expect.any(NextRequest), "catalog");
    expect(state.catalogList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        locale: "fa",
        featured: false,
        dietaryTags: ["halal"],
        excludeAllergens: ["milk"],
      }),
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: [{ id: dishId }] });
    expect((await publicList(request("/api/dishes?pageSize=1000"))).status).toBe(400);
    expect((await publicList(request("/api/dishes?sort=unsafe"))).status).toBe(400);
  });

  it("serves public detail safely and maps absent or invalid slugs", async () => {
    const response = await publicDetail(request("/api/dishes/fesenjan?locale=pt-PT"), slugContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(state.catalogDetail).toHaveBeenCalledWith({ slug: "fesenjan", locale: "pt-PT" });
    expect(
      (
        await publicDetail(request("/api/dishes/INVALID"), {
          params: Promise.resolve({ dishSlug: "INVALID" }),
        })
      ).status,
    ).toBe(400);
    state.catalogDetail.mockRejectedValueOnce(new DishCatalogQueryError("not_found"));
    expect((await publicDetail(request("/api/dishes/missing"), slugContext)).status).toBe(404);
  });

  it("returns predictable rate-limit responses before public catalog work", async () => {
    state.publicContext.mockRejectedValueOnce(ApiError.rateLimit(37));
    const response = await publicList(request("/api/dishes"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(state.catalogList).not.toHaveBeenCalled();
  });

  it("protects management reads with exact permissions and bounded pagination", async () => {
    const response = await managementList(
      request("/api/dishes/manage?page=2&pageSize=10&status=draft", "GET", undefined, true),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(state.adminContext).toHaveBeenCalledWith(expect.any(NextRequest), "dishes:read");
    expect(state.list).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ page: 2, pageSize: 10, status: "draft" }),
    );
    expect((await managementList(request("/api/dishes/manage?pageSize=1000"))).status).toBe(400);
    state.adminContext.mockRejectedValueOnce(ApiError.authentication());
    expect((await managementList(request("/api/dishes/manage"))).status).toBe(401);
  });

  it("validates and authorizes create and update mutations", async () => {
    expect((await create(request("/api/dishes", "POST", createBody, true))).status).toBe(201);
    expect(state.adminContext).toHaveBeenCalledWith(expect.any(NextRequest), "dishes:create", true);
    expect(state.create).toHaveBeenCalledWith(actor, createBody);
    expect((await create(request("/api/dishes", "POST", { translations: [] }, true))).status).toBe(
      400,
    );
    expect(
      (
        await update(
          request(`/api/dishes/manage/${dishId}`, "PATCH", { basePriceCents: 1_500 }, true),
          dishContext,
        )
      ).status,
    ).toBe(200);
    expect(state.update).toHaveBeenCalledWith(actor, dishId, { basePriceCents: 1_500 });
    state.adminContext.mockRejectedValueOnce(ApiError.authorization());
    expect(
      (
        await update(
          request(`/api/dishes/manage/${dishId}`, "PATCH", { basePriceCents: 2_000 }, true),
          dishContext,
        )
      ).status,
    ).toBe(403);
  });

  it("supports management detail, archive and restore with safe errors", async () => {
    expect(
      (
        await managementDetail(
          request(`/api/dishes/manage/${dishId}`, "GET", undefined, true),
          dishContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await archive(
          request(`/api/dishes/manage/${dishId}/archive`, "POST", {}, true),
          dishContext,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await restore(
          request(`/api/dishes/manage/${dishId}/restore`, "POST", {}, true),
          dishContext,
        )
      ).status,
    ).toBe(200);
    expect(state.archive).toHaveBeenCalledWith(actor, dishId);
    expect(state.restore).toHaveBeenCalledWith(actor, dishId);
    state.get.mockRejectedValueOnce(new DishServiceError("not_found"));
    expect(
      (await managementDetail(request(`/api/dishes/manage/${dishId}`), dishContext)).status,
    ).toBe(404);
    state.update.mockRejectedValueOnce(new DishServiceError("conflict"));
    expect(
      (
        await update(
          request(`/api/dishes/manage/${dishId}`, "PATCH", { basePriceCents: 900 }, true),
          dishContext,
        )
      ).status,
    ).toBe(409);
  });
});
