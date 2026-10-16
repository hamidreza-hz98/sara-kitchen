import "server-only";

import type { Connection } from "mongoose";

import { evaluatePortoDelivery, type AddressPoint } from "@/server/modules/addresses";
import { getServerEnvironment } from "@/server/environment";
import { createSettingsRuntime } from "@/server/modules/settings";

export type AddressDeliveryPolicy = Readonly<{
  origin: Readonly<{ latitude: number; longitude: number }>;
  radiusKm: number | null;
}>;

/** The same current published location/radius is used by cart selection and profile hints. */
export async function loadAddressDeliveryPolicy(
  connection: Connection,
  requestId: string,
): Promise<AddressDeliveryPolicy> {
  const contact = await createSettingsRuntime(connection, { requestId }).getPublic("contact", "en");
  const environment = getServerEnvironment();
  return {
    origin: {
      latitude: contact?.location.latitude ?? environment.KITCHEN_LATITUDE,
      longitude: contact?.location.longitude ?? environment.KITCHEN_LONGITUDE,
    },
    radiusKm: contact?.serviceArea.mode === "radius" ? contact.serviceArea.radiusKm : null,
  };
}

export function assessAddressDelivery(point: AddressPoint, policy: AddressDeliveryPolicy) {
  const decision = evaluatePortoDelivery(point, policy.origin);
  if (!decision.eligible) return decision;
  if (policy.radiusKm !== null && decision.distanceMeters > policy.radiusKm * 1_000)
    return {
      eligible: false as const,
      distanceMeters: decision.distanceMeters,
      reason: "outside_service_area" as const,
    };
  return decision;
}
