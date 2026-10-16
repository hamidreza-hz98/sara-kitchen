/** Public entry point for checkout and order lifecycle use cases. */
export const MODULE_NAME = "orders" as const;
export {
  countDashboardOrdersCreated,
  readDashboardOrders,
  type DashboardOrderPeriod,
  type DashboardRecentOrder,
  type DashboardSoldDish,
} from "./service/dashboard-orders";
export {
  submitAtomicCheckout,
  type CheckoutSubmission,
  type CheckoutResult,
} from "./service/atomic-checkout";
export { ORDER_STATUSES, type OrderStatus } from "./model/order";
export { applyVerifiedPaymentStateToOrder, OrderPaymentSyncError } from "./service/payment-state";
export {
  getOrderNotificationDeliveryHealth,
  listCustomerOrderNotifications,
} from "./service/notification-dispatch";
export {
  createOrderManagement,
  OrderManagementError,
  type OrderAdmin,
} from "./service/order-management";
export {
  orderCodeParametersSchema,
  paymentResultQuerySchema,
  orderListQuerySchema,
  orderInternalNoteSchema,
  orderTransitionSchema,
  orderCancelSchema,
  orderTransactionSchema,
} from "./validation/order-management";
export {
  getCustomerPaymentResult,
  PaymentResultError,
  type CustomerPaymentResult,
  type CustomerPaymentResultState,
} from "./service/payment-result";
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
export {
  readCustomerProfileOrders,
  type CustomerLatestOrder,
  type CustomerProfileOrders,
} from "./service/customer-profile-overview";
