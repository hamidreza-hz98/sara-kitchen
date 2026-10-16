/** Stable measurement contract consumed by dashboard aggregations and labels. */
export const DASHBOARD_TIME_ZONE = "Europe/Lisbon" as const;
export const DASHBOARD_CURRENCY = "EUR" as const;
export const DASHBOARD_VIEW_DEDUPLICATION_HOURS = 6 as const;

export const DASHBOARD_ORDER_STATUS_GROUPS = Object.freeze({
  awaitingPayment: Object.freeze(["pending_payment"]),
  paidActive: Object.freeze(["confirmed", "preparing", "ready", "out_for_delivery"]),
  completed: Object.freeze(["completed"]),
  unsuccessful: Object.freeze(["payment_failed", "expired"]),
  cancelled: Object.freeze(["cancelled"]),
  refunded: Object.freeze(["refunded"]),
} as const);

export const DASHBOARD_METRIC_IDS = [
  "grossSalesCents",
  "refundsCents",
  "netSalesCents",
  "ordersCreated",
  "paidOrders",
  "averageOrderValueCents",
  "uniquePayingCustomers",
  "registeredCustomers",
  "publishedDishes",
  "publishedCategories",
  "meaningfulDishViews",
  "bestCustomer",
  "topSellingDish",
] as const;

export type DashboardMetricId = (typeof DASHBOARD_METRIC_IDS)[number];
export type DashboardMetricDefinition = Readonly<{
  source: "transactions" | "orders" | "customers" | "dishes" | "categories" | "dish-views";
  formula: string;
  timeBasis: "event" | "created" | "as-of";
}>;

export const DASHBOARD_METRIC_DEFINITIONS = Object.freeze({
  grossSalesCents: {
    source: "transactions",
    formula: "sum(capture event amountCents in period)",
    timeBasis: "event",
  },
  refundsCents: {
    source: "transactions",
    formula: "sum(refund event amountCents in period)",
    timeBasis: "event",
  },
  netSalesCents: {
    source: "transactions",
    formula: "grossSalesCents - refundsCents",
    timeBasis: "event",
  },
  ordersCreated: {
    source: "orders",
    formula: "count(distinct orderId where createdAt is in period)",
    timeBasis: "created",
  },
  paidOrders: {
    source: "transactions",
    formula: "count(distinct orderId with first capture event in period)",
    timeBasis: "event",
  },
  averageOrderValueCents: {
    source: "transactions",
    formula: "grossSalesCents / paidOrders; null when paidOrders is zero",
    timeBasis: "event",
  },
  uniquePayingCustomers: {
    source: "transactions",
    formula: "count(distinct customerId with a capture event in period)",
    timeBasis: "event",
  },
  registeredCustomers: {
    source: "customers",
    formula: "count(customerId where createdAt is in period; all later account states included)",
    timeBasis: "created",
  },
  publishedDishes: {
    source: "dishes",
    formula: "count(status = published and deletedAt = null at asOf)",
    timeBasis: "as-of",
  },
  publishedCategories: {
    source: "categories",
    formula: "count(status = published and deletedAt = null at asOf)",
    timeBasis: "as-of",
  },
  meaningfulDishViews: {
    source: "dish-views",
    formula:
      "count(accepted dish view facts in period after bot, engagement, and 6-hour deduplication)",
    timeBasis: "event",
  },
  bestCustomer: {
    source: "transactions",
    formula: "customer with greatest capture cents minus refund cents in period",
    timeBasis: "event",
  },
  topSellingDish: {
    source: "orders",
    formula: "dish with greatest completed units minus refunded units in period",
    timeBasis: "event",
  },
} as const satisfies Readonly<Record<DashboardMetricId, DashboardMetricDefinition>>);
