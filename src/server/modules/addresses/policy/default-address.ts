import "server-only";

export type AddressDefaultCreatePlan = Readonly<{
  isDefault: boolean;
  unsetCurrentDefault: boolean;
}>;

/** First address is always default; a requested later default replaces the current one. */
export function planDefaultAddressCreate(
  activeAddressCount: number,
  requestedDefault: boolean,
): AddressDefaultCreatePlan {
  if (!Number.isSafeInteger(activeAddressCount) || activeAddressCount < 0)
    throw new RangeError("Active address count must be a non-negative safe integer.");
  const firstAddress = activeAddressCount === 0;
  return {
    isDefault: firstAddress || requestedDefault,
    unsetCurrentDefault: !firstAddress && requestedDefault,
  };
}

/** Deleting the default promotes the first repository-sorted survivor. */
export function replacementDefaultAddressId(
  removedWasDefault: boolean,
  remainingAddressIds: readonly string[],
): string | null {
  if (!removedWasDefault || remainingAddressIds.length === 0) return null;
  return remainingAddressIds[0] ?? null;
}
