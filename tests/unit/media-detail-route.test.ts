// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  admin: vi.fn(),
  detail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ connectToDatabase: state.connect }));
vi.mock("@/server/modules/auth", () => ({
  AuthorizationGuardError: class AuthorizationGuardError extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
  adminCookieName: () => "sara_admin_dev",
  requireAdminActor: state.admin,
}));
vi.mock("@/server/modules/media", () => ({
  StorageError: class StorageError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  createMediaReadRepository: () => ({}),
  createMinioStorageProvider: () => ({}),
  getMediaDetail: state.detail,
}));

import { GET } from "@/app/api/media/[mediaId]/route";

const id = "507f1f77bcf86cd799439011";

function request(cookie = true) {
  return new NextRequest(`http://localhost:3000/api/media/${id}`, {
    headers: cookie ? { cookie: "sara_admin_dev=test-token" } : {},
  });
}

describe("media detail Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.connect.mockResolvedValue({});
    state.admin.mockResolvedValue({ id: "admin", role: "owner" });
    state.detail.mockResolvedValue({
      id,
      originalName: "meal.png",
      original: {
        url: "https://objects.example/original?signature=private",
        expiresAt: "2026-09-18T12:05:00.000Z",
      },
    });
  });

  it("requires media read permission and returns private expiring access", async () => {
    expect((await GET(request(false), { params: Promise.resolve({ mediaId: id }) })).status).toBe(
      401,
    );
    const response = await GET(request(), { params: Promise.resolve({ mediaId: id }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id,
        original: { url: expect.stringContaining("signature"), expiresAt: expect.any(String) },
      },
    });
    expect(state.admin).toHaveBeenCalledWith({}, "test-token", "media:read");
  });

  it("rejects malformed ids and returns not found for absent active media", async () => {
    expect(
      (await GET(request(), { params: Promise.resolve({ mediaId: "not-an-id" }) })).status,
    ).toBe(400);
    state.detail.mockResolvedValue(null);
    expect((await GET(request(), { params: Promise.resolve({ mediaId: id }) })).status).toBe(404);
  });
});
