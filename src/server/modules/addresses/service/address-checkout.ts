import "server-only";

import type { Connection } from "mongoose";

import {
  createAddressRepository,
  type AddressRepository,
  type AddressSnapshot,
} from "../repository/address";
import type { AddressPoint } from "../model/address";

export type DeliveryZoneDecision = Readonly<{
  eligible: boolean;
  distanceMeters?: number;
  deliveryFeeCents?: number;
  reason?: string;
}>;

export class CheckoutAddressError extends Error {
  constructor(readonly code: "not_found" | "outside_delivery_zone") {
    super(code);
    this.name = "CheckoutAddressError";
  }
}

export async function verifyOwnedAddressForCheckout(
  repository: Pick<AddressRepository, "findOwnedById">,
  input: Readonly<{ customerId: string; addressId: string }>,
  verifyDeliveryZone: (point: AddressPoint) => Promise<DeliveryZoneDecision>,
): Promise<Readonly<{ address: AddressSnapshot; delivery: DeliveryZoneDecision }>> {
  const address = await repository.findOwnedById(input.customerId, input.addressId);
  if (!address) throw new CheckoutAddressError("not_found");
  const delivery = await verifyDeliveryZone(address.location);
  if (!delivery.eligible) throw new CheckoutAddressError("outside_delivery_zone");
  return { address, delivery };
}

/** Checkout entry point: always reloads the address and evaluates the current service-area policy. */
export function resolveAddressForCheckout(
  connection: Connection,
  input: Readonly<{ customerId: string; addressId: string }>,
  verifyDeliveryZone: (point: AddressPoint) => Promise<DeliveryZoneDecision>,
) {
  return verifyOwnedAddressForCheckout(
    createAddressRepository(connection),
    input,
    verifyDeliveryZone,
  );
}
