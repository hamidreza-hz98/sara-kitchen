"use client";

import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { AppDrawer, AppPagination, EmptyState, ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { formatDateTime, formatEuro, formatNumber } from "@/locales/formatters";
import { usePathname, useRouter } from "@/locales/navigation";

const STATUSES = [
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "payment_failed",
  "cancelled",
  "expired",
  "refunded",
] as const;
const PAYMENTS = [
  "created",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "partially-refunded",
  "refunded",
] as const;
type Status = (typeof STATUSES)[number];
type Payment = (typeof PAYMENTS)[number];
type Order = Readonly<{
  id: string;
  code: string;
  status: Status;
  revision: number;
  customer: Readonly<{ firstName: string; lastName: string; mobile: string }> | null;
  items: readonly Readonly<{ name: string; quantity: number; lineSubtotalCents: number }>[];
  pricing: Readonly<{ totalCents: number; subtotalCents: number; deliveryFeeCents: number }>;
  fulfillment: Readonly<{ method: "pickup" | "delivery" }>;
  statusHistory: readonly Readonly<{ paymentStatus: Payment }>[];
  createdAt: string;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type Summary = Readonly<{
  statusCounts: Record<Status, number>;
  allCount: number;
  allAmountCents: number;
}>;
type Envelope = Readonly<{
  data?: readonly Order[];
  meta?: Readonly<{ pagination?: Pagination; summary?: Summary }>;
}>;
type Capabilities = Readonly<{ readSensitive: boolean; update: boolean; cancel: boolean }>;
type Sort =
  | "createdAt:desc"
  | "createdAt:asc"
  | "code:asc"
  | "code:desc"
  | "totalCents:asc"
  | "totalCents:desc";

const PAGE_SIZES = [10, 20, 50] as const;
const SORTS: readonly Sort[] = [
  "createdAt:desc",
  "createdAt:asc",
  "code:asc",
  "code:desc",
  "totalCents:asc",
  "totalCents:desc",
];
const NEXT: Partial<Record<Status, Status>> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "completed",
};

function statusColor(status: Status): "default" | "success" | "error" | "warning" | "info" {
  if (status === "completed" || status === "confirmed") return "success";
  if (status === "cancelled" || status === "payment_failed") return "error";
  if (status === "pending_payment" || status === "expired") return "warning";
  if (status === "refunded") return "info";
  return "default";
}

export function OrderList({ capabilities }: { capabilities: Capabilities }) {
  const t = useTranslations("dashboard.orderList");
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(rawQuery), [rawQuery]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as 10 | 20 | 50)
    ? Number(query.get("pageSize"))
    : 20;
  const status = STATUSES.includes(query.get("status") as Status)
    ? (query.get("status") as Status)
    : "";
  const payment = PAYMENTS.includes(query.get("paymentStatus") as Payment)
    ? (query.get("paymentStatus") as Payment)
    : "";
  const searchMode =
    capabilities.readSensitive && ["customer", "mobile"].includes(query.get("searchMode") ?? "")
      ? (query.get("searchMode") as "customer" | "mobile")
      : "code";
  const search = query.get("search") ?? "";
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const sort = SORTS.includes(query.get("sort") as Sort)
    ? (query.get("sort") as Sort)
    : "createdAt:desc";
  const selectedCode = query.get("order");
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<Order | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuOrder, setMenuOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [mutating, setMutating] = useState(false);

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (Object.keys(patch).some((key) => key !== "order")) setLoading(true);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, rawQuery, router],
  );

  useEffect(() => {
    const value = searchDraft?.trim();
    if (value === undefined || value === search || (value.length > 0 && value.length < 2)) return;
    const timer = window.setTimeout(() => {
      setSearchDraft(null);
      replaceQuery({ search: value || null, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [replaceQuery, search, searchDraft]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      searchMode,
      sortBy: sort.split(":")[0]!,
      sortDirection: sort.split(":")[1]!,
    });
    if (status) params.set("status", status);
    if (payment) params.set("paymentStatus", payment);
    if (search.length >= 2) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/orders?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("orders_list_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination || !body.meta.summary)
          throw new Error("invalid_orders_list");
        setItems(body.data);
        setPagination(body.meta.pagination);
        setSummary(body.meta.summary);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, status, payment, search, searchMode, from, to, sort, reload]);

  useEffect(() => {
    if (!selectedCode) return;
    const visible = items.find((item) => item.code === selectedCode);
    if (visible) return;
    const controller = new AbortController();
    fetch(`/api/orders/${encodeURIComponent(selectedCode)}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("order_detail_failed");
        return (await response.json()) as Readonly<{ data?: Order }>;
      })
      .then((body) => setDetail(body.data ?? null))
      .catch(() => {
        if (!controller.signal.aborted)
          feedback.notify({ message: t("actionError"), severity: "error" });
      });
    return () => controller.abort();
  }, [selectedCode, items, feedback, t]);

  const activeDetail =
    items.find((item) => item.code === selectedCode) ??
    (detail?.code === selectedCode ? detail : null);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuOrder(null);
  };
  const mutate = async (order: Order, next: Status) => {
    setMutating(true);
    closeMenu();
    try {
      const path = next === "cancelled" ? "cancel" : "status";
      const response = await fetch(`/api/orders/${encodeURIComponent(order.code)}/${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify({
          expectedRevision: order.revision,
          ...(next === "cancelled"
            ? { reasonCode: "admin_cancelled" }
            : { status: next, reasonCode: null }),
        }),
      });
      if (!response.ok) throw new Error("order_mutation_failed");
      feedback.notify({ message: t("actionSuccess"), severity: "success" });
      setReload((value) => value + 1);
      setDetail(null);
      setCancelOrder(null);
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const customerName = (order: Order) =>
    order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : t("unknown");
  const paymentOf = (order: Order) => order.statusHistory.at(-1)?.paymentStatus ?? "created";
  const nextStatus =
    menuOrder?.status === "ready" && menuOrder.fulfillment.method === "pickup"
      ? "completed"
      : menuOrder
        ? NEXT[menuOrder.status]
        : undefined;
  const resetFilters = () =>
    replaceQuery({
      status: null,
      paymentStatus: null,
      search: null,
      searchMode: null,
      from: null,
      to: null,
      sort: null,
      page: 1,
    });

  return (
    <Stack spacing={5} sx={{ pb: 8 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ gap: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Box>
          <Typography component="h1" variant="h3">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">{t("subtitle")}</Typography>
        </Box>
        <Button startIcon={<RefreshRounded />} onClick={() => setReload((value) => value + 1)}>
          {t("refresh")}
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Paper sx={{ p: 3, flex: 1, border: "1px solid", borderColor: "divider" }}>
          <Typography color="text.secondary" variant="body2">
            {t("all")}
          </Typography>
          <Typography variant="h4">{formatNumber(summary?.allCount ?? 0, locale)}</Typography>
        </Paper>
        <Paper sx={{ p: 3, flex: 1, border: "1px solid", borderColor: "divider" }}>
          <Typography color="text.secondary" variant="body2">
            {t("totalValue")}
          </Typography>
          <Typography variant="h4">{formatEuro(summary?.allAmountCents ?? 0, locale)}</Typography>
        </Paper>
      </Stack>

      <Paper sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Tabs
          value={status || "all"}
          onChange={(_event, value: string) =>
            replaceQuery({ status: value === "all" ? null : value, page: 1 })
          }
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("status")}
          sx={{ px: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab
            value="all"
            label={`${t("all")} (${formatNumber(summary?.allCount ?? 0, locale)})`}
          />
          {STATUSES.map((entry) => (
            <Tab
              key={entry}
              value={entry}
              label={`${t(`statuses.${entry}`)} (${formatNumber(summary?.statusCounts[entry] ?? 0, locale)})`}
            />
          ))}
        </Tabs>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ p: 3, flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 135 }}>
            <InputLabel id="order-search-mode">{t("searchMode")}</InputLabel>
            <Select
              labelId="order-search-mode"
              label={t("searchMode")}
              value={searchMode}
              onChange={(event) =>
                replaceQuery({ searchMode: event.target.value, search: null, page: 1 })
              }
            >
              <MenuItem value="code">{t("code")}</MenuItem>
              {capabilities.readSensitive ? (
                <MenuItem value="customer">{t("customer")}</MenuItem>
              ) : null}
              {capabilities.readSensitive ? (
                <MenuItem value="mobile">{t("mobile")}</MenuItem>
              ) : null}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t("search")}
            value={searchDraft ?? search}
            onChange={(event) => setSearchDraft(event.target.value)}
            slotProps={{
              input: { startAdornment: <SearchRounded sx={{ mr: 1, color: "text.secondary" }} /> },
            }}
            sx={{ minWidth: { xs: "100%", md: 210 }, flex: 1 }}
          />
          <TextField
            size="small"
            type="date"
            label={t("from")}
            value={from}
            onChange={(event) => replaceQuery({ from: event.target.value || null, page: 1 })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            type="date"
            label={t("to")}
            value={to}
            onChange={(event) => replaceQuery({ to: event.target.value || null, page: 1 })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl size="small" sx={{ minWidth: 155 }}>
            <InputLabel id="order-payment-filter">{t("payment")}</InputLabel>
            <Select
              labelId="order-payment-filter"
              label={t("payment")}
              value={payment}
              onChange={(event) =>
                replaceQuery({ paymentStatus: event.target.value || null, page: 1 })
              }
            >
              <MenuItem value="">{t("allPayments")}</MenuItem>
              {PAYMENTS.map((entry) => (
                <MenuItem key={entry} value={entry}>
                  {t(`payments.${entry}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 155 }}>
            <InputLabel id="order-sort">{t("sort")}</InputLabel>
            <Select
              labelId="order-sort"
              label={t("sort")}
              value={sort}
              onChange={(event) => replaceQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((entry) => (
                <MenuItem key={entry} value={entry}>
                  {t(
                    (
                      {
                        "createdAt:desc": "newest",
                        "createdAt:asc": "oldest",
                        "code:asc": "codeAsc",
                        "code:desc": "codeDesc",
                        "totalCents:asc": "amountAsc",
                        "totalCents:desc": "amountDesc",
                      } as const
                    )[entry],
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={resetFilters}>{t("clear")}</Button>
        </Stack>
      </Paper>

      {error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={<Button onClick={() => setReload((value) => value + 1)}>{t("retry")}</Button>}
        />
      ) : loading ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} height={55} />
            ))}
          </Stack>
        </Paper>
      ) : items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={<Button onClick={resetFilters}>{t("clear")}</Button>}
        />
      ) : (
        <>
          <Typography color="text.secondary" variant="body2">
            {t("results", { count: pagination.totalItems })}
          </Typography>
          <TableContainer
            component={Paper}
            sx={{
              display: { xs: "none", md: "block" },
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("order")}</TableCell>
                  {capabilities.readSensitive ? <TableCell>{t("customerColumn")}</TableCell> : null}
                  <TableCell>{t("items")}</TableCell>
                  <TableCell>{t("amount")}</TableCell>
                  <TableCell>{t("payment")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("date")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Button
                        onClick={() => replaceQuery({ order: order.code })}
                        sx={{ fontWeight: 700, p: 0, minWidth: 0 }}
                      >
                        {order.code}
                      </Button>
                    </TableCell>
                    {capabilities.readSensitive ? (
                      <TableCell>{customerName(order)}</TableCell>
                    ) : null}
                    <TableCell>
                      {order.items
                        .slice(0, 2)
                        .map((item) => item.name)
                        .join(", ")}
                      {order.items.length > 2 ? ` +${order.items.length - 2}` : ""}
                    </TableCell>
                    <TableCell>{formatEuro(order.pricing.totalCents, locale)}</TableCell>
                    <TableCell>{t(`payments.${paymentOf(order)}`)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={statusColor(order.status)}
                        label={t(`statuses.${order.status}`)}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(new Date(order.createdAt), locale)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        aria-label={`${t("actions")}: ${order.code}`}
                        onClick={(event) => {
                          setMenuAnchor(event.currentTarget);
                          setMenuOrder(order);
                        }}
                      >
                        <MoreHorizRounded />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", md: "none" } }} spacing={2}>
            {items.map((order) => (
              <Paper key={order.id} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <Button onClick={() => replaceQuery({ order: order.code })}>{order.code}</Button>
                  <Chip
                    size="small"
                    color={statusColor(order.status)}
                    label={t(`statuses.${order.status}`)}
                  />
                </Stack>
                {capabilities.readSensitive ? (
                  <Typography variant="body2">{customerName(order)}</Typography>
                ) : null}
                <Typography color="text.secondary" variant="body2">
                  {order.items.map((item) => item.name).join(", ")}
                </Typography>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatEuro(order.pricing.totalCents, locale)}
                  </Typography>
                  <IconButton
                    aria-label={`${t("actions")}: ${order.code}`}
                    onClick={(event) => {
                      setMenuAnchor(event.currentTarget);
                      setMenuOrder(order);
                    }}
                  >
                    <MoreHorizRounded />
                  </IconButton>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {!error && pagination.totalPages > 0 ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <FormControl size="small" sx={{ minWidth: 125 }}>
            <InputLabel id="order-page-size">{t("perPage")}</InputLabel>
            <Select
              labelId="order-page-size"
              label={t("perPage")}
              value={pageSize}
              onChange={(event) => replaceQuery({ pageSize: Number(event.target.value), page: 1 })}
            >
              {PAGE_SIZES.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <AppPagination
            label={t("pages")}
            count={pagination.totalPages}
            page={Math.min(page, pagination.totalPages)}
            onChange={(_event, value) => replaceQuery({ page: value })}
          />
        </Stack>
      ) : null}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor && menuOrder)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuOrder) replaceQuery({ order: menuOrder.code });
            closeMenu();
          }}
        >
          {t("view")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuOrder) router.push(`${pathname}/${encodeURIComponent(menuOrder.code)}`);
            closeMenu();
          }}
        >
          {t("fullDetails")}
        </MenuItem>
        {capabilities.update && nextStatus ? (
          <MenuItem
            disabled={mutating}
            onClick={() => {
              if (menuOrder) mutate(menuOrder, nextStatus).catch(() => undefined);
            }}
          >
            {t(`statuses.${nextStatus}`)}
          </MenuItem>
        ) : null}
        {capabilities.cancel &&
        menuOrder &&
        ["pending_payment", "confirmed", "preparing", "ready", "out_for_delivery"].includes(
          menuOrder.status,
        ) ? (
          <MenuItem
            disabled={mutating}
            onClick={() => {
              setCancelOrder(menuOrder);
              closeMenu();
            }}
          >
            {t("cancel")}
          </MenuItem>
        ) : null}
      </Menu>
      <AppDrawer
        open={Boolean(selectedCode)}
        onClose={() => replaceQuery({ order: null })}
        closeLabel={t("close")}
        title={t("details")}
        description={selectedCode ?? undefined}
      >
        <Stack spacing={3} sx={{ mt: 4 }}>
          {activeDetail ? (
            <>
              <Chip
                sx={{ alignSelf: "flex-start" }}
                color={statusColor(activeDetail.status)}
                label={t(`statuses.${activeDetail.status}`)}
              />
              <Typography>
                {t("payment")}: {t(`payments.${paymentOf(activeDetail)}`)}
              </Typography>
              {capabilities.readSensitive ? (
                <Typography>{customerName(activeDetail)}</Typography>
              ) : null}
              <Typography>
                {activeDetail.fulfillment.method === "pickup" ? t("pickup") : t("delivery")}
              </Typography>
              {activeDetail.items.map((item, index) => (
                <Stack
                  key={`${index}-${item.name}`}
                  direction="row"
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography>
                    {item.quantity} × {item.name}
                  </Typography>
                  <Typography>{formatEuro(item.lineSubtotalCents, locale)}</Typography>
                </Stack>
              ))}
              <Typography sx={{ fontWeight: 700 }}>
                {t("amount")}: {formatEuro(activeDetail.pricing.totalCents, locale)}
              </Typography>
              <Button
                onClick={() => router.push(`${pathname}/${encodeURIComponent(activeDetail.code)}`)}
              >
                {t("fullDetails")}
              </Button>
            </>
          ) : (
            <Skeleton height={160} />
          )}
        </Stack>
      </AppDrawer>
      <ConfirmationDialog
        open={Boolean(cancelOrder)}
        onCancel={() => setCancelOrder(null)}
        onConfirm={() => {
          if (cancelOrder) mutate(cancelOrder, "cancelled").catch(() => undefined);
        }}
        closeLabel={t("close")}
        cancelLabel={t("back")}
        confirmLabel={t("confirm")}
        title={t("confirmCancel")}
        description={t("cancelDescription")}
        loading={mutating}
        danger
      />
    </Stack>
  );
}
