import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { hasAdminPermission } from "@/constants/admin-access";
import { isSupportedLocale } from "@/constants";
import { ErrorState } from "@/components/ui";
import { requireAdminPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { getCachedDashboardAggregation } from "@/server/modules/analytics";

import { DashboardOverview } from "./dashboard-overview";
import { resolveDashboardSelection } from "./dashboard-view-model";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPage("dashboard:view");
  const shell = await getTranslations("dashboard.shell");
  if (!hasAdminPermission({ role: admin.role, active: true }, "analytics:read")) {
    return (
      <Typography component="h1" variant="h2">
        {shell("previewTitle")}
      </Typography>
    );
  }
  const t = await getTranslations("dashboard.overview");
  const status = await getTranslations("dashboard.orderList.statuses");
  const requestedLocale = await getLocale();
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : "en";
  const selection = resolveDashboardSelection(await searchParams);
  if (!selection.valid) {
    return (
      <ErrorState
        title={t("invalidRangeTitle")}
        description={t("invalidRange")}
        action={
          <Button component={Link} href="/dashboard" variant="contained">
            {t("resetRange")}
          </Button>
        }
      />
    );
  }
  const snapshot = await getCachedDashboardAggregation(
    await connectToDatabase(),
    { id: admin.id, role: admin.role, active: true },
    { locale, startDate: selection.startDate, endDate: selection.endDate },
  );
  return (
    <DashboardOverview
      snapshot={snapshot}
      selection={selection}
      locale={locale}
      permissions={admin.permissions}
      labels={{
        heading: t("heading"),
        introduction: t("introduction"),
        dataAsOf: t("dataAsOf"),
        range: t("range"),
        day: t("day"),
        week: t("week"),
        month: t("month"),
        year: t("year"),
        custom: t("custom"),
        from: t("from"),
        to: t("to"),
        apply: t("apply"),
        sales: t("sales"),
        customers: t("customers"),
        orders: t("orders"),
        dishes: t("dishes"),
        changeUnavailable: t("changeUnavailable"),
        quickActions: t("quickActions"),
        newDish: t("newDish"),
        categories: t("categories"),
        ingredients: t("ingredients"),
        blogPost: t("blogPost"),
        customersLink: t("customersLink"),
        salesTrends: t("salesTrends"),
        grossSales: t("grossSales"),
        refunds: t("refunds"),
        netSales: t("netSales"),
        noSales: t("noSales"),
        recentOrders: t("recentOrders"),
        all: t("all"),
        awaiting: t("awaiting"),
        active: t("active"),
        completed: t("completed"),
        noOrders: t("noOrders"),
        viewOrder: t("viewOrder"),
        topSelling: t("topSelling"),
        mostVisited: t("mostVisited"),
        bestCustomers: t("bestCustomers"),
        recentActivity: t("recentActivity"),
        noDishes: t("noDishes"),
        noCustomers: t("noCustomers"),
        noActivity: t("noActivity"),
        viewsUnavailable: t("viewsUnavailable"),
        seeAll: t("seeAll"),
        salesSummary: t("salesSummary"),
        paidOrders: t("paidOrders"),
        averageOrder: t("averageOrder"),
        views: t("views"),
        orderStatuses: {
          pending_payment: status("pending_payment"),
          confirmed: status("confirmed"),
          preparing: status("preparing"),
          ready: status("ready"),
          out_for_delivery: status("out_for_delivery"),
          completed: status("completed"),
          payment_failed: status("payment_failed"),
          cancelled: status("cancelled"),
          expired: status("expired"),
          refunded: status("refunded"),
        },
      }}
    />
  );
}
