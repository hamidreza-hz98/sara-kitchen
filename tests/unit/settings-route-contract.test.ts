// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: vi.fn(),
  getAdmin: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/settings/route-helper", () => ({
  settingsRequestContext: state.context,
  resolveSettingsRuntime: () => ({
    getAdmin: state.getAdmin,
    update: state.update,
    publish: state.publish,
  }),
  translateSettingsError: (error: unknown) => {
    throw error;
  },
}));

import { POST as publish } from "@/app/api/settings/[section]/publish/route";
import { GET, PATCH } from "@/app/api/settings/[section]/route";

const actor = { id: "507f1f77bcf86cd799439011", role: "owner" } as const;
const validation = { translate: (key: string) => key };

function request(path: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("settings Route Handler contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.context.mockResolvedValue({ connection: {}, actor, validation });
    state.getAdmin.mockResolvedValue(null);
    state.update.mockResolvedValue({ key: "contact" });
    state.publish.mockResolvedValue({ key: "faq" });
  });

  it("authorizes administrative reads and rejects unknown section routes", async () => {
    const response = await GET(request("/api/settings/contact"), {
      params: Promise.resolve({ section: "contact" }),
    });
    expect(response.status).toBe(200);
    expect(state.context).toHaveBeenCalledWith(expect.any(NextRequest), "settings:read");
    expect(state.getAdmin).toHaveBeenCalledWith(actor, "contact");

    const invalid = await GET(request("/api/settings/unknown"), {
      params: Promise.resolve({ section: "unknown" }),
    });
    expect(invalid.status).toBe(400);
  });

  it("applies CSRF-aware mutation context and delegates exact payload validation", async () => {
    const payload = { data: { email: "hello@example.test" }, translations: [] };
    const response = await PATCH(request("/api/settings/contact", "PATCH", payload), {
      params: Promise.resolve({ section: "contact" }),
    });
    expect(response.status).toBe(200);
    expect(state.context).toHaveBeenCalledWith(expect.any(NextRequest), "settings:read", true);
    expect(state.update).toHaveBeenCalledWith(actor, "contact", payload);
  });

  it("publishes only a registered staged section through the service", async () => {
    const response = await publish(request("/api/settings/faq/publish", "POST"), {
      params: Promise.resolve({ section: "faq" }),
    });
    expect(response.status).toBe(200);
    expect(state.publish).toHaveBeenCalledWith(actor, "faq");
  });
});
