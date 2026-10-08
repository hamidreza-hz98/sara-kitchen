/** Public entry point for checkout and order lifecycle use cases. */
export const MODULE_NAME = "orders" as const;
export {
  countHistoricalOrdersForCustomer,
  exportOrderHistoryForCustomer,
} from "./service/customer-privacy";
export { summarizeOrdersForCustomers, type CustomerOrderSummary } from "./service/customer-summary";
