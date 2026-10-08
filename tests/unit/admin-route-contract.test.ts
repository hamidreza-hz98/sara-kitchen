// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  disable: vi.fn(),
  reactivate: vi.fn(),
  resetCredential: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/admins/route-helper", async () => {
  const { ApiError } = await import("@/server/http");
  const { AdminCrudError } = await import("@/server/modules/admins");
  return {
    adminRequestContext: state.authorize,
    resolveAdminCrudServices: () => ({
      list: state.list,
      create: state.create,
      get: state.get,
      update: state.update,
      disable: state.disable,
      reactivate: state.reactivate,
      resetCredential: state.resetCredential,
      delete: state.delete,
    }),
    translateAdminCrudError(error: unknown): never {
      if (error instanceof AdminCrudError) {
        if (error.code === "not_found") throw ApiError.notFound("admin");
        if (["last_owner", "self_protected", "conflict"].includes(error.code))
          throw ApiError.conflict({ resource: "admin" });
      }
      throw error;
    },
  };
});

import { POST as disable } from "@/app/api/admins/[adminId]/disable/route";
import { POST as reactivate } from "@/app/api/admins/[adminId]/reactivate/route";
import { POST as resetCredential } from "@/app/api/admins/[adminId]/reset-credential/route";
import { DELETE as remove, GET as detail, PATCH as update } from "@/app/api/admins/[adminId]/route";
import { GET as list, POST as create } from "@/app/api/admins/route";
import { ApiError } from "@/server/http";
import { AdminCrudError } from "@/server/modules/admins";

const id = "507f1f77bcf86cd799439011";
const context = { params: Promise.resolve({ adminId: id }) };
const createBody = {
  firstName: "Sara",
  lastName: "Kazemi",
  identifier: "sara@example.com",
  role: "manager",
  password: "Strong administrator password 2026",
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
    state.disable,
    state.reactivate,
    state.resetCredential,
    state.delete,
  ])
    operation.mockResolvedValue({ id });
});

describe("administrator Route Handler contracts", () => {
  it("lists with bounded filters and stable pagination metadata", async () => {
    const response = await list(
      request(
        "/api/admins?page=2&pageSize=10&role=manager&status=active&sortBy=identifier&sortDirection=asc",
      ),
    );
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(
      { id, role: "owner" },
      {
        page: 2,
        pageSize: 10,
        role: "manager",
        status: "active",
        sortBy: "identifier",
        sortDirection: "asc",
      },
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      meta: { pagination: { page: 2, pageSize: 10, totalItems: 1 } },
    });
    expect((await list(request("/api/admins?pageSize=1000"))).status).toBe(400);
  });

  it("validates create/update/reset inputs before invoking services", async () => {
    expect((await create(request("/api/admins", "POST", createBody))).status).toBe(201);
    expect(state.create).toHaveBeenCalledWith(
      { id, role: "owner" },
      expect.objectContaining({ identifier: "sara@example.com" }),
    );
    expect(
      (await update(request(`/api/admins/${id}`, "PATCH", { role: "viewer" }), context)).status,
    ).toBe(200);
    expect(
      (
        await resetCredential(
          request(`/api/admins/${id}/reset-credential`, "POST", { password: "short" }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(state.resetCredential).not.toHaveBeenCalled();
  });

  it("exposes detail and protected lifecycle actions", async () => {
    expect((await detail(request(`/api/admins/${id}`), context)).status).toBe(200);
    expect((await disable(request(`/api/admins/${id}/disable`, "POST", {}), context)).status).toBe(
      200,
    );
    expect(
      (await reactivate(request(`/api/admins/${id}/reactivate`, "POST", {}), context)).status,
    ).toBe(200);
    expect((await remove(request(`/api/admins/${id}`, "DELETE"), context)).status).toBe(200);
  });

  it("maps domain conflicts and preserves authentication failures", async () => {
    state.disable.mockRejectedValueOnce(new AdminCrudError("last_owner"));
    expect((await disable(request(`/api/admins/${id}/disable`, "POST", {}), context)).status).toBe(
      409,
    );
    state.authorize.mockRejectedValueOnce(ApiError.authentication());
    expect((await list(request("/api/admins"))).status).toBe(401);
  });
});
