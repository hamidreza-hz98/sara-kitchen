// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/seo/static/route-helper", () => ({
  staticSeoRequestContext: state.context,
  resolveStaticSeoServices: () => ({
    list: state.list,
    get: state.get,
    create: state.create,
    update: state.update,
  }),
  translateStaticSeoError: (error: unknown) => {
    throw error;
  },
}));

import { GET as list, POST as create } from "@/app/api/seo/static/route";
import { GET as detail, PATCH as update } from "@/app/api/seo/static/[staticPageKey]/route";

const actor = { id: "507f1f77bcf86cd799439011", role: "owner" } as const;
const validation = { translate: (key: string) => key };
const translations = [
  {
    locale: "en",
    title: "Sara Kitchen",
    description: "Homemade Persian food delivered across Porto.",
  },
];

function request(path: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("static SEO Route Handler contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.context.mockResolvedValue({ connection: {}, actor, validation });
    state.list.mockResolvedValue([{ key: "home", path: "/" }]);
    state.get.mockResolvedValue({ key: "home", path: "/" });
    state.create.mockResolvedValue({ key: "home", path: "/" });
    state.update.mockResolvedValue({ key: "home", path: "/" });
  });

  it("requires the correct permissions for reads", async () => {
    expect((await list(request("/api/seo/static"))).status).toBe(200);
    expect(state.context).toHaveBeenCalledWith(expect.any(NextRequest), "seo:read");

    const response = await detail(request("/api/seo/static/home"), {
      params: Promise.resolve({ staticPageKey: "home" }),
    });
    expect(response.status).toBe(200);
    expect(state.get).toHaveBeenCalledWith(actor, "home");
  });

  it("creates only an approved registry target", async () => {
    const response = await create(
      request("/api/seo/static", "POST", { key: "home", translations }),
    );
    expect(response.status).toBe(201);
    expect(state.context).toHaveBeenCalledWith(expect.any(NextRequest), "seo:create", true);
    expect(state.create).toHaveBeenCalledWith(actor, { key: "home", translations });

    const invalid = await create(
      request("/api/seo/static", "POST", { key: "authentication", translations }),
    );
    expect(invalid.status).toBe(400);
    expect(state.create).toHaveBeenCalledTimes(1);
  });

  it("updates localized metadata without accepting a replacement route", async () => {
    const context = { params: Promise.resolve({ staticPageKey: "home" }) };
    const response = await update(
      request("/api/seo/static/home", "PATCH", { translations }),
      context,
    );
    expect(response.status).toBe(200);
    expect(state.context).toHaveBeenCalledWith(expect.any(NextRequest), "seo:update", true);
    expect(state.update).toHaveBeenCalledWith(actor, "home", { translations });

    const invalid = await update(
      request("/api/seo/static/home", "PATCH", { path: "/different" }),
      context,
    );
    expect(invalid.status).toBe(400);
    expect(state.update).toHaveBeenCalledTimes(1);
  });
});
