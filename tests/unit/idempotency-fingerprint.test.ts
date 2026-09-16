import { describe, expect, it } from "vitest";

import { fingerprintRequest } from "@/server/modules/transactions";

describe("idempotency request fingerprint", () => {
  it("is stable across object key order but sensitive to values and array order", () => {
    expect(fingerprintRequest({ dish: "a", quantity: 2 })).toBe(
      fingerprintRequest({ quantity: 2, dish: "a" }),
    );
    expect(fingerprintRequest(["a", "b"])).not.toBe(fingerprintRequest(["b", "a"]));
    expect(fingerprintRequest({ quantity: 2 })).not.toBe(fingerprintRequest({ quantity: 3 }));
  });

  it("rejects non-JSON and oversized payloads", () => {
    expect(() => fingerprintRequest({ value: Number.NaN })).toThrow(TypeError);
    expect(() => fingerprintRequest({ value: new Date() } as never)).toThrow(TypeError);
    expect(() => fingerprintRequest("x".repeat(65_536))).toThrow(RangeError);
  });
});
