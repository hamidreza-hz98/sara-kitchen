import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PORTO_MUNICIPALITY_BOUNDARY,
  evaluatePortoDelivery,
  haversineDistanceMeters,
} from "@/server/modules/addresses";

const origin = { latitude: 41.1579, longitude: -8.6291 };
const point = (longitude: number, latitude: number) => ({
  type: "Point" as const,
  coordinates: [longitude, latitude] as [number, number],
});

describe("Porto delivery eligibility", () => {
  it("keeps the complete, closed municipal boundary and accepts central Porto", () => {
    expect(PORTO_MUNICIPALITY_BOUNDARY.length).toBeGreaterThan(2_000);
    expect(PORTO_MUNICIPALITY_BOUNDARY[0]).toEqual(PORTO_MUNICIPALITY_BOUNDARY.at(-1));
    expect(evaluatePortoDelivery(point(-8.6291, 41.1579), origin)).toEqual({
      eligible: true,
      distanceMeters: 0,
    });
  });

  it("rejects nearby municipalities even when the distance is short", () => {
    expect(evaluatePortoDelivery(point(-8.61, 41.13), origin)).toMatchObject({
      eligible: false,
      reason: "outside_service_area",
    });
    expect(evaluatePortoDelivery(point(-8.69, 41.2), origin)).toMatchObject({
      eligible: false,
      reason: "outside_service_area",
    });
  });

  it("calculates reproducible straight-line meters from the kitchen", () => {
    const destination = point(-8.63, 41.17);
    const distance = haversineDistanceMeters(origin, destination);
    expect(distance).toBeGreaterThan(1_300);
    expect(distance).toBeLessThan(1_400);
  });
});
