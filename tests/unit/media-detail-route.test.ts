// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  admin: vi.fn(),
  detail: vi.fn(),
  deleteMedia: vi.fn(),
  protectedMutation: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
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
  isProtectedMutation: state.protectedMutation,
  requireAdminActor: state.admin,
}));
vi.mock("@/server/modules/logs", () => ({ recordAuditEvent: state.audit }));
vi.mock("@/server/modules/media", () => ({
  MediaDeleteError: class MediaDeleteError extends Error {
    constructor(
      readonly code: string,
      readonly referenceCount?: number,
    ) {
      super(code);
    }
  },
  MediaUpdateError: class MediaUpdateError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  StorageError: class StorageError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  createMediaDeleteRepository: () => ({}),
  createMediaReadRepository: () => ({}),
  createMediaUpdateRepository: () => ({}),
  createMinioStorageProvider: () => ({}),
  deleteMediaSafely: state.deleteMedia,
  getMediaDetail: state.detail,
  updateMediaMetadata: state.update,
}));

import { DELETE, GET, PATCH } from "@/app/api/media/[mediaId]/route";

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
    state.protectedMutation.mockReturnValue(true);
    state.detail.mockResolvedValue({
      id,
      originalName: "meal.png",
      original: {
        url: "https://objects.example/original?signature=private",
        expiresAt: "2026-09-18T12:05:00.000Z",
      },
    });
    state.deleteMedia.mockResolvedValue({
      id,
      deletedAt: "2026-09-18T10:00:00.000Z",
      purgeEligibleAt: "2026-10-18T10:00:00.000Z",
      recycleWindowDays: 30,
    });
    state.update.mockResolvedValue({
      id,
      originalName: "renamed meal.png",
      translations: [{ locale: "en", alt: "Renamed meal" }],
    });
    state.audit.mockResolvedValue(undefined);
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

  it("updates allowlisted metadata with CSRF, update permission, and an audit event", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost:3000/api/media/${id}`, {
        method: "PATCH",
        headers: {
          cookie: "sara_admin_dev=test-token",
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          originalName: "renamed meal.png",
          translations: [{ locale: "en", alt: "Renamed meal" }],
        }),
      }),
      { params: Promise.resolve({ mediaId: id }) },
    );
    expect(response.status).toBe(200);
    expect(state.admin).toHaveBeenCalledWith({}, "test-token", "media:update");
    expect(state.update.mock.calls[0]?.[1]).toMatchObject({
      id,
      actorId: "admin",
      update: {
        originalName: "renamed meal.png",
        translations: [{ locale: "en", alt: "Renamed meal" }],
      },
    });
    expect(state.audit).toHaveBeenCalledOnce();
  });

  it("rejects object facts and variants before invoking the update service", async () => {
    for (const body of [
      { objectKey: "originals/injected.png" },
      { variants: [{ key: "variants/injected.webp" }] },
      { mimeType: "image/jpeg", translations: [{ locale: "en", alt: "Meal" }] },
    ]) {
      const response = await PATCH(
        new NextRequest(`http://localhost:3000/api/media/${id}`, {
          method: "PATCH",
          headers: {
            cookie: "sara_admin_dev=test-token",
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ mediaId: id }) },
      );
      expect(response.status).toBe(400);
    }
    expect(state.update).not.toHaveBeenCalled();
  });

  it("recycles media with delete permission, CSRF protection, and an audit event", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost:3000/api/media/${id}`, {
        method: "DELETE",
        headers: {
          cookie: "sara_admin_dev=test-token",
          origin: "http://localhost:3000",
        },
      }),
      { params: Promise.resolve({ mediaId: id }) },
    );

    expect(response.status).toBe(200);
    expect(state.admin).toHaveBeenCalledWith({}, "test-token", "media:delete");
    expect(state.deleteMedia.mock.calls[0]?.[1]).toMatchObject({ id, actorId: "admin" });
    expect(state.audit).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "crud.resource.delete",
        resource: expect.objectContaining({
          ref: id,
          snapshot: expect.objectContaining({ status: "recycled" }),
        }),
      }),
    );
  });

  it("rejects force controls and returns conflict for referenced media", async () => {
    const forceResponse = await DELETE(
      new NextRequest(`http://localhost:3000/api/media/${id}?force=true`, {
        method: "DELETE",
        headers: { cookie: "sara_admin_dev=test-token", origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ mediaId: id }) },
    );
    expect(forceResponse.status).toBe(400);
    expect(state.deleteMedia).not.toHaveBeenCalled();

    const { MediaDeleteError } = await import("@/server/modules/media");
    state.deleteMedia.mockRejectedValueOnce(new MediaDeleteError("referenced", 2));
    const mapped = await DELETE(
      new NextRequest(`http://localhost:3000/api/media/${id}`, {
        method: "DELETE",
        headers: { cookie: "sara_admin_dev=test-token", origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ mediaId: id }) },
    );
    expect(mapped.status).toBe(409);
  });
});
