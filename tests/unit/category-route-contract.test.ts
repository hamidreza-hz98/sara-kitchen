// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  admin: vi.fn(),
  protectedMutation: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  enableWrites: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connectToDatabase: state.connect,
}));
vi.mock("@/server/modules/auth", () => ({
  AuthorizationGuardError: class AuthorizationGuardError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
  adminCookieName: () => "sara_admin_dev",
  isProtectedMutation: state.protectedMutation,
  requireAdminActor: state.admin,
}));
vi.mock("@/server/modules/categories", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createCategoryRepository: () => ({
    list: state.list,
    findById: state.findById,
    create: state.create,
  }),
  createCategoryAuditSink: () => state.audit,
}));
vi.mock("@/app/api/categories/route-helper", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCategoryMutationServices: () =>
    state.enableWrites
      ? { create: state.create, update: state.update, archive: state.archive }
      : null,
}));

import { GET as list, POST as create } from "@/app/api/categories/route";
import { GET as detail, PATCH as update } from "@/app/api/categories/[categoryId]/route";
import { POST as archive } from "@/app/api/categories/[categoryId]/archive/route";
import { AuthorizationGuardError } from "@/server/modules/auth";
import { CategoryServiceError } from "@/server/modules/categories";

const id = "507f1f77bcf86cd799439011";
const context = { params: Promise.resolve({ categoryId: id }) };
const createBody = {
  translations: [{ locale: "en", name: "Persian starters", description: "Fresh starters" }],
  status: "published",
};

function request(path: string, method = "GET", body?: unknown, cookie = true) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie: "sara_admin_dev=test-token" } : {}),
      ...(body !== undefined
        ? { "content-type": "application/json", origin: "http://localhost:3000" }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("category Route Handler contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.connect.mockResolvedValue({});
    state.admin.mockResolvedValue({ id: "admin", role: "owner" });
    state.protectedMutation.mockReturnValue(true);
    state.list.mockResolvedValue({ items: [{ id, slug: "persian-starters" }], total: 25 });
    state.findById.mockResolvedValue({ id, slug: "persian-starters" });
    state.create.mockResolvedValue({ id, slug: "persian-starters" });
    state.audit.mockResolvedValue(undefined);
    state.update.mockResolvedValue({ id, slug: "persian-starters" });
    state.archive.mockResolvedValue({ id, slug: "persian-starters", status: "archived" });
    state.enableWrites = false;
  });

  it("enforces read permission and returns bounded pagination metadata", async () => {
    expect((await list(request("/api/categories", "GET", undefined, false))).status).toBe(401);
    const response = await list(request("/api/categories?page=2&pageSize=12&status=published"));
    expect(response.status).toBe(200);
    expect(state.admin).toHaveBeenCalledWith({}, "test-token", "categories:read");
    expect(state.list).toHaveBeenCalledWith({ page: 2, pageSize: 12, status: "published" });
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "read", outcome: "success" }),
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: [{ id }],
      meta: {
        pagination: { page: 2, pageSize: 12, totalItems: 25, totalPages: 3, hasNextPage: true },
      },
    });
    expect((await list(request("/api/categories?page=1000&pageSize=100"))).status).toBe(400);
    state.admin.mockRejectedValueOnce(new AuthorizationGuardError("forbidden"));
    expect((await list(request("/api/categories"))).status).toBe(403);
  });

  it("validates detail IDs and hides absent categories", async () => {
    expect(
      (
        await detail(request(`/api/categories/${id}`), {
          params: Promise.resolve({ categoryId: "bad" }),
        })
      ).status,
    ).toBe(400);
    state.findById.mockResolvedValueOnce(null);
    expect((await detail(request(`/api/categories/${id}`), context)).status).toBe(404);
    expect((await detail(request(`/api/categories/${id}`), context)).status).toBe(200);
  });

  it("rejects unauthorized and malformed creates before the unavailable write boundary", async () => {
    state.protectedMutation.mockReturnValueOnce(false);
    expect((await create(request("/api/categories", "POST", createBody))).status).toBe(403);
    expect((await create(request("/api/categories", "POST", { translations: [] }))).status).toBe(
      400,
    );
    const response = await create(request("/api/categories", "POST", createBody));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("validates update and archive contracts without changing category state", async () => {
    expect(
      (await update(request(`/api/categories/${id}`, "PATCH", { status: "archived" }), context))
        .status,
    ).toBe(400);
    expect(
      (await update(request(`/api/categories/${id}`, "PATCH", { sortOrder: 2 }), context)).status,
    ).toBe(503);
    expect(
      (await archive(request(`/api/categories/${id}/archive`, "POST", {}), context)).status,
    ).toBe(503);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("returns create/update/archive success codes when durable services are bound", async () => {
    state.enableWrites = true;
    const created = await create(request("/api/categories", "POST", createBody));
    expect(created.status).toBe(201);
    expect(state.create).toHaveBeenCalledWith({ id: "admin", role: "owner" }, createBody);
    const updated = await update(
      request(`/api/categories/${id}`, "PATCH", { sortOrder: 2 }),
      context,
    );
    expect(updated.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({ id: "admin", role: "owner" }, id, { sortOrder: 2 });
    const archived = await archive(request(`/api/categories/${id}/archive`, "POST", {}), context);
    expect(archived.status).toBe(200);
    expect(state.archive).toHaveBeenCalledWith({ id: "admin", role: "owner" }, id);
  });

  it("maps domain conflicts and media validation to safe API errors", async () => {
    state.enableWrites = true;
    state.create.mockRejectedValueOnce(new CategoryServiceError("conflict"));
    expect((await create(request("/api/categories", "POST", createBody))).status).toBe(409);
    state.archive.mockRejectedValueOnce(new CategoryServiceError("referenced"));
    expect(
      (await archive(request(`/api/categories/${id}/archive`, "POST", {}), context)).status,
    ).toBe(409);
  });
});
