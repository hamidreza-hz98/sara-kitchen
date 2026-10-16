import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assessAddressDelivery } from "@/server/delivery/address-eligibility";

const point = { type: "Point" as const, coordinates: [-8.606, 41.1496] as [number, number] };

describe("profile/cart address eligibility", () => {
  it("accepts a Porto point within the configured radius", () => {
    expect(
      assessAddressDelivery(point, { origin: { latitude: 41.15, longitude: -8.61 }, radiusKm: 5 })
        .eligible,
    ).toBe(true);
  });

  it("rejects the same point if a narrower published radius applies", () => {
    expect(
      assessAddressDelivery(point, {
        origin: { latitude: 41.15, longitude: -8.61 },
        radiusKm: 0.01,
      }),
    ).toMatchObject({
      eligible: false,
      reason: "outside_service_area",
    });
  });

  it("rejects a point outside Porto even without a radius limit", () => {
    expect(
      assessAddressDelivery(
        { type: "Point", coordinates: [-9.14, 38.72] },
        {
          origin: { latitude: 41.15, longitude: -8.61 },
          radiusKm: null,
        },
      ).eligible,
    ).toBe(false);
  });
});
