import "server-only";

import type { Connection } from "mongoose";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";
import { isSupportedLocale, type SupportedLocale } from "@/constants";
import type { OrderStatus } from "@/server/modules/orders";
import { countPublishedDashboardCategories } from "@/server/modules/categories";
import { readDashboardCustomers } from "@/server/modules/customers";
import { readDashboardDishes } from "@/server/modules/dishes";
import { readDashboardActivity } from "@/server/modules/logs";
import { countDashboardOrdersCreated, readDashboardOrders } from "@/server/modules/orders";
import { readDashboardFinance } from "@/server/modules/transactions";

import { DASHBOARD_CURRENCY, DASHBOARD_ORDER_STATUS_GROUPS } from "../policy/dashboard-metrics";
import { resolveDashboardPeriods, type DashboardPeriodInput } from "../policy/dashboard-period";

export type DashboardActor = Readonly<{ id: string; role: AdminRole; active: boolean }>;
export type DashboardAggregationInput = DashboardPeriodInput &
  Readonly<{ locale?: SupportedLocale }>;

function comparisonChange(current: number, previous: number): number | null {
  return previous === 0
    ? null
    : Math.round(((current - previous) / Math.abs(previous)) * 1_000) / 10;
}

function allDays(startDate: string, days: number): string[] {
  const start = new Date(`${startDate}T12:00:00.000Z`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

/** Permission checked, bounded read projection for the protected overview. */
export async function getDashboardAggregation(
  connection: Connection,
  actor: DashboardActor,
  input: DashboardAggregationInput = {},
) {
  if (
    !hasAdminPermission(actor, "dashboard:view") ||
    !hasAdminPermission(actor, "analytics:read")
  ) {
    throw new Error("Dashboard analytics access denied.");
  }
  const range = resolveDashboardPeriods(input);
  const locale = input.locale ?? "en";
  if (!isSupportedLocale(locale)) throw new RangeError("Unsupported dashboard locale.");
  const [finance, previousFinance, orders, previousOrders, dishes, categories, activity] =
    await Promise.all([
      readDashboardFinance(connection, range.period, range.timeZone),
      readDashboardFinance(connection, range.comparisonPeriod, range.timeZone),
      readDashboardOrders(connection, range.period),
      countDashboardOrdersCreated(connection, range.comparisonPeriod),
      readDashboardDishes(connection, range.period, range.asOf, locale),
      countPublishedDashboardCategories(connection),
      hasAdminPermission(actor, "logs:read")
        ? readDashboardActivity(connection)
        : Promise.resolve([]),
    ]);
  const eligibleCustomers = finance.customers
    .filter((customer) => customer.netCents > 0)
    .slice(0, 5);
  const [customer, previousCustomer] = await Promise.all([
    readDashboardCustomers(
      connection,
      range.period,
      eligibleCustomers.map((item) => item.customerId),
      hasAdminPermission(actor, "customers:read-sensitive"),
    ),
    readDashboardCustomers(connection, range.comparisonPeriod, [], false),
  ]);
  const bucketMap = new Map(finance.buckets.map((bucket) => [bucket.date, bucket]));
  const daily = allDays(range.startDate, range.days).map((date) => {
    const bucket = bucketMap.get(date);
    const grossCents = bucket?.grossCents ?? 0;
    const refundsCents = bucket?.refundsCents ?? 0;
    return { date, grossCents, refundsCents, netCents: grossCents - refundsCents };
  });
  const monthly = new Map<string, { grossCents: number; refundsCents: number; netCents: number }>();
  if (range.days > 93)
    for (const bucket of daily) {
      const key = bucket.date.slice(0, 7);
      const current = monthly.get(key) ?? { grossCents: 0, refundsCents: 0, netCents: 0 };
      current.grossCents += bucket.grossCents;
      current.refundsCents += bucket.refundsCents;
      current.netCents += bucket.netCents;
      monthly.set(key, current);
    }
  const statusGroups = Object.fromEntries(
    Object.entries(DASHBOARD_ORDER_STATUS_GROUPS).map(([group, statuses]) => [
      group,
      statuses.reduce((sum, status) => sum + orders.statusCounts[status as OrderStatus], 0),
    ]),
  );
  const bestCustomers = eligibleCustomers.map((item) => ({
    ...item,
    displayName: customer.names.get(item.customerId) ?? null,
  }));
  const netCents = finance.grossCents - finance.refundsCents;
  const previousNetCents = previousFinance.grossCents - previousFinance.refundsCents;
  return {
    asOf: range.asOf.toISOString(),
    period: { start: range.period.start.toISOString(), end: range.period.end.toISOString() },
    comparisonPeriod: {
      start: range.comparisonPeriod.start.toISOString(),
      end: range.comparisonPeriod.end.toISOString(),
    },
    timeZone: range.timeZone,
    currency: DASHBOARD_CURRENCY,
    freshness: {
      generatedAt: new Date().toISOString(),
      viewPeriodComplete: dishes.meaningfulViews !== null,
    },
    totals: {
      grossSalesCents: finance.grossCents,
      refundsCents: finance.refundsCents,
      netSalesCents: netCents,
      paidOrders: finance.paidOrders,
      averageOrderValueCents:
        finance.paidOrders === 0 ? null : Math.round(finance.grossCents / finance.paidOrders),
      ordersCreated: orders.ordersCreated,
      uniquePayingCustomers: finance.uniquePayingCustomers,
      registeredCustomers: customer.registered,
      publishedDishes: dishes.published,
      publishedCategories: categories,
      meaningfulDishViews: dishes.meaningfulViews,
    },
    comparison: {
      grossSalesCents: previousFinance.grossCents,
      refundsCents: previousFinance.refundsCents,
      netSalesCents: previousNetCents,
      paidOrders: previousFinance.paidOrders,
      ordersCreated: previousOrders,
      uniquePayingCustomers: previousFinance.uniquePayingCustomers,
      registeredCustomers: previousCustomer.registered,
      netSalesChangePercent: comparisonChange(netCents, previousNetCents),
    },
    salesChart: range.days > 93 ? [...monthly].map(([date, value]) => ({ date, ...value })) : daily,
    orderStatusCounts: statusGroups,
    mostVisitedDishes: { scope: "lifetime" as const, items: dishes.mostVisitedLifetime },
    topSellingDishes: orders.topSelling,
    bestCustomers,
    bestCustomer: bestCustomers[0] ?? null,
    topSellingDish: orders.topSelling[0] ?? null,
    recentOrders: orders.recent,
    recentActivity: activity,
    shortcuts: [
      {
        key: "pending_orders",
        href: "/dashboard/orders?status=pending_payment",
        count: orders.statusCounts.pending_payment,
      },
      {
        key: "active_orders",
        href: "/dashboard/orders?status=confirmed",
        count: statusGroups.paidActive,
      },
      { key: "catalog", href: "/dashboard/dishes", count: dishes.published },
    ].filter((shortcut) =>
      shortcut.key === "catalog"
        ? hasAdminPermission(actor, "dishes:read")
        : hasAdminPermission(actor, "orders:read"),
    ),
  };
}
