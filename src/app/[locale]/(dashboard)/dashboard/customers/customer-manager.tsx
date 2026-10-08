"use client";

import BlockRounded from "@mui/icons-material/BlockRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
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
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { AppDrawer, AppPagination, EmptyState, ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { formatDateTime, formatEuro } from "@/locales/formatters";
import { Link, usePathname, useRouter } from "@/locales/navigation";

type CustomerStatus = "active" | "disabled" | "anonymized";
type Summary = Readonly<{
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}>;
type Customer = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  email: string | null;
  mobileVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  marketingConsent: boolean;
  termsAcceptedAt: string | null;
  status: CustomerStatus;
  privacyRetentionReason: "historical_orders" | "privacy_request" | null;
  createdAt: string;
  updatedAt: string;
  summary: Summary;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type Envelope = Readonly<{
  data?: readonly Customer[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type Capabilities = Readonly<{ readSensitive: boolean; update: boolean; delete: boolean }>;
type ConfirmAction = Readonly<{ kind: "disable" | "anonymize"; customer: Customer }>;

const PAGE_SIZES = [10, 20, 50] as const;
const STATUSES = ["active", "disabled", "anonymized"] as const;
const SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "firstName:asc",
  "lastName:asc",
  "updatedAt:desc",
] as const;
const SORT_LABELS = {
  "createdAt:desc": "sorts.createdAt_desc",
  "createdAt:asc": "sorts.createdAt_asc",
  "firstName:asc": "sorts.firstName_asc",
  "lastName:asc": "sorts.lastName_asc",
  "updatedAt:desc": "sorts.updatedAt_desc",
} as const;

export function CustomerManager({ capabilities }: { capabilities: Capabilities }) {
  const t = useTranslations("dashboard.customers");
  const locale = useLocale() as SupportedLocale;
  const feedback = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(rawQuery), [rawQuery]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as 10 | 20 | 50)
    ? Number(query.get("pageSize"))
    : 20;
  const status = STATUSES.includes(query.get("status") as CustomerStatus)
    ? (query.get("status") ?? "")
    : "";
  const sort = SORTS.includes(query.get("sort") as (typeof SORTS)[number])
    ? (query.get("sort") ?? SORTS[0])
    : SORTS[0];
  const search = query.get("search") ?? "";
  const selectedId = query.get("customer");
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [mutating, setMutating] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuCustomer, setMenuCustomer] = useState<Customer | null>(null);
  const draftSearch = searchDraft ?? search;
  const activeSelected =
    (selected?.id === selectedId ? selected : null) ?? items.find((item) => item.id === selectedId);

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      setLoading(true);
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
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.length >= 2) params.set("search", search);
    if (status) params.set("status", status);
    const [sortBy, sortDirection] = sort.split(":");
    params.set("sortBy", sortBy ?? "createdAt");
    params.set("sortDirection", sortDirection ?? "desc");
    fetch(`/api/customers?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("customer_list_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_customer_list");
        setItems(body.data);
        setPagination(body.meta.pagination);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, reload, search, sort, status]);

  useEffect(() => {
    if (!selectedId || items.some((item) => item.id === selectedId)) return;
    const controller = new AbortController();
    fetch(`/api/customers/${selectedId}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("customer_detail_failed");
        return (await response.json()) as Readonly<{ data?: Customer }>;
      })
      .then((body) => setSelected(body.data ?? null))
      .catch(() => {
        if (!controller.signal.aborted)
          feedback.notify({ message: t("detailError"), severity: "error" });
      })
      .finally(() => undefined);
    return () => controller.abort();
  }, [feedback, items, selectedId, t]);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuCustomer(null);
  };
  const mutate = async (path: string, method: "POST" | "DELETE", body: unknown) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: await csrfJsonHeaders("admin"),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(String(response.status));
  };
  const setCustomerStatus = async (customer: Customer, nextStatus: "active" | "disabled") => {
    setMutating(true);
    try {
      await mutate(`/api/customers/${customer.id}/status`, "POST", { status: nextStatus });
      feedback.notify({ message: t(`${nextStatus}Success`), severity: "success" });
      setReload((value) => value + 1);
      setSelected((value) =>
        value?.id === customer.id ? { ...value, status: nextStatus } : value,
      );
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };
  const runConfirm = async () => {
    if (!confirm) return;
    const action = confirm;
    setMutating(true);
    try {
      if (action.kind === "disable") {
        await mutate(`/api/customers/${action.customer.id}/status`, "POST", {
          status: "disabled",
        });
      } else {
        await mutate(`/api/customers/${action.customer.id}`, "DELETE", {});
      }
      feedback.notify({ message: t(`${action.kind}Success`), severity: "success" });
      setConfirm(null);
      setReload((value) => value + 1);
      if (action.kind === "anonymize") replaceQuery({ customer: null });
      else
        setSelected((value) =>
          value?.id === action.customer.id ? { ...value, status: "disabled" } : value,
        );
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const date = (value: string | null) =>
    value ? formatDateTime(new Date(value), locale) : t("never");
  const contact = (customer: Customer) => customer.email ?? customer.mobile ?? t("restricted");
  const statusChip = (customer: Customer) => (
    <Chip
      size="small"
      color={
        customer.status === "active"
          ? "success"
          : customer.status === "disabled"
            ? "warning"
            : "default"
      }
      label={t(`statuses.${customer.status}`)}
    />
  );
  const openDetails = (customer: Customer) => replaceQuery({ customer: customer.id });
  const actionMenu = (customer: Customer) => (
    <Tooltip title={t("actions")}>
      <IconButton
        aria-label={t("actionsFor", { name: `${customer.firstName} ${customer.lastName}` })}
        onClick={(event) => {
          setMenuAnchor(event.currentTarget);
          setMenuCustomer(customer);
        }}
      >
        <MoreHorizRounded />
      </IconButton>
    </Tooltip>
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Button startIcon={<RefreshRounded />} onClick={() => setReload((value) => value + 1)}>
          {t("refresh")}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
          <TextField
            fullWidth
            value={draftSearch}
            label={t("search")}
            onChange={(event) => setSearchDraft(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl sx={{ minWidth: 170 }}>
            <InputLabel>{t("status")}</InputLabel>
            <Select
              label={t("status")}
              value={status}
              onChange={(event) => replaceQuery({ status: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allStatuses")}</MenuItem>
              {STATUSES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`statuses.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 195 }}>
            <InputLabel>{t("sort")}</InputLabel>
            <Select
              label={t("sort")}
              value={sort}
              onChange={(event) => replaceQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(SORT_LABELS[value])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={<Button onClick={() => setReload((value) => value + 1)}>{t("retry")}</Button>}
        />
      ) : loading ? (
        <Stack spacing={1}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={78} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          icon={<PersonRounded />}
        />
      ) : (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ display: { xs: "none", md: "block" } }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("customer")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("orders")}</TableCell>
                  <TableCell>{t("spent")}</TableCell>
                  <TableCell>{t("lastOrder")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>
                      <Button
                        color="inherit"
                        onClick={() => openDetails(customer)}
                        sx={{
                          p: 0,
                          textAlign: "start",
                          justifyContent: "flex-start",
                          textTransform: "none",
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                          <Avatar>
                            {customer.firstName[0]}
                            {customer.lastName[0]}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>
                              {customer.firstName} {customer.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {contact(customer)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Button>
                    </TableCell>
                    <TableCell>{statusChip(customer)}</TableCell>
                    <TableCell>{customer.summary.orderCount}</TableCell>
                    <TableCell>{formatEuro(customer.summary.totalSpentCents, locale)}</TableCell>
                    <TableCell>{date(customer.summary.lastOrderAt)}</TableCell>
                    <TableCell align="right">{actionMenu(customer)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {items.map((customer) => (
              <Paper key={customer.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                  <Avatar>
                    {customer.firstName[0]}
                    {customer.lastName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => openDetails(customer)}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {customer.firstName} {customer.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {contact(customer)}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {statusChip(customer)}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t("orderCount", { count: customer.summary.orderCount })}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {t("spentValue", {
                        amount: formatEuro(customer.summary.totalSpentCents, locale),
                      })}
                    </Typography>
                  </Box>
                  {actionMenu(customer)}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {!error && !loading && pagination.totalItems > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
        >
          <Typography color="text.secondary">
            {t("results", { count: pagination.totalItems })}
          </Typography>
          <AppPagination
            label={t("pagination")}
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(_event, value) => replaceQuery({ page: value })}
          />
          <FormControl size="small">
            <InputLabel>{t("perPage")}</InputLabel>
            <Select
              label={t("perPage")}
              value={pageSize}
              onChange={(event) => replaceQuery({ pageSize: Number(event.target.value), page: 1 })}
            >
              {PAGE_SIZES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuCustomer) openDetails(menuCustomer);
            closeMenu();
          }}
        >
          {t("viewDetails")}
        </MenuItem>
        {capabilities.update && menuCustomer?.status === "active" && (
          <MenuItem
            onClick={() => {
              if (menuCustomer) setConfirm({ kind: "disable", customer: menuCustomer });
              closeMenu();
            }}
          >
            <BlockRounded fontSize="small" sx={{ mr: 1 }} />
            {t("disable")}
          </MenuItem>
        )}
        {capabilities.update && menuCustomer?.status === "disabled" && (
          <MenuItem
            onClick={() => {
              const customer = menuCustomer;
              closeMenu();
              if (customer) void setCustomerStatus(customer, "active").catch(() => undefined);
            }}
          >
            <VerifiedUserRounded fontSize="small" sx={{ mr: 1 }} />
            {t("reactivate")}
          </MenuItem>
        )}
        {capabilities.delete && menuCustomer && menuCustomer.status !== "anonymized" && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              if (menuCustomer) setConfirm({ kind: "anonymize", customer: menuCustomer });
              closeMenu();
            }}
          >
            <DeleteOutlineRounded fontSize="small" sx={{ mr: 1 }} />
            {t("anonymize")}
          </MenuItem>
        )}
      </Menu>

      <AppDrawer
        open={Boolean(selectedId)}
        title={t("detailTitle")}
        closeLabel={t("close")}
        onClose={() => replaceQuery({ customer: null })}
      >
        {!activeSelected ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={100} />
            <Skeleton variant="rounded" height={180} />
          </Stack>
        ) : (
          <Stack spacing={3} sx={{ minWidth: { sm: 390 } }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar sx={{ width: 56, height: 56 }}>
                {activeSelected.firstName[0]}
                {activeSelected.lastName[0]}
              </Avatar>
              <Box>
                <Typography variant="h6">
                  {activeSelected.firstName} {activeSelected.lastName}
                </Typography>
                {statusChip(activeSelected)}
              </Box>
            </Stack>
            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
              <Button
                component={Link}
                href={`/dashboard/orders?customerId=${activeSelected.id}`}
                startIcon={<ReceiptLongOutlined />}
              >
                {t("viewOrders")}
              </Button>
              <Button
                component={Link}
                href={`/dashboard/customers/${activeSelected.id}/addresses`}
                startIcon={<HomeOutlined />}
              >
                {t("viewAddresses")}
              </Button>
              {capabilities.readSensitive && (
                <Button
                  component="a"
                  href={`/api/customers/${activeSelected.id}/export`}
                  startIcon={<DownloadRounded />}
                  download
                >
                  {t("export")}
                </Button>
              )}
            </Stack>
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <Metric label={t("orders")} value={String(activeSelected.summary.orderCount)} />
              <Metric
                label={t("spent")}
                value={formatEuro(activeSelected.summary.totalSpentCents, locale)}
              />
            </Stack>
            <Divider />
            <Stack spacing={1.5}>
              <Detail
                label={t("email")}
                value={activeSelected.email ?? t("restricted")}
                icon={<MailOutlineRounded fontSize="small" />}
              />
              <Detail label={t("mobile")} value={activeSelected.mobile ?? t("restricted")} />
              <Detail label={t("lastOrder")} value={date(activeSelected.summary.lastOrderAt)} />
              <Detail label={t("joined")} value={date(activeSelected.createdAt)} />
              <Detail label={t("updated")} value={date(activeSelected.updatedAt)} />
              <Detail
                label={t("mobileVerified")}
                value={activeSelected.mobileVerifiedAt ? t("yes") : t("no")}
              />
              <Detail
                label={t("emailVerified")}
                value={activeSelected.emailVerifiedAt ? t("yes") : t("no")}
              />
              <Detail
                label={t("marketingConsent")}
                value={activeSelected.marketingConsent ? t("yes") : t("no")}
              />
              <Detail
                label={t("termsAccepted")}
                value={
                  activeSelected.termsAcceptedAt ? date(activeSelected.termsAcceptedAt) : t("no")
                }
              />
            </Stack>
            {activeSelected.status !== "anonymized" &&
              (capabilities.update || capabilities.delete) && (
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                  {capabilities.update &&
                    (activeSelected.status === "active" ? (
                      <Button
                        color="warning"
                        startIcon={<BlockRounded />}
                        onClick={() => setConfirm({ kind: "disable", customer: activeSelected })}
                      >
                        {t("disable")}
                      </Button>
                    ) : (
                      <Button
                        color="success"
                        startIcon={<VerifiedUserRounded />}
                        onClick={() =>
                          void setCustomerStatus(activeSelected, "active").catch(() => undefined)
                        }
                      >
                        {t("reactivate")}
                      </Button>
                    ))}
                  {capabilities.delete && (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRounded />}
                      onClick={() => setConfirm({ kind: "anonymize", customer: activeSelected })}
                    >
                      {t("anonymize")}
                    </Button>
                  )}
                </Stack>
              )}
          </Stack>
        )}
      </AppDrawer>

      <ConfirmationDialog
        open={confirm !== null}
        danger
        loading={mutating}
        title={confirm ? t(`${confirm.kind}Title`) : ""}
        description={
          confirm
            ? t(`${confirm.kind}Description`, {
                name: `${confirm.customer.firstName} ${confirm.customer.lastName}`,
              })
            : ""
        }
        confirmLabel={confirm ? t(`${confirm.kind}Confirm`) : t("confirm")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm().catch(() => undefined)}
      />
    </Stack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Paper>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {icon}
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
      <Typography sx={{ textAlign: "end", wordBreak: "break-word" }}>{value}</Typography>
    </Stack>
  );
}
