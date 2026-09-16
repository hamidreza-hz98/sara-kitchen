import { describe, expect, it } from "vitest";

import { checkReadiness } from "@/server/health/readiness";

describe("readiness aggregation", () => {
  it("requires both MongoDB and object storage", async () => {
    await expect(
      checkReadiness({ mongodb: async () => true, objectStorage: async () => true }),
    ).resolves.toEqual({
      status: "ready",
      dependencies: { mongodb: "ready", objectStorage: "ready" },
    });
    await expect(
      checkReadiness({ mongodb: async () => true, objectStorage: async () => false }),
    ).resolves.toEqual({
      status: "not_ready",
      dependencies: { mongodb: "ready", objectStorage: "unavailable" },
    });
  });

  it("hides provider errors and times out independently", async () => {
    let storageSignal: AbortSignal | undefined;
    const report = await checkReadiness(
      {
        mongodb: async () => {
          throw new Error("mongodb://user:secret@private-host");
        },
        objectStorage: (signal) => {
          storageSignal = signal;
          return new Promise<boolean>(() => {});
        },
      },
      5,
    );
    expect(report).toEqual({
      status: "not_ready",
      dependencies: { mongodb: "unavailable", objectStorage: "unavailable" },
    });
    expect(JSON.stringify(report)).not.toContain("secret");
    expect(storageSignal?.aborted).toBe(true);
    await expect(
      checkReadiness({ mongodb: async () => true, objectStorage: async () => true }, 0),
    ).rejects.toThrow(RangeError);
  });
});
