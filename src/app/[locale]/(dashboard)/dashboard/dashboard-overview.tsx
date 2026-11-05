import AddRounded from "@mui/icons-material/AddRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import CategoryRounded from "@mui/icons-material/CategoryRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import PeopleRounded from "@mui/icons-material/PeopleRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "@/components/ui/client-next-link";
import type { ReactNode } from "react";

import type { SupportedLocale } from "@/constants";
import { formatDate, formatDateTime, formatEuro, formatNumber } from "@/locales/formatters";
import type { getDashboardAggregation } from "@/server/modules/analytics";

import { compactSalesChart } from "./dashboard-chart";
import type { DashboardOrderTab, DashboardRange } from "./dashboard-view-model";

type Snapshot = Awaited<ReturnType<typeof getDashboardAggregation>>;
type Selection = Readonly<{
  range: DashboardRange;
  orderTab: DashboardOrderTab;
  startDate: string;
  endDate: string;
}>;

export type DashboardLabels = Readonly<{
  heading: string;
  introduction: string;
  dataAsOf: string;
  range: string;
  day: string;
  week: string;
  month: string;
  year: string;
  custom: string;
  from: string;
  to: string;
  apply: string;
  sales: string;
  customers: string;
  orders: string;
  dishes: string;
  changeUnavailable: string;
  quickActions: string;
  newDish: string;
  categories: string;
  ingredients: string;
  blogPost: string;
  customersLink: string;
  salesTrends: string;
  grossSales: string;
  refunds: string;
  netSales: string;
  noSales: string;
  noTopSelling: string;
  recentOrders: string;
  all: string;
  awaiting: string;
  active: string;
  completed: string;
  noOrders: string;
  viewOrder: string;
  topSelling: string;
  mostVisited: string;
  bestCustomers: string;
  recentActivity: string;
  noDishes: string;
  noCustomers: string;
  noActivity: string;
  viewsUnavailable: string;
  seeAll: string;
  salesSummary: string;
  paidOrders: string;
  averageOrder: string;
  views: string;
  unitsSold: string;
  orderStatuses: Readonly<Record<string, string>>;
}>;

const surfaceSx = {
  p: { xs: 2, sm: 2.5 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  boxShadow: "none",
} as const;

function signedEuro(cents: number, locale: SupportedLocale): string {
  return cents < 0 ? `−${formatEuro(Math.abs(cents), locale)}` : formatEuro(cents, locale);
}

function changeLabel(change: number | null, labels: DashboardLabels, locale: SupportedLocale) {
  return change === null
    ? labels.changeUnavailable
    : `${change > 0 ? "+" : ""}${formatPercent(change, locale)}`;
}

function formatPercent(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function percentageChange(current: number, previous: number): number | null {
  return previous === 0
    ? null
    : Math.round(((current - previous) / Math.abs(previous)) * 1_000) / 10;
}

function heading(id: string, title: string, action?: ReactNode) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}
    >
      <Typography id={id} component="h2" variant="h5" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {action}
    </Stack>
  );
}

function empty(message: string) {
  return (
    <Typography color="text.secondary" sx={{ py: 3 }}>
      {message}
    </Typography>
  );
}

