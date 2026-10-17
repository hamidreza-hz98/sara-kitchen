"use client";

import CancelRounded from "@mui/icons-material/CancelRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import HourglassTopRounded from "@mui/icons-material/HourglassTopRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SupportedLocale } from "@/constants";
import { formatDateTime, formatEuro } from "@/locales/formatters";
import { Link } from "@/locales/navigation";

export type PaymentResultViewModel = Readonly<{
  orderCode: string;
  orderStatus: string;
  paymentStatus: string;
  state: "pending" | "success" | "failed" | "expired" | "cancelled" | "refunded";
  amountCents: number;
  currency: "EUR";
  updatedAt: string | Date;
  pollAfterMs: number | null;
  canStartNewOrder: boolean;
}>;

type ResultEnvelope = Readonly<{ data?: PaymentResultViewModel }>;
const MAX_AUTOMATIC_POLLS = 48;

function ResultIcon({ state }: { state: PaymentResultViewModel["state"] }) {
  if (state === "success")
    return <CheckCircleRounded aria-hidden="true" color="success" sx={{ fontSize: 72 }} />;
  if (state === "pending")
    return <HourglassTopRounded aria-hidden="true" color="warning" sx={{ fontSize: 72 }} />;
  return <CancelRounded aria-hidden="true" color="error" sx={{ fontSize: 72 }} />;
}

export function PaymentResultView({ initialResult }: { initialResult: PaymentResultViewModel }) {
  const t = useTranslations("storefront.paymentResult");
  const locale = useLocale() as SupportedLocale;
  const [result, setResult] = useState(initialResult);
  const [refreshing, setRefreshing] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [automaticPollingEnded, setAutomaticPollingEnded] = useState(false);
  const [pollRetry, setPollRetry] = useState(0);
  const pollCount = useRef(0);

  const fetchResult = useCallback(async () => {
    const response = await fetch(
      `/api/profile/payment-result?order=${encodeURIComponent(initialResult.orderCode)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!response.ok) throw new Error("payment_result_failed");
    const body = (await response.json()) as ResultEnvelope;
    if (!body.data || body.data.orderCode !== initialResult.orderCode)
      throw new Error("payment_result_invalid");
    setResult(body.data);
    setPollError(false);
    return body.data;
  }, [initialResult.orderCode]);

  useEffect(() => {
    if (result.state !== "pending" || automaticPollingEnded) return;
    let active = true;
    const delay = result.pollAfterMs ?? 2_500;
    const timer = window.setTimeout(() => {
      pollCount.current += 1;
      fetchResult()
        .then((latest) => {
          if (active && latest.state === "pending" && pollCount.current >= MAX_AUTOMATIC_POLLS)
            setAutomaticPollingEnded(true);
        })
        .catch(() => {
          if (!active) return;
          setPollError(true);
          if (pollCount.current >= MAX_AUTOMATIC_POLLS) setAutomaticPollingEnded(true);
          else setPollRetry((value) => value + 1);
        });
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [automaticPollingEnded, fetchResult, pollRetry, result]);

  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      pollCount.current = 0;
      setAutomaticPollingEnded(false);
      await fetchResult();
    } catch {
      setPollError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const stateTitle = t(`states.${result.state}.title`);
  const stateDescription = t(`states.${result.state}.description`);

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 6, md: 10 } }}>
      <Paper sx={{ p: { xs: 3, sm: 5 }, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
          <ResultIcon state={result.state} />
          <Box>
            <Typography component="h1" variant="h3">
              {stateTitle}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {stateDescription}
            </Typography>
            <Box
              aria-atomic="true"
              aria-live="polite"
              component="span"
              sx={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
              }}
            >
              {stateTitle}. {stateDescription}
            </Box>
          </Box>

          <Paper variant="outlined" sx={{ width: "100%", p: 2.5, bgcolor: "background.default" }}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {t("orderCode")}
              </Typography>
              <Typography
                component="bdi"
                dir="ltr"
                sx={{ fontWeight: 800, overflowWrap: "anywhere" }}
              >
                {result.orderCode}
              </Typography>
              <Typography variant="h5">{formatEuro(result.amountCents, locale)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("lastChecked", { time: formatDateTime(new Date(result.updatedAt), locale) })}
              </Typography>
            </Stack>
          </Paper>

          {result.state === "pending" ? (
            <Stack spacing={2} sx={{ alignItems: "center" }}>
              {!automaticPollingEnded ? (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <CircularProgress aria-hidden="true" size={22} />
                  <Typography>{t("checking")}</Typography>
                </Stack>
              ) : (
                <Alert severity="info">{t("pollingPaused")}</Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                {t("pendingSafety")}
              </Typography>
            </Stack>
          ) : null}

          {pollError ? <Alert severity="warning">{t("refreshError")}</Alert> : null}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ width: "100%", justifyContent: "center" }}
          >
            {result.state === "pending" ? (
              <Button
                variant="contained"
                startIcon={<RefreshRounded />}
                disabled={refreshing}
                onClick={() => {
                  manualRefresh().catch(() => undefined);
                }}
              >
                {refreshing ? t("refreshing") : t("refresh")}
              </Button>
            ) : null}
            <Button
              component={Link}
              href="/profile/orders"
              variant={result.state === "success" ? "contained" : "outlined"}
            >
              {t("viewOrders")}
            </Button>
            {result.canStartNewOrder ? (
              <Button component={Link} href="/menu" startIcon={<ReplayRounded />}>
                {t("startNewOrder")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
