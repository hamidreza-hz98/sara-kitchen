import "server-only";

import { Types } from "mongoose";

export class AddressOwnershipError extends Error {
  constructor() {
    super("address_not_owned");
    this.name = "AddressOwnershipError";
  }
}

function normalizedObjectId(value: string | Types.ObjectId): string | null {
  if (value instanceof Types.ObjectId) return value.toHexString();
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value).toHexString() : null;
}

export function isAddressOwner(
  addressCustomerId: string | Types.ObjectId,
  actorCustomerId: string | Types.ObjectId,
): boolean {
  const addressOwner = normalizedObjectId(addressCustomerId);
  const actor = normalizedObjectId(actorCustomerId);
  return addressOwner !== null && actor !== null && addressOwner === actor;
}

export function requireAddressOwnership(
  addressCustomerId: string | Types.ObjectId,
  actorCustomerId: string | Types.ObjectId,
): void {
  if (!isAddressOwner(addressCustomerId, actorCustomerId)) throw new AddressOwnershipError();
}