function chartDateLabel(value: string, locale: SupportedLocale, monthly: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    ...(monthly ? { year: "2-digit" as const } : { day: "numeric" as const }),
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function tabHref(selection: Selection, tab: DashboardOrderTab): string {
  const params = new URLSearchParams({ range: selection.range, orders: tab });
  if (selection.range === "custom") {
    params.set("start", selection.startDate);
    params.set("end", selection.endDate);
  }
  return `/dashboard?${params}`;
}

export function DashboardOverview({
  snapshot,
  selection,
  locale,
  labels,
  permissions,
}: {
  snapshot: Snapshot;
  selection: Selection;
  locale: SupportedLocale;
  labels: DashboardLabels;
  permissions: readonly string[];
}) {
  const can = new Set(permissions);
  const chart = compactSalesChart(snapshot.salesChart);
  const maxGross = Math.max(1, ...chart.map((bucket) => bucket.grossCents));
  const soldUnits = snapshot.topSellingDishes.reduce((sum, dish) => sum + dish.netUnits, 0);
  const donutColors = [
    "var(--sara-palette-primary-main)",
    "var(--sara-palette-info-main)",
    "var(--sara-palette-warning-main)",
    "var(--sara-palette-success-main)",
    "var(--sara-palette-secondary-main)",
  ];
  const donutStops = snapshot.topSellingDishes.reduce<{ angle: number; stops: string[] }>(
    (result, dish, index) => {
      const end = result.angle + (soldUnits > 0 ? (dish.netUnits / soldUnits) * 360 : 0);
      return {
        angle: end,
        stops: [
          ...result.stops,
          `${donutColors[index % donutColors.length]} ${result.angle}deg ${end}deg`,
        ],
      };
    },
    { angle: 0, stops: [] },
  ).stops;
  const rangeDays =
    (Date.parse(`${selection.endDate}T00:00:00.000Z`) -
      Date.parse(`${selection.startDate}T00:00:00.000Z`)) /
    86_400_000;
  const monthlyChart = rangeDays > 93;
  const totalStatus = Object.values(snapshot.orderStatusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const tabs: Array<{ id: DashboardOrderTab; label: string; count: number }> = [
    { id: "all", label: labels.all, count: totalStatus },
    {
      id: "awaiting",
      label: labels.awaiting,
      count: snapshot.orderStatusCounts.awaitingPayment ?? 0,
    },
    { id: "active", label: labels.active, count: snapshot.orderStatusCounts.paidActive ?? 0 },
    { id: "completed", label: labels.completed, count: snapshot.orderStatusCounts.completed ?? 0 },
  ];
  const recentOrders = snapshot.recentOrders.filter((order) => {
    if (selection.orderTab === "all") return true;
    if (selection.orderTab === "awaiting") return order.status === "pending_payment";
    if (selection.orderTab === "completed") return order.status === "completed";
    return ["confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status);
  });
  const quickActions = [
    {
      label: labels.newDish,
      href: "/dashboard/dishes/modify",
      permission: "dishes:create",
      icon: <AddRounded />,
    },
    {
      label: labels.categories,
      href: "/dashboard/categories/modify",
      permission: "categories:create",
      icon: <CategoryRounded />,
    },
    {
      label: labels.ingredients,
      href: "/dashboard/ingredients",
      permission: "ingredients:create",
      icon: <LocalDiningRounded />,
    },
    {
      label: labels.blogPost,
      href: "/dashboard/blog/modify",
      permission: "blogs:create",
      icon: <ArticleRounded />,
    },
    {
      label: labels.customersLink,
      href: "/dashboard/customers",
      permission: "customers:read",
      icon: <PeopleRounded />,
    },
  ].filter((action) => can.has(action.permission));
  const cards = [
    {
      label: labels.sales,
      value: signedEuro(snapshot.totals.netSalesCents, locale),
      icon: <TrendingUpRounded />,
      change: snapshot.comparison.netSalesChangePercent,
    },
    {
      label: labels.customers,
      value: formatNumber(snapshot.totals.registeredCustomers, locale),
      icon: <PeopleRounded />,
      change: percentageChange(
        snapshot.totals.registeredCustomers,
        snapshot.comparison.registeredCustomers,
      ),
    },
    {
      label: labels.orders,
      value: formatNumber(snapshot.totals.ordersCreated, locale),
      icon: <ShoppingBagRounded />,
      change: percentageChange(snapshot.totals.ordersCreated, snapshot.comparison.ordersCreated),
    },
    {
      label: labels.dishes,
      value: formatNumber(snapshot.totals.publishedDishes, locale),
      icon: <LocalDiningRounded />,
      change: null,
    },
  ];

  return (
    <Box sx={{ pb: 6 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "start" }, gap: 2, mb: 3 }}
      >
        <Box>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
            {labels.heading}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {labels.introduction}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
            <time dateTime={selection.startDate}>
              {formatDate(new Date(`${selection.startDate}T12:00:00.000Z`), locale)}
            </time>
            {" – "}
            <time dateTime={selection.endDate}>
              {formatDate(new Date(`${selection.endDate}T12:00:00.000Z`), locale)}
            </time>
          </Typography>
          <Typography color="text.secondary" variant="caption" component="p" sx={{ mt: 1 }}>
            {labels.dataAsOf}:{" "}
            <time dateTime={snapshot.freshness.generatedAt}>
              {formatDateTime(new Date(snapshot.freshness.generatedAt), locale)}
            </time>
          </Typography>
        </Box>
        {can.has("dishes:create") && (
          <Button
            component={Link}
            href="/dashboard/dishes/modify"
            variant="contained"
            startIcon={<AddRounded />}
          >
            {labels.newDish}
          </Button>
        )}
      </Stack>

      <Paper component="section" aria-label={labels.range} sx={{ ...surfaceSx, mb: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{ gap: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
        >
          <Typography sx={{ fontWeight: 700 }}>{labels.range}</Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {(["day", "week", "month", "year"] as const).map((range) => (
              <Button
                key={range}
                component={Link}
                href={`/dashboard?range=${range}`}
                variant={selection.range === range ? "contained" : "outlined"}
                size="small"
                aria-current={selection.range === range ? "page" : undefined}
              >
                {labels[range]}
              </Button>
            ))}
          </Stack>
        </Stack>
        <Box
          component="form"
          action="/dashboard"
          method="get"
          sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mt: 2 }}
        >
          <input type="hidden" name="range" value="custom" />
          <TextField
            size="small"
            type="date"
            name="start"
            label={labels.from}
            defaultValue={selection.startDate}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: selection.endDate } }}
          />
          <TextField
            size="small"
            type="date"
            name="end"
            label={labels.to}
            defaultValue={selection.endDate}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button type="submit" variant={selection.range === "custom" ? "contained" : "outlined"}>
            {labels.apply}
          </Button>
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
          gap: 2.5,
          mb: 3,
        }}
      >
        {cards.map((card) => (
          <Paper key={card.label} sx={{ ...surfaceSx, minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                display: "inline-flex",
                p: 1,
                borderRadius: 2,
                bgcolor: "action.hover",
                color: "primary.main",
                mb: 1.5,
              }}
            >
              {card.icon}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {card.label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
              {card.value}
            </Typography>
            {card.label !== labels.dishes && (
              <Typography
                variant="caption"
                color={card.change !== null && card.change < 0 ? "error.main" : "success.main"}
              >
                {changeLabel(card.change, labels, locale)}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(12, minmax(0, 1fr))" },
          gap: { xs: 2, lg: 2.5 },
          alignItems: "start",
        }}
      >
        {quickActions.length > 0 && (
          <Paper
            component="section"
            aria-labelledby="dashboard-quick-actions"
            sx={{
              ...surfaceSx,
              minWidth: 0,
              gridColumn: { xs: "1 / -1", md: "span 6", lg: "span 8" },
            }}
          >
            {heading("dashboard-quick-actions", labels.quickActions)}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {quickActions.map((action) => (
                <Button
                  key={action.href}
                  component={Link}
                  href={action.href}
                  variant="outlined"
                  startIcon={action.icon}
                  sx={{ justifyContent: "flex-start" }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          </Paper>
        )}

        <Paper
          component="section"
          aria-labelledby="dashboard-top-selling"
          sx={{
            ...surfaceSx,
            minWidth: 0,
            gridColumn: { xs: "1 / -1", md: "span 6", lg: "span 4" },
          }}
        >
          {heading("dashboard-top-selling", labels.topSelling)}
          {snapshot.topSellingDishes.length === 0 ? (
            empty(labels.noTopSelling)
          ) : (
            <>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 1 }}>
                <Box
                  role="img"
                  aria-label={`${formatNumber(soldUnits, locale)} ${labels.unitsSold}`}
                  sx={{
                    width: 144,
                    height: 144,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    background: `conic-gradient(${donutStops.join(", ")})`,
                  }}
                >
                  <Box
                    sx={{
                      width: 112,
                      height: 112,
                      display: "grid",
                      alignContent: "center",
                      justifyItems: "center",
                      borderRadius: "50%",
                      bgcolor: "background.paper",
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {formatNumber(soldUnits, locale)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ textAlign: "center" }}
                    >
                      {labels.unitsSold}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Stack spacing={1.25}>
                {snapshot.topSellingDishes.map((dish, index) => {
                  const share = soldUnits > 0 ? (dish.netUnits / soldUnits) * 100 : 0;
                  return (
                    <Stack
                      key={dish.dishId}
                      direction="row"
                      sx={{ alignItems: "center", gap: 1, minWidth: 0 }}
                    >
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 9,
                          height: 9,
                          flexShrink: 0,
                          borderRadius: "50%",
                          bgcolor: donutColors[index % donutColors.length],
                        }}
                      />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {dish.name}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {formatNumber(dish.netUnits, locale)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ minWidth: 36, textAlign: "end" }}
                      >
                        {formatPercent(share, locale)}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </>
          )}
        </Paper>

        <Paper
          component="section"
          aria-labelledby="dashboard-sales-trends"
          sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 8" } }}
        >
          {heading("dashboard-sales-trends", labels.salesTrends)}
          {chart.every((bucket) => bucket.grossCents === 0) && (
            <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
              {labels.noSales}
            </Typography>
          )}
          <Box
            component="ul"
            aria-label={`${labels.salesTrends}: ${labels.grossSales}`}
            sx={{
              listStyle: "none",
              display: "flex",
              alignItems: "end",
              gap: { xs: 0.75, sm: 1.25 },
              height: { xs: 188, sm: 232 },
              p: 0,
              m: 0,
              overflowX: "auto",
            }}
          >
            {chart.map((bucket) => {
              const label =
                bucket.date === bucket.endDate
                  ? chartDateLabel(bucket.date, locale, monthlyChart)
                  : `${chartDateLabel(bucket.date, locale, monthlyChart)} – ${chartDateLabel(bucket.endDate, locale, monthlyChart)}`;
              return (
                <Box
                  component="li"
                  key={bucket.date}
                  sx={{
                    display: "flex",
                    flex: "1 0 32px",
                    minWidth: 32,
                    height: "100%",
                    flexDirection: "column",
                    justifyContent: "end",
                    textAlign: "center",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                      clip: "rect(0, 0, 0, 0)",
                    }}
                  >
                    {label}: {labels.grossSales} {formatEuro(bucket.grossCents, locale)},{" "}
                    {labels.refunds} {formatEuro(bucket.refundsCents, locale)}, {labels.netSales}{" "}
                    {signedEuro(bucket.netCents, locale)}
                  </Box>
                  <Box
                    aria-hidden="true"
                    sx={{
                      minHeight: 4,
                      height: `${Math.max(4, (bucket.grossCents / maxGross) * 156)}px`,
                      bgcolor: "primary.main",
                      borderRadius: "4px 4px 0 0",
                      opacity: bucket.grossCents > 0 ? 0.9 : 0.24,
                      transition: "height 180ms ease",
                    }}
                  />
                  <Typography
                    aria-hidden="true"
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, fontSize: "0.65rem", whiteSpace: "nowrap" }}
                  >
                    {chartDateLabel(bucket.date, locale, monthlyChart)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Paper
          component="section"
          aria-labelledby="dashboard-sales-summary"
          sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 4" } }}
        >
          {heading("dashboard-sales-summary", labels.salesSummary)}
          <Stack spacing={1.5}>
            {[
              [labels.grossSales, formatEuro(snapshot.totals.grossSalesCents, locale)],
              [labels.refunds, formatEuro(snapshot.totals.refundsCents, locale)],
              [labels.netSales, signedEuro(snapshot.totals.netSalesCents, locale)],
              [labels.paidOrders, formatNumber(snapshot.totals.paidOrders, locale)],
              [
                labels.averageOrder,
                snapshot.totals.averageOrderValueCents === null
                  ? "—"
                  : formatEuro(snapshot.totals.averageOrderValueCents, locale),
              ],
            ].map(([label, value]) => (
              <Stack key={label} direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                <Typography color="text.secondary">{label}</Typography>
                <Typography sx={{ fontWeight: 700, textAlign: "end" }}>{value}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        <Paper
          component="section"
          aria-labelledby="dashboard-recent-orders"
          sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 8" } }}
        >
          {heading(
            "dashboard-recent-orders",
            labels.recentOrders,
            can.has("orders:read") ? (
              <Button component={Link} href="/dashboard/orders" size="small">
                {labels.seeAll}
              </Button>
            ) : undefined,
          )}
          <Box
            component="nav"
            aria-label={labels.recentOrders}
            sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, mb: 1 }}
          >
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                aria-current={selection.orderTab === tab.id ? "page" : undefined}
                component={Link}
                href={tabHref(selection, tab.id)}
                size="small"
                variant={selection.orderTab === tab.id ? "contained" : "text"}
                sx={{ flexShrink: 0 }}
              >
                {tab.label} ({formatNumber(tab.count, locale)})
              </Button>
            ))}
          </Box>
          {recentOrders.length === 0 ? (
            empty(labels.noOrders)
          ) : (
            <Stack divider={<Divider flexItem />}>
              {recentOrders.map((order) => (
                <Stack
                  key={order.code}
                  direction={{ xs: "column", sm: "row" }}
                  sx={{
                    gap: 1,
                    alignItems: { sm: "center" },
                    justifyContent: "space-between",
                    py: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 100 }}>
                    <Typography sx={{ fontWeight: 700 }}>{order.code}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(order.createdAt, locale)}
                    </Typography>
                  </Box>
                  <Chip size="small" label={labels.orderStatuses[order.status] ?? order.status} />
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatEuro(order.totalCents, locale)}
                  </Typography>
                  {can.has("orders:read") && (
                    <Button
                      component={Link}
                      href={`/dashboard/orders/${encodeURIComponent(order.code)}`}
                      size="small"
                      aria-label={`${labels.viewOrder} ${order.code}`}
                    >
                      {labels.viewOrder}
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>

        {can.has("logs:read") && (
          <Paper
            component="section"
            aria-labelledby="dashboard-recent-activity"
            sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 4" } }}
          >
            {heading(
              "dashboard-recent-activity",
              labels.recentActivity,
              <Button component={Link} href="/dashboard/activity" size="small">
                {labels.seeAll}
              </Button>,
            )}
            {snapshot.recentActivity.length === 0 ? (
              empty(labels.noActivity)
            ) : (
              <Stack divider={<Divider flexItem />}>
                {snapshot.recentActivity.slice(0, 5).map((event) => (
                  <Box key={event.id} sx={{ py: 1.2 }}>
                    <Typography sx={{ fontWeight: 600 }}>{event.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(new Date(event.occurredAt), locale)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        )}

        <Paper
          component="section"
          aria-labelledby="dashboard-best-customers"
          sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 6" } }}
        >
          {heading("dashboard-best-customers", labels.bestCustomers)}
          {snapshot.bestCustomers.length === 0 ? (
            empty(labels.noCustomers)
          ) : (
            <Stack spacing={1.5}>
              {snapshot.bestCustomers.map((customer, index) => (
                <Stack
                  key={customer.customerId}
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 1 }}
                >
                  <Typography>
                    {formatNumber(index + 1, locale)}. {customer.displayName ?? labels.customers}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {signedEuro(customer.netCents, locale)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper
          component="section"
          aria-labelledby="dashboard-most-visited"
          sx={{ ...surfaceSx, minWidth: 0, gridColumn: { xs: "1 / -1", md: "span 6" } }}
        >
          {heading("dashboard-most-visited", labels.mostVisited)}
          {snapshot.mostVisitedDishes.items.length === 0 ? (
            empty(labels.noDishes)
          ) : (
            <Stack spacing={1.5}>
              {snapshot.mostVisitedDishes.items.map((dish, index) => (
                <Stack
                  key={dish.dishId}
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 1 }}
                >
                  <Typography>
                    {formatNumber(index + 1, locale)}. {dish.name}
                  </Typography>
                  <Typography color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {formatNumber(dish.views, locale)} {labels.views}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          {!snapshot.freshness.viewPeriodComplete && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
              {labels.viewsUnavailable}
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
