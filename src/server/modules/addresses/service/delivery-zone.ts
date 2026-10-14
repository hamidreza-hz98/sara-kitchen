import "server-only";

import type { AddressPoint } from "../model/address";
import portoBoundary from "../data/porto-boundary.json";

export type DeliveryOrigin = Readonly<{ latitude: number; longitude: number }>;

/** Complete CAOP-derived Porto polygon supplied by GEO API PT, retrieved 2026-10-14. */
export const PORTO_MUNICIPALITY_BOUNDARY: readonly (readonly [number, number])[] =
  portoBoundary.map((position) => [position[0]!, position[1]!]);

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(origin: DeliveryOrigin, point: AddressPoint): number {
  const [longitude, latitude] = point.coordinates;
  const latitudeDelta = radians(latitude - origin.latitude);
  const longitudeDelta = radians(longitude - origin.longitude);
  const startLatitude = radians(origin.latitude);
  const endLatitude = radians(latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value)));
}

export function isPointInsideBoundary(
  point: AddressPoint,
  boundary: readonly (readonly [number, number])[] = PORTO_MUNICIPALITY_BOUNDARY,
): boolean {
  const [x, y] = point.coordinates;
  let inside = false;
  for (
    let current = 0, previous = boundary.length - 1;
    current < boundary.length;
    previous = current++
  ) {
    const [currentX, currentY] = boundary[current]!;
    const [previousX, previousY] = boundary[previous]!;
    const cross = (x - currentX) * (previousY - currentY) - (y - currentY) * (previousX - currentX);
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(currentX, previousX) &&
      x <= Math.max(currentX, previousX) &&
      y >= Math.min(currentY, previousY) &&
      y <= Math.max(currentY, previousY)
    )
      return true;
    const intersects =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function evaluatePortoDelivery(
  point: AddressPoint,
  origin: DeliveryOrigin,
): Readonly<{ eligible: boolean; distanceMeters: number; reason?: "outside_service_area" }> {
  const distanceMeters = haversineDistanceMeters(origin, point);
  return isPointInsideBoundary(point)
    ? { eligible: true, distanceMeters }
    : { eligible: false, distanceMeters, reason: "outside_service_area" };
}
