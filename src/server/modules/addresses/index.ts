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
  AddressRepositoryConflictError,
  createAddressRepository,
  type AddressRepository,
  type AddressSnapshot,
} from "./repository/address";
export {
  AddressCrudError,
  createAddressCrudServices,
  type AddressCrudAction,
  type AddressCrudActor,
  type AddressCrudAuditEvent,
  type AddressCrudDependencies,
} from "./service/address-crud";
export { createAddressAuditSink } from "./service/address-audit";
export {
  CheckoutAddressError,
  loadOwnedAddressForCheckout,
  resolveAddressForCheckout,
  verifyOwnedAddressForCheckout,
  type DeliveryZoneDecision,
} from "./service/address-checkout";
export {
  PORTO_MUNICIPALITY_BOUNDARY,
  evaluatePortoDelivery,
  haversineDistanceMeters,
  isPointInsideBoundary,
  type DeliveryOrigin,
} from "./service/delivery-zone";
export {
  PORTUGUESE_POSTAL_CODE_PATTERN,
  addressEmptyMutationSchema,
  addressIdParametersSchema,
  addressPointSchema,
  addressUpdateSchema,
  addressWriteSchema,
  customerAddressParametersSchema,
  isPortuguesePostalCode,
  normalizePortuguesePostalCode,
  type AddressPointInput,
  type AddressUpdateInput,
  type AddressWriteInput,
} from "./validation/address";
