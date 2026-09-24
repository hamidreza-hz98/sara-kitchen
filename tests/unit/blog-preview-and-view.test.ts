import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BLOG_VIEW_DEDUPLICATION_WINDOW_MS,
  blogViewReceiptSchema,
  createBlogViewCounter,
  evaluateBlogViewSignal,
  issueBlogPreviewToken,
  verifyBlogPreviewToken,
} from "@/server/modules/blogs";

const blogId = "a".repeat(24);
const secret = "blog-policy-secret-that-is-at-least-32-characters";
const at = new Date("2026-09-24T12:00:00.000Z");

describe("blog preview tokens", () => {
  it("binds a short-lived token to blog id and exact record version", () => {
    const token = issueBlogPreviewToken({ blogId, version: 4 }, secret, { at });
    expect(verifyBlogPreviewToken(token, { blogId, version: 4 }, secret, at)).toBe(true);
    expect(verifyBlogPreviewToken(token, { blogId, version: 5 }, secret, at)).toBe(false);
    expect(verifyBlogPreviewToken(token, { blogId: "b".repeat(24), version: 4 }, secret, at)).toBe(
      false,
    );
    expect(
      verifyBlogPreviewToken(`${token.slice(0, -1)}x`, { blogId, version: 4 }, secret, at),
    ).toBe(false);
    expect(
      verifyBlogPreviewToken(
        token,
        { blogId, version: 4 },
        secret,
        new Date(at.getTime() + 15 * 60_000),
      ),
    ).toBe(false);
  });
});

describe("blog view policy", () => {
  const human = {
    blogId,
    userAgent: "Mozilla/5.0 human browser",
    clientAddress: "192.0.2.50",
    engagementMs: 3_000,
    visibilityState: "visible" as const,
  };

  it("creates a private deduplicated candidate and declares retention indexes", () => {
    const first = evaluateBlogViewSignal(human, { secret, at });
    const repeat = evaluateBlogViewSignal(human, { secret, at: new Date(at.getTime() + 60_000) });
    expect(first).toEqual(repeat);
    expect(first).toMatchObject({
      countable: true,
      candidate: { visitorHash: expect.stringMatching(/^[a-f\d]{64}$/u) },
    });
    if (!first.countable) throw new Error("Expected a countable signal.");
    expect(first.candidate).not.toHaveProperty("userAgent");
    expect(first.candidate).not.toHaveProperty("clientAddress");
    expect(first.candidate.windowStartedAt.getTime() % BLOG_VIEW_DEDUPLICATION_WINDOW_MS).toBe(0);
    expect(blogViewReceiptSchema.path("visitorHash").options.select).toBe(false);
    expect(blogViewReceiptSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { blogId: 1, visitorHash: 1, windowStartedAt: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });

  it.each([
    [{ ...human, userAgent: "Googlebot" }, "bot"],
    [{ ...human, purpose: "prefetch" }, "prefetch"],
    [{ ...human, visibilityState: "hidden" }, "not_engaged"],
    [{ ...human, engagementMs: 2_999 }, "not_engaged"],
  ] as const)("ignores non-meaningful signal %#", (signal, reason) => {
    expect(evaluateBlogViewSignal(signal, { secret, at })).toEqual({ countable: false, reason });
  });

  it("schedules persistence without allowing failures to affect rendering", async () => {
    let scheduled: (() => Promise<void>) | undefined;
    const logger = { error: vi.fn() };
    const failure = new Error("offline");
    const counter = createBlogViewCounter({
      repository: { count: vi.fn(async () => Promise.reject(failure)) },
      secret,
      logger,
      now: () => at,
      schedule: (work) => {
        scheduled = work;
      },
    });
    expect(counter.queue(human)).toBe("scheduled");
    await expect(scheduled?.()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: failure }));
  });
});
