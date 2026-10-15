/** Public entry point for checkout and order lifecycle use cases. */
export const MODULE_NAME = "orders" as const;
export {
  submitAtomicCheckout,
  type CheckoutSubmission,
  type CheckoutResult,
} from "./service/atomic-checkout";
export { ORDER_STATUSES, type OrderStatus } from "./model/order";
export {
  ORDER_TRANSITIONS,
  OrderTransitionError,
  initialOrderEffects,
  planOrderTransition,
  soldCountLifecycle,
  validateInitialOrderState,
  type OrderNotificationIntent,
  type OrderTransitionActor,
  type OrderTransitionEffects,
  type OrderTransitionInput,
} from "./policy/order-state-machine";
export {
  countHistoricalOrdersForCustomer,
  exportOrderHistoryForCustomer,
} from "./service/customer-privacy";
export { summarizeOrdersForCustomers, type CustomerOrderSummary } from "./service/customer-summary";
