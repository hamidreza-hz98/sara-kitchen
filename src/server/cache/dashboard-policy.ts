/** Private dashboard aggregates are shared only between identical permission projections. */
export const DASHBOARD_CACHE_TAG = "sk:v1:analytics:dashboard";
export const DASHBOARD_REVALIDATE_SECONDS = 30;

export function dashboardProjectionKey(capabilities: {
  activity: boolean;
  customerNames: boolean;
  orders: boolean;
  dishes: boolean;
}): string {
  return [
    capabilities.activity,
    capabilities.customerNames,
    capabilities.orders,
    capabilities.dishes,
  ]
    .map(Number)
    .join("");
}
