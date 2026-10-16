/** Public entry point for dashboard and reporting queries. */
export const MODULE_NAME = "analytics" as const;
export {
  getDashboardAggregation,
  type DashboardActor,
  type DashboardAggregationInput,
} from "./service/dashboard-aggregation";
export {
  resolveDashboardPeriods,
  type DashboardPeriodInput,
  type DashboardPeriod,
} from "./policy/dashboard-period";
export {
  DASHBOARD_CURRENCY,
  DASHBOARD_METRIC_DEFINITIONS,
  DASHBOARD_METRIC_IDS,
  DASHBOARD_ORDER_STATUS_GROUPS,
  DASHBOARD_TIME_ZONE,
  DASHBOARD_VIEW_DEDUPLICATION_HOURS,
  type DashboardMetricDefinition,
  type DashboardMetricId,
} from "./policy/dashboard-metrics";
