import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DISH_VIEW_DEDUPLICATION_WINDOW_MS,
  evaluateDishViewSignal,
} from "@/server/modules/dishes/policy/dish-view";
import { dishViewReceiptSchema } from "@/server/modules/dishes/model/dish-view-receipt";
import { createDishViewCounter } from "@/server/modules/dishes/service/dish-view";
import type { DishViewRepository } from "@/server/modules/dishes/repository/dish-view";

const dishId = "a".repeat(24);
const secret = "dish-view-test-secret-with-at-least-32-characters";
const at = new Date("2026-09-23T12:34:56.000Z");
const humanSignal = {
  dishId,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit Safari/537.36",
  clientAddress: "192.0.2.25",
  engagementMs: 3_000,
  visibilityState: "visible" as const,
};

describe("dish view policy", () => {
  it("stores only an opaque hidden fingerprint with unique-window and TTL indexes", () => {
    expect(dishViewReceiptSchema.path("visitorHash").options.select).toBe(false);
    const indexes = dishViewReceiptSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { dishId: 1, visitorHash: 1, windowStartedAt: 1 },
          expect.objectContaining({ unique: true, name: "dish_view_receipt_unique_window" }),
        ],
        [
          { expiresAt: 1 },
          expect.objectContaining({
            expireAfterSeconds: 0,
            name: "dish_view_receipt_expiry_ttl",
          }),
        ],
      ]),
    );
  });

  it("creates a stable privacy-safe candidate within a six-hour window", () => {
    const first = evaluateDishViewSignal(humanSignal, { secret, at });
    const repeat = evaluateDishViewSignal(humanSignal, {
      secret,
      at: new Date(at.getTime() + 60_000),
    });
    expect(first).toMatchObject({
      countable: true,
      candidate: {
        dishId,
        visitorHash: expect.stringMatching(/^[a-f\d]{64}$/u),
      },
    });
    expect(repeat).toEqual(first);
    if (!first.countable) throw new Error("Expected countable signal.");
    expect(first.candidate).not.toHaveProperty("clientAddress");
    expect(first.candidate).not.toHaveProperty("userAgent");
    expect(first.candidate.windowStartedAt.getTime() % DISH_VIEW_DEDUPLICATION_WINDOW_MS).toBe(0);
  });

  it("changes the fingerprint/window only when the identity or window changes", () => {
    const first = evaluateDishViewSignal(humanSignal, { secret, at });
    const anotherViewer = evaluateDishViewSignal(
      { ...humanSignal, clientAddress: "192.0.2.26" },
      { secret, at },
    );
    const later = evaluateDishViewSignal(humanSignal, {
      secret,
      at: new Date(at.getTime() + DISH_VIEW_DEDUPLICATION_WINDOW_MS),
    });
    expect(first.countable && anotherViewer.countable).toBe(true);
    expect(first.countable && later.countable).toBe(true);
    if (!first.countable || !anotherViewer.countable || !later.countable) return;
    expect(anotherViewer.candidate.visitorHash).not.toBe(first.candidate.visitorHash);
    expect(later.candidate.windowStartedAt).not.toEqual(first.candidate.windowStartedAt);
    expect(later.candidate.visitorHash).not.toBe(first.candidate.visitorHash);
  });

  it.each([
    [{ ...humanSignal, dishId: "invalid" }, "invalid"],
    [{ ...humanSignal, userAgent: null }, "invalid"],
    [{ ...humanSignal, userAgent: "Googlebot/2.1" }, "bot"],
    [{ ...humanSignal, userAgent: "curl/8.0" }, "bot"],
    [{ ...humanSignal, purpose: "prefetch" }, "prefetch"],
    [{ ...humanSignal, visibilityState: "hidden" }, "not_engaged"],
    [{ ...humanSignal, engagementMs: 2_999 }, "not_engaged"],
    [{ ...humanSignal, engagementMs: Number.NaN }, "not_engaged"],
  ] as const)("rejects non-meaningful signal %#", (signal, reason) => {
    expect(evaluateDishViewSignal(signal, { secret, at })).toEqual({ countable: false, reason });
  });
});

describe("dish view scheduling", () => {
  it("returns before persistence and runs work only through the scheduler", async () => {
    let scheduled: (() => Promise<void>) | undefined;
    const count = vi.fn(async () => "counted" as const);
    const counter = createDishViewCounter({
      repository: { count },
      secret,
      now: () => at,
      schedule: (work) => {
        scheduled = work;
      },
    });
    expect(counter.queue(humanSignal)).toBe("scheduled");
    expect(count).not.toHaveBeenCalled();
    await scheduled?.();
    expect(count).toHaveBeenCalledOnce();
  });

  it("swallows and logs asynchronous persistence failures", async () => {
    let scheduled: (() => Promise<void>) | undefined;
    const failure = new Error("database unavailable");
    const repository: DishViewRepository = { count: vi.fn(async () => Promise.reject(failure)) };
    const logger = { error: vi.fn() };
    const counter = createDishViewCounter({
      repository,
      logger,
      secret,
      now: () => at,
      schedule: (work) => {
        scheduled = work;
      },
    });
    expect(counter.queue(humanSignal)).toBe("scheduled");
    await expect(scheduled?.()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dish-view.count.failed", error: failure }),
    );
  });

  it("does not schedule ignored signals", () => {
    const schedule = vi.fn();
    const counter = createDishViewCounter({
      repository: { count: vi.fn() },
      secret,
      now: () => at,
      schedule,
    });
    expect(counter.queue({ ...humanSignal, userAgent: "Googlebot" })).toBe("ignored");
    expect(schedule).not.toHaveBeenCalled();
  });
});
