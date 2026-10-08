/** Public entry point for customer address and delivery-location use cases. */
export const MODULE_NAME = "addresses" as const;
export {
  ADDRESS_VALIDATION_PROVIDERS,
  ADDRESS_VALIDATION_STATUSES,
  type AddressPoint,
  type AddressValidationMetadata,
  type AddressValidationProvider,
  type AddressValidationStatus,
} from "./model/address";
export {
  AddressOwnershipError,
  isAddressOwner,
  requireAddressOwnership,
} from "./policy/address-ownership";
export {
  planDefaultAddressCreate,
  replacementDefaultAddressId,
  type AddressDefaultCreatePlan,
} from "./policy/default-address";
export {
  PORTUGUESE_POSTAL_CODE_PATTERN,
  addressPointSchema,
  addressWriteSchema,
  isPortuguesePostalCode,
  normalizePortuguesePostalCode,
  type AddressPointInput,
  type AddressWriteInput,
} from "./validation/address";
