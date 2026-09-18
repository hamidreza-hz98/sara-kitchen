// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as MediaModule from "@/server/modules/media";

const state = vi.hoisted(() => ({
  connect: vi.fn(),
  protectedMutation: vi.fn(),
  admin: vi.fn(),
  create: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/environment", () => ({
  getServerEnvironment: () => ({ MINIO_BUCKET: "private-media" }),
}));
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
vi.mock("@/server/modules/media", async (importOriginal) => {
  const actual = await importOriginal<typeof MediaModule>();
  return {
    ...actual,
    createMediaUpload: state.create,
    createMediaUploadRepository: () => ({}),
    createMinioStorageProvider: () => ({}),
  };
});

import { POST } from "@/app/api/media/route";
import { UploadPolicyError } from "@/server/modules/media";

function uploadRequest(
  options: { cookie?: boolean; sizeHeader?: number; translations?: string } = {},
) {
  const form = new FormData();
  form.append(
    "file",
    new File([Uint8Array.from([137, 80, 78, 71])], "meal.png", { type: "image/png" }),
  );
  form.append(
    "translations",
    options.translations ?? JSON.stringify([{ locale: "en", alt: "Meal" }]),
  );
  const native = new Request("http://localhost:3000/api/media", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      ...(options.cookie === false ? {} : { cookie: "sara_admin_dev=test-token" }),
      ...(options.sizeHeader ? { "content-length": String(options.sizeHeader) } : {}),
    },
    body: form,
  });
  return new NextRequest(native);
}

describe("media upload Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.connect.mockResolvedValue({});
    state.protectedMutation.mockReturnValue(true);
    state.admin.mockResolvedValue({
      id: "507f1f77bcf86cd799439011",
      role: "owner",
      displayName: "Sara",
    });
    state.create.mockResolvedValue({ id: "media-1", checksum: "a".repeat(64), variantCount: 4 });
    state.audit.mockResolvedValue(undefined);
  });

  it("requires an admin session and CSRF protection before parsing a body", async () => {
    expect((await POST(uploadRequest({ cookie: false }))).status).toBe(401);
    expect(state.connect).not.toHaveBeenCalled();
    state.protectedMutation.mockReturnValue(false);
    expect((await POST(uploadRequest())).status).toBe(403);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("returns a created result for one validated form file", async () => {
    const response = await POST(uploadRequest());
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body).toMatchObject({
      ok: true,
      data: { id: "media-1", variantCount: 4 },
    });
    expect(state.admin).toHaveBeenCalledWith({}, "test-token", "media:create");
    expect(state.create.mock.calls[0]?.[1]).toMatchObject({
      actorId: "507f1f77bcf86cd799439011",
      bucket: "private-media",
      candidate: { name: "meal.png" },
      translations: [{ locale: "en", alt: "Meal" }],
    });
    expect(state.audit).toHaveBeenCalledOnce();
  });

  it("rejects an oversized body and malformed translations before service invocation", async () => {
    expect((await POST(uploadRequest({ sizeHeader: 4 * 1024 * 1024 }))).status).toBe(400);
    expect((await POST(uploadRequest({ translations: "not-json" }))).status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
  });

  it("maps signature failures to field-safe validation errors", async () => {
    state.create.mockRejectedValue(new UploadPolicyError("invalid_signature"));
    const response = await POST(uploadRequest());
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
