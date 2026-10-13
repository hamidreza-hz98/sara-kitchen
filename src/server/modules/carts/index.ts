/** Public entry point for cart, pricing, and availability coordination. */
export const MODULE_NAME = "carts" as const;

export {
  CART_CURRENCY,
  CART_GUEST_TOKEN_HASH_PATTERN,
  CART_INDEX_NAMES,
  CART_MAX_DISTINCT_LINES,
  CART_MAX_MONEY_CENTS,
  CART_MAX_NOTES_LENGTH,
  CART_MAX_QUANTITY_PER_LINE,
  CART_STATUSES,
  CART_TERMINAL_STATUSES,
  type CartLine,
  type CartPricingSummary,
  type CartRecord,
  type CartStatus,
} from "./model/cart";
export {
  CART_FREE_DELIVERY_THRESHOLD_CENTS,
  CART_PRICING_ERROR_CODES,
  CART_TAX_POLICY,
  CartPricingError,
  calculateCartPricing,
  type CalculateCartPricingInput,
  type CartFulfillment,
  type CartPricedLine,
  type CartPricingAdjustment,
  type CartPricingDependencies,
  type CartPricingDishSource,
  type CartPricingErrorCode,
  type CartPricingIssue,
  type CartPricingLineInput,
  type CartPricingResult,
  type DeliveryPriceBand,
} from "./pricing/cart-pricing";
