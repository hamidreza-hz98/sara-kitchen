// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  adminContext: vi.fn(),
  selfContext: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  setStatus: vi.fn(),
  exportAccount: vi.fn(),
  anonymize: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/customers/route-helper", async () => {
  const { ApiError } = await import("@/server/http");
  const { CustomerCrudError } = await import("@/server/modules/customers");
  return {
    customerAdminRequestContext: state.adminContext,
    customerSelfRequestContext: state.selfContext,
    resolveCustomerCrudServices: () => ({
      list: state.list,
      get: state.get,
      update: state.update,
      setStatus: state.setStatus,
      exportAccount: state.exportAccount,
      anonymize: state.anonymize,
    }),
    translateCustomerCrudError(error: unknown): never {
      if (error instanceof CustomerCrudError) {
        if (error.code === "forbidden") throw ApiError.authorization();
        if (error.code === "not_found") throw ApiError.notFound("customer");
        if (error.code === "conflict") throw ApiError.conflict({ resource: "customer" });
      }
      throw error;
    },
  };
});

import { GET as adminExport } from "@/app/api/customers/[customerId]/export/route";
import {
  DELETE as adminDelete,
  GET as adminDetail,
  PATCH as adminUpdate,
} from "@/app/api/customers/[customerId]/route";
import { POST as adminStatus } from "@/app/api/customers/[customerId]/status/route";
import { GET as adminList } from "@/app/api/customers/route";
import { GET as selfExport } from "@/app/api/profile/export/route";
import {
  DELETE as selfDelete,
  GET as selfDetail,
  PATCH as selfUpdate,
} from "@/app/api/profile/route";
import { ApiError } from "@/server/http";

const customerId = "507f1f77bcf86cd799439011";
const adminId = "507f191e810c19729de860ea";
const context = { params: Promise.resolve({ customerId }) };

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const validation = { translate: () => "Invalid request." };
  state.adminContext.mockResolvedValue({
    connection: {},
    actor: { id: adminId, role: "owner" },
    validation,
  });
  state.selfContext.mockResolvedValue({ connection: {}, actor: { id: customerId }, validation });
  state.list.mockResolvedValue({ items: [{ id: customerId }], total: 1 });
  for (const operation of [state.get, state.update, state.setStatus])
    operation.mockResolvedValue({ id: customerId });
  state.exportAccount.mockResolvedValue({ profile: { id: customerId }, orders: [] });
  state.anonymize.mockResolvedValue({ customer: { id: customerId }, hardDeleted: false });
});

describe("customer Route Handler contracts", () => {
  it("provides bounded authorized management list and detail reads", async () => {
    const response = await adminList(
      request(
        "/api/customers?page=2&pageSize=10&status=disabled&sortBy=lastName&sortDirection=asc",
      ),
    );
    expect(response.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith(
      { kind: "admin", id: adminId, role: "owner" },
      { page: 2, pageSize: 10, status: "disabled", sortBy: "lastName", sortDirection: "asc" },
    );
    expect((await adminDetail(request(`/api/customers/${customerId}`), context)).status).toBe(200);
    expect((await adminList(request("/api/customers?pageSize=1000"))).status).toBe(400);
  });

  it("validates management update, status, anonymization, and export operations", async () => {
    expect(
      (
        await adminUpdate(
          request(`/api/customers/${customerId}`, "PATCH", { firstName: "Sara" }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await adminStatus(
          request(`/api/customers/${customerId}/status`, "POST", { status: "disabled" }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (await adminDelete(request(`/api/customers/${customerId}`, "DELETE", {}), context)).status,
    ).toBe(200);
    const exported = await adminExport(request(`/api/customers/${customerId}/export`), context);
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-disposition")).toContain("customer-data.json");
  });

  it("always scopes self-service operations to the resolved customer", async () => {
    expect((await selfDetail(request("/api/profile"))).status).toBe(200);
    expect((await selfUpdate(request("/api/profile", "PATCH", { email: null }))).status).toBe(200);
    expect((await selfExport(request("/api/profile/export"))).status).toBe(200);
    const deleted = await selfDelete(request("/api/profile", "DELETE", {}));
    expect(deleted.status).toBe(200);
    expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(state.anonymize).toHaveBeenCalledWith({ kind: "customer", id: customerId }, customerId);
  });

  it("preserves authentication failures", async () => {
    state.adminContext.mockRejectedValueOnce(ApiError.authentication());
    expect((await adminList(request("/api/customers"))).status).toBe(401);
    state.selfContext.mockRejectedValueOnce(ApiError.authentication());
    expect((await selfDetail(request("/api/profile"))).status).toBe(401);
  });
});
