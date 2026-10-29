"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { AppPagination, ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { formatDateTime, formatEuro } from "@/locales/formatters";

const statuses = [
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
type Status = (typeof statuses)[number];
type Transaction = {
  id: string;
  orderId: string;
  method: string;
  provider: string;
  status: Status;
  amounts: { requestedCents: number; capturedCents: number; refundedCents: number };
  createdAt: string;
};
type Response = {
  data: Transaction[];
  meta: { pagination: { totalPages: number; totalItems: number } };
};

export function TransactionList() {
  const t = useTranslations("dashboard.transactionList");
  const payment = useTranslations("dashboard.orderList.payments");
  const locale = useLocale() as SupportedLocale;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status | "">("");
  const [result, setResult] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);
    fetch(`/api/transactions?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("transaction_list_failed");
        const body = (await response.json()) as Response;
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_response");
        setResult(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, status, attempt]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        gap={2}
      >
        <div>
          <Typography component="h1" variant="h4">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </div>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="transaction-status-label">{t("status")}</InputLabel>
          <Select
            labelId="transaction-status-label"
            label={t("status")}
            value={status}
            onChange={(event) => {
              const next = event.target.value as Status | "";
              if (next === status && page === 1) return;
              setLoading(true);
              setFailed(false);
              setStatus(next);
              setPage(1);
            }}
          >
            <MenuItem value="">{t("allStatuses")}</MenuItem>
            {statuses.map((item) => (
              <MenuItem key={item} value={item}>
                {payment(item)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {loading ? (
        <Typography role="status">{t("loading")}</Typography>
      ) : failed ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Button
              variant="contained"
              onClick={() => {
                setLoading(true);
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : !result?.data.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6">{t("emptyTitle")}</Typography>
          <Typography color="text.secondary">
            {status ? t("emptyFiltered") : t("emptyDescription")}
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label={t("title")}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("transaction")}</TableCell>
                  <TableCell>{t("order")}</TableCell>
                  <TableCell>{t("method")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell align="right">{t("requested")}</TableCell>
                  <TableCell align="right">{t("captured")}</TableCell>
                  <TableCell align="right">{t("refunded")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.data.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDateTime(item.createdAt, locale)}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{item.id}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{item.orderId}</TableCell>
                    <TableCell>
                      {item.method === "mbway" ? "MB WAY" : item.method}{" "}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({item.provider})
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={payment(item.status)} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      {formatEuro(item.amounts.requestedCents, locale)}
                    </TableCell>
                    <TableCell align="right">
                      {formatEuro(item.amounts.capturedCents, locale)}
                    </TableCell>
                    <TableCell align="right">
                      {formatEuro(item.amounts.refundedCents, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {result.meta.pagination.totalPages > 1 && (
            <AppPagination
              label={t("pagination")}
              count={result.meta.pagination.totalPages}
              page={page}
              onChange={(_, value) => {
                if (value !== page) {
                  setLoading(true);
                  setFailed(false);
                  setPage(value);
                }
              }}
            />
          )}
        </>
      )}
    </Stack>
  );
}
