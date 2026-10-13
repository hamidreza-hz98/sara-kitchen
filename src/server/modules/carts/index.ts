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
