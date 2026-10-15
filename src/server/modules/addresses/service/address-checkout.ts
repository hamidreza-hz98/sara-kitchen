import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import {
  createAddressRepository,
  type AddressRepository,
  type AddressSnapshot,
} from "../repository/address";
import type { AddressPoint } from "../model/address";
import { getAddressModel } from "../model/address";

export async function loadOwnedAddressForCheckout(
  connection: Connection,
  customerId: string,
  addressId: string,
  session: ClientSession,
): Promise<AddressSnapshot | null> {
  const record = await getAddressModel(connection)
    .findOne({
      _id: new Types.ObjectId(addressId),
      customerId: new Types.ObjectId(customerId),
      deletedAt: null,
    })
    .session(session);
  if (!record) return null;
  return {
    id: record._id.toHexString(),
    customerId,
    name: record.name,
    recipientName: record.recipientName,
    recipientMobile: record.recipientMobile,
    formattedAddress: record.formattedAddress,
    location: {
      type: "Point",
      coordinates: [record.location.coordinates[0], record.location.coordinates[1]],
    },
    postalCode: record.postalCode,
    deliveryNotes: record.deliveryNotes,
    isDefault: record.isDefault,
    validation: {
      status: record.validation.status,
      provider: record.validation.provider,
      providerReference: record.validation.providerReference,
      checkedAt: record.validation.checkedAt?.toISOString() ?? null,
    },
    version: Number(record.get("__v") ?? 0),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

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
