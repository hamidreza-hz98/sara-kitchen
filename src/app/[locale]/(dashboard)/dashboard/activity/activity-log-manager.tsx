"use client";

import { AdvancedFilters } from "@/components/ui/advanced-filters";

import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import FilterAltOffOutlined from "@mui/icons-material/FilterAltOffOutlined";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppDrawer, AppPagination, EmptyState, ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { formatDateTime } from "@/locales/formatters";
import { usePathname, useRouter } from "@/locales/navigation";

type ActorKind = "admin" | "customer" | "system" | "anonymous";
type Outcome = "success" | "failure" | "denied";
type Severity = "info" | "warning" | "error" | "critical";
type AuditType = "authentication" | "authorization" | "data" | "business" | "security" | "system";
type AuditLogItem = Readonly<{
  id: string;
  actionCode: string;
  message: string;
  actor: Readonly<{
    kind: ActorKind;
    ref: string | null;
    snapshot: Readonly<{ displayName: string | null; role: string | null }>;
  }>;
  resource: Readonly<{
    kind: string;
    ref: string | null;
    snapshot: Readonly<{ code: string | null; label: string | null; status: string | null }>;
  }>;
  outcome: Outcome;
  severity: Severity;
  type: AuditType;
  requestId: string;
  context: Readonly<Record<string, boolean | number | string | null>>;
  networkPolicy: "hashed" | "retained" | "omitted";
  userAgent: string | null;
  occurredAt: string;
  createdAt: string;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type ListEnvelope = Readonly<{
  data?: readonly AuditLogItem[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;

const PAGE_SIZES = [25, 50, 100] as const;
const ACTOR_KINDS = ["admin", "customer", "system", "anonymous"] as const;
const OUTCOMES = ["success", "failure", "denied"] as const;
const SEVERITIES = ["info", "warning", "error", "critical"] as const;
const TYPES = [
  "authentication",
  "authorization",
  "data",
  "business",
  "security",
  "system",
] as const;

const queryKeys = [
  "dateFrom",
  "dateTo",
  "actorKind",
  "actorRef",
  "action",
  "resourceKind",
  "resourceRef",
  "type",
  "severity",
  "outcome",
  "requestId",
] as const;

export function ActivityLogManager() {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale() as SupportedLocale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(rawQuery), [rawQuery]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as 25 | 50 | 100)
    ? Number(query.get("pageSize"))
    : 25;
  const selectedId = query.get("event");
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(queryKeys.map((key) => [key, query.get(key) ?? ""])),
  );
  const [items, setItems] = useState<readonly AuditLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (Object.keys(patch).some((key) => key !== "event")) setLoading(true);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, rawQuery, router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const key of queryKeys) {
      const value = query.get(key);
      if (value) {
        parameters.set(
          key,
          key === "dateFrom"
            ? `${value}T00:00:00.000Z`
            : key === "dateTo"
              ? `${value}T23:59:59.999Z`
              : value,
        );
      }
    }
    fetch(`/api/activity?${parameters.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("activity_list_failed");
        return (await response.json()) as ListEnvelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_activity_list");
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
  }, [page, pageSize, query, reload]);

  const selected = selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null;
  const date = (value: string) => formatDateTime(new Date(value), locale);
  const actorLabel = (item: AuditLogItem) =>
    item.actor.snapshot.displayName ?? t(`actorKinds.${item.actor.kind}`);
  const resourceLabel = (item: AuditLogItem) =>
    item.resource.snapshot.label ?? item.resource.ref ?? item.resource.kind;
  const setField = (key: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const applyFilters = () =>
    replaceQuery({
      ...Object.fromEntries(queryKeys.map((key) => [key, draft[key]?.trim() || null])),
      page: 1,
      event: null,
    });
  const clearFilters = () => {
    setDraft(Object.fromEntries(queryKeys.map((key) => [key, ""])));
    replaceQuery({
      ...Object.fromEntries(queryKeys.map((key) => [key, null])),
      page: 1,
      event: null,
    });
  };

  const outcomeChip = (value: Outcome) => (
    <Chip
      size="small"
      color={value === "success" ? "success" : value === "denied" ? "warning" : "error"}
      label={t(`outcomes.${value}`)}
    />
  );
  const severityChip = (value: Severity) => (
    <Chip
      size="small"
      variant="outlined"
      color={
        value === "critical" || value === "error"
          ? "error"
          : value === "warning"
            ? "warning"
            : "default"
      }
      label={t(`severities.${value}`)}
    />
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

      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 3, md: 4 } }}
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <AdvancedFilters spacing={3}>
          <TextField
            type="date"
            label={t("dateFrom")}
            value={draft.dateFrom}
            onChange={(e) => setField("dateFrom", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            label={t("dateTo")}
            value={draft.dateTo}
            onChange={(e) => setField("dateTo", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={t("actorKind")}
            value={draft.actorKind}
            onChange={(e) => {
              setField("actorKind", e.target.value);
              if (!(["admin", "customer"] as string[]).includes(e.target.value))
                setField("actorRef", "");
            }}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {ACTOR_KINDS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`actorKinds.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("actorRef")}
            value={draft.actorRef}
            disabled={!(["admin", "customer"] as string[]).includes(draft.actorKind ?? "")}
            onChange={(e) => setField("actorRef", e.target.value)}
          />
          <TextField
            label={t("action")}
            value={draft.action}
            onChange={(e) => setField("action", e.target.value)}
          />
          <TextField
            label={t("resourceKind")}
            value={draft.resourceKind}
            onChange={(e) => {
              setField("resourceKind", e.target.value);
              if (!e.target.value) setField("resourceRef", "");
            }}
          />
          <TextField
            label={t("resourceRef")}
            value={draft.resourceRef}
            disabled={!draft.resourceKind}
            onChange={(e) => setField("resourceRef", e.target.value)}
          />
          <TextField
            select
            label={t("type")}
            value={draft.type}
            onChange={(e) => setField("type", e.target.value)}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {TYPES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`types.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("severity")}
            value={draft.severity}
            onChange={(e) => setField("severity", e.target.value)}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {SEVERITIES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`severities.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("outcome")}
            value={draft.outcome}
            onChange={(e) => setField("outcome", e.target.value)}
          >
            <MenuItem value="">{t("all")}</MenuItem>
            {OUTCOMES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`outcomes.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("requestId")}
            value={draft.requestId}
            onChange={(e) => setField("requestId", e.target.value)}
            sx={{ gridColumn: { lg: "span 2" } }}
          />
        </AdvancedFilters>
        <Stack direction="row" sx={{ gap: 2, justifyContent: "flex-end", mt: 3, flexWrap: "wrap" }}>
          <Button startIcon={<FilterAltOffOutlined />} onClick={clearFilters}>
            {t("clear")}
          </Button>
          <Button type="submit" variant="contained">
            {t("apply")}
          </Button>
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
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={72} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FactCheckOutlined />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
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
                  <TableCell>{t("occurred")}</TableCell>
                  <TableCell>{t("event")}</TableCell>
                  <TableCell>{t("actor")}</TableCell>
                  <TableCell>{t("resource")}</TableCell>
                  <TableCell>{t("classification")}</TableCell>
                  <TableCell>{t("outcome")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => replaceQuery({ event: item.id })}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{date(item.occurredAt)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{item.message}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.actionCode}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {actorLabel(item)}
                      <Typography
                        sx={{ display: "block" }}
                        variant="caption"
                        color="text.secondary"
                      >
                        {t(`actorKinds.${item.actor.kind}`)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {resourceLabel(item)}
                      <Typography
                        sx={{ display: "block" }}
                        variant="caption"
                        color="text.secondary"
                      >
                        {item.resource.kind}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                        {severityChip(item.severity)}
                        <Chip size="small" label={t(`types.${item.type}`)} />
                      </Stack>
                    </TableCell>
                    <TableCell>{outcomeChip(item.outcome)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {items.map((item) => (
              <Paper
                component="button"
                type="button"
                key={item.id}
                variant="outlined"
                onClick={() => replaceQuery({ event: item.id })}
                sx={{ p: 2, textAlign: "start", color: "inherit", cursor: "pointer" }}
              >
                <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{item.message}</Typography>
                  {outcomeChip(item.outcome)}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {actorLabel(item)} · {resourceLabel(item)}
                </Typography>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center", mt: 1 }}
                >
                  {severityChip(item.severity)}
                  <Typography variant="caption">{date(item.occurredAt)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {!error && !loading && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
        >
          <Typography color="text.secondary">
            {t("results", { count: pagination.totalItems })}
          </Typography>
          <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
            <TextField
              select
              size="small"
              label={t("perPage")}
              value={pageSize}
              onChange={(e) => replaceQuery({ pageSize: e.target.value, page: 1, event: null })}
            >
              {PAGE_SIZES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <AppPagination
              label={t("pagination")}
              count={Math.max(1, pagination.totalPages)}
              page={Math.min(page, Math.max(1, pagination.totalPages))}
              onChange={(_, value) => replaceQuery({ page: value, event: null })}
            />
          </Stack>
        </Stack>
      )}

      <AppDrawer
        open={selected !== null}
        title={selected?.message ?? t("detailTitle")}
        description={selected ? selected.actionCode : undefined}
        closeLabel={t("close")}
        onClose={() => replaceQuery({ event: null })}
      >
        {selected && (
          <Stack spacing={3}>
            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
              {outcomeChip(selected.outcome)}
              {severityChip(selected.severity)}
              <Chip size="small" label={t(`types.${selected.type}`)} />
            </Stack>
            <Detail label={t("occurred")} value={date(selected.occurredAt)} />
            <Detail
              label={t("actor")}
              value={`${actorLabel(selected)} · ${t(`actorKinds.${selected.actor.kind}`)}`}
            />
            <Detail label={t("actorRef")} value={selected.actor.ref ?? t("none")} />
            <Detail
              label={t("resource")}
              value={`${resourceLabel(selected)} · ${selected.resource.kind}`}
            />
            <Detail label={t("resourceRef")} value={selected.resource.ref ?? t("none")} />
            <Detail label={t("requestId")} value={selected.requestId} />
            <Detail
              label={t("networkPolicy")}
              value={t(`networkPolicies.${selected.networkPolicy}`)}
            />
            <Detail label={t("userAgent")} value={selected.userAgent ?? t("none")} />
            <Box>
              <Typography variant="overline" color="text.secondary">
                {t("context")}
              </Typography>
              {Object.keys(selected.context).length === 0 ? (
                <Typography>{t("noContext")}</Typography>
              ) : (
                <Stack component="dl" spacing={1} sx={{ m: 0, mt: 1 }}>
                  {Object.entries(selected.context).map(([key, value]) => (
                    <Stack
                      key={key}
                      direction="row"
                      sx={{ gap: 2, justifyContent: "space-between" }}
                    >
                      <Typography component="dt" color="text.secondary">
                        {key}
                      </Typography>
                      <Typography
                        component="dd"
                        sx={{ m: 0, textAlign: "end", overflowWrap: "anywhere" }}
                      >
                        {String(value)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        )}
      </AppDrawer>
    </Stack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: "end", overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}
