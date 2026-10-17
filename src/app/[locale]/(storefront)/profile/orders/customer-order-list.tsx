"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useTranslations } from "next-intl";

import { AppPagination, EmptyState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { ORDER_STATUSES, type OrderStatus } from "@/constants/order-status";
import { formatDate, formatEuro, formatNumber } from "@/locales";
import { useRouter } from "@/locales/navigation";
import type { CustomerOrderListResult, CustomerOrderTab } from "@/types/customer-order";

type Props = Readonly<{
  locale: SupportedLocale;
  page: CustomerOrderListResult;
  tab: CustomerOrderTab;
  status: OrderStatus | null;
}>;

function listUrl(tab: CustomerOrderTab, status: OrderStatus | null, page: number): string {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/profile/orders${suffix ? `?${suffix}` : ""}`;
}

export function CustomerOrderList({ locale, page, tab, status }: Props) {
  const t = useTranslations("profile.orderList");
  const statusT = useTranslations("profile.summary.status");
  const router = useRouter();
  const tabs: readonly CustomerOrderTab[] = ["all", "active", "completed", "closed"];
  return (
    <Stack spacing={3} sx={{ maxWidth: 980 }}>
      <Box>
        <Typography component="h1" variant="h2">
          {t("title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("intro")}
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs
          aria-label={t("tabsLabel")}
          onChange={(_event, value: CustomerOrderTab) => router.push(listUrl(value, null, 1))}
          scrollButtons="auto"
          value={tab}
          variant="scrollable"
        >
          {tabs.map((value) => (
            <Tab
              key={value}
              label={`${t(`tab.${value}`)} (${formatNumber(page.counts[value], locale)})`}
              value={value}
            />
          ))}
        </Tabs>
      </Paper>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <TextField
          label={t("statusFilter")}
          onChange={(event) =>
            router.push(
              listUrl("all", event.target.value ? (event.target.value as OrderStatus) : null, 1),
            )
          }
          select
          size="small"
          sx={{ minWidth: 230 }}
          value={status ?? ""}
        >
          <MenuItem value="">{t("allStatuses")}</MenuItem>
          {ORDER_STATUSES.map((value) => (
            <MenuItem key={value} value={value}>
              {statusT(value)}
            </MenuItem>
          ))}
        </TextField>
        <Typography color="text.secondary" variant="body2">
          {t("resultCount", { count: page.total })}
        </Typography>
      </Box>
      {page.page > page.totalPages && <Alert severity="info">{t("pageOutOfRange")}</Alert>}
      {page.items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button component={NextLink} href="/menu" variant="contained">
              {t("browseMenu")}
            </Button>
          }
        />
      ) : (
        <Stack component="ol" spacing={2} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {page.items.map((order) => (
            <Paper
              component="li"
              key={order.code}
              variant="outlined"
              sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1 }}
                >
                  <Box>
                    <Typography component="h2" variant="h6">
                      {t.rich("orderCode", {
                        code: order.code,
                        bidi: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
                      })}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      {formatDate(new Date(order.createdAt), locale)}
                    </Typography>
                  </Box>
                  <Chip
                    label={statusT(order.status)}
                    color={
                      order.status === "completed"
                        ? "success"
                        : order.status === "cancelled" || order.status === "payment_failed"
                          ? "warning"
                          : "default"
                    }
                    size="small"
                  />
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {order.items
                    .slice(0, 2)
                    .map((item) => `${item.quantity} × ${item.name}`)
                    .join(" · ")}
                  {order.items.length > 2
                    ? ` ${t("moreItems", { count: order.items.length - 2 })}`
                    : ""}
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1 }}
                >
                  <Typography>
                    {t(order.fulfillmentMethod)} · {t("itemCount", { count: order.itemCount })}
                  </Typography>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {formatEuro(order.totalCents, locale)}
                    </Typography>
                    <Button
                      aria-label={t("viewNamed", { code: order.code })}
                      component={NextLink}
                      href={`/profile/orders/${encodeURIComponent(order.code)}`}
                      size="small"
                      variant="outlined"
                    >
                      {t("viewDetails")}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      {page.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <AppPagination
            count={page.totalPages}
            label={t("paginationLabel")}
            onChange={(_event, value) => router.push(listUrl(tab, status, value))}
            page={page.page}
          />
        </Box>
      )}
    </Stack>
  );
}
