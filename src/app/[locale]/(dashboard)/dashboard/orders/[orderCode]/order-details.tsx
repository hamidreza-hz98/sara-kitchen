"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { formatDateTime, formatEuro } from "@/locales/formatters";
import { Link } from "@/locales/navigation";

type DateValue = string | Date;
type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "payment_failed"
  | "cancelled"
  | "expired"
  | "refunded";
type PaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "partially-refunded"
  | "refunded";

export type DetailOrder = Readonly<{
  id: string;
  code: string;
  status: OrderStatus;
  revision: number;
  managementRevision: number;
  customerId: string;
  customer: Readonly<{
    firstName: string;
    lastName: string;
    mobile: string;
    email: string | null;
  }> | null;
  address: Readonly<{
    name: string;
    recipientName: string;
    recipientMobile: string;
    formattedAddress: string;
    postalCode: string;
    deliveryNotes: string | null;
    location: Readonly<{ coordinates: readonly [number, number] }>;
  }> | null;
  items: readonly Readonly<{
    dishId: string;
    slug: string;
    name: string;
    quantity: number;
    baseUnitPriceCents: number;
    effectiveUnitPriceCents: number;
    lineSubtotalCents: number;
  }>[];
  pricing: Readonly<{
    subtotalCents: number;
    discountCents: number;
    deliveryFeeCents: number;
    taxCents: number;
    adjustmentsCents: number;
    totalCents: number;
    adjustments: readonly Readonly<{ code: string; amountCents: number }>[];
  }>;
  fulfillment: Readonly<{
    method: "pickup" | "delivery";
    leadTimeMinutes: number;
    acceptedAt: DateValue;
    earliestReadyAt: DateValue;
    completedAt: DateValue | null;
  }>;
  statusHistory: readonly Readonly<{
    status: OrderStatus;
    actorKind: "system" | "admin" | "customer";
    paymentStatus: PaymentStatus;
    reasonCode: string | null;
    occurredAt: DateValue;
  }>[];
  transactionIds: readonly string[];
  notes: string | null;
  internalNote: string | null;
  refundFollowUpRequired: boolean;
  createdAt: DateValue;
  updatedAt: DateValue;
}>;

export type DetailTransaction = Readonly<{
  id: string;
  orderId: string;
  method: string;
  provider: string;
  status: PaymentStatus;
  amounts: Readonly<{
    requestedCents: number;
    authorizedCents: number;
    capturedCents: number;
    refundedCents: number;
  }>;
  responseCode: string | null;
  events: readonly Readonly<{
    status: PaymentStatus;
    source: "system" | "customer" | "admin" | "provider";
    amountCents: number | null;
    responseCode: string | null;
    occurredAt: DateValue;
  }>[];
  createdAt: DateValue;
}>;

type Capabilities = Readonly<{
  readSensitive: boolean;
  readTransactions: boolean;
  update: boolean;
  cancel: boolean;
}>;

function nextStatus(order: DetailOrder): OrderStatus | null {
  const payment = order.statusHistory.at(-1)?.paymentStatus;
  if (payment !== "paid" && payment !== "partially-refunded") return null;
  if (order.status === "confirmed") return "preparing";
  if (order.status === "preparing") return "ready";
  if (order.status === "ready")
    return order.fulfillment.method === "delivery" ? "out_for_delivery" : "completed";
  if (order.status === "out_for_delivery") return "completed";
  return null;
}

function canCancel(order: DetailOrder): boolean {
  const payment = order.statusHistory.at(-1)?.paymentStatus;
  if (order.status === "pending_payment") return payment === "cancelled";
  return (
    (payment === "paid" || payment === "partially-refunded") &&
    ["confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status)
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: "end", overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}

export function OrderDetails({
  initialOrder,
  initialTransactions,
  capabilities,
}: {
  initialOrder: DetailOrder;
  initialTransactions: readonly DetailTransaction[];
  capabilities: Capabilities;
}) {
  const t = useTranslations("dashboard.orderDetails");
  const list = useTranslations("dashboard.orderList");
  const locale = useLocale() as SupportedLocale;
  const feedback = useFeedback();
  const [order, setOrder] = useState(initialOrder);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [internalNote, setInternalNote] = useState(initialOrder.internalNote ?? "");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);
  const next = capabilities.update ? nextStatus(order) : null;

  const refresh = async () => {
    const response = await fetch(`/api/orders/${encodeURIComponent(order.code)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("order_refresh_failed");
    const body = (await response.json()) as { data?: DetailOrder };
    if (!body.data || body.data.code !== order.code) throw new Error("order_refresh_invalid");
    const updated = body.data;
    const updatedTransactions: DetailTransaction[] = [];
    if (capabilities.readTransactions) {
      for (const id of updated.transactionIds) {
        const transactionResponse = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!transactionResponse.ok) throw new Error("transaction_refresh_failed");
        const transactionBody = (await transactionResponse.json()) as {
          data?: DetailTransaction;
        };
        if (!transactionBody.data || transactionBody.data.orderId !== updated.id)
          throw new Error("transaction_refresh_invalid");
        updatedTransactions.push(transactionBody.data);
      }
    }
    setOrder(updated);
    setTransactions(updatedTransactions);
    setInternalNote(updated.internalNote ?? "");
    setLoadError(false);
  };

  const reload = async () => {
    setBusy(true);
    try {
      await refresh();
    } catch {
      setLoadError(true);
      feedback.notify({ message: t("refreshError"), severity: "error" });
    } finally {
      setBusy(false);
    }
  };

  const applyStatus = async (status: OrderStatus) => {
    setBusy(true);
    setConfirmStatus(null);
    try {
      const path = status === "cancelled" ? "cancel" : "status";
      const response = await fetch(`/api/orders/${encodeURIComponent(order.code)}/${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify({
          expectedRevision: order.revision,
          ...(status === "cancelled"
            ? { reasonCode: "admin_cancelled" }
            : { status, reasonCode: null }),
        }),
      });
      if (!response.ok) throw new Error("order_transition_failed");
      await refresh();
      feedback.notify({ message: t("actionSuccess"), severity: "success" });
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.code)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify({
          expectedRevision: order.revision,
          expectedManagementRevision: order.managementRevision,
          internalNote: internalNote.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("order_note_failed");
      await refresh();
      feedback.notify({ message: t("noteSaved"), severity: "success" });
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const card = { p: { xs: 2.5, md: 3 }, border: "1px solid", borderColor: "divider" } as const;
  return (
    <Stack spacing={3} sx={{ pb: 8 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Button component={Link} href="/dashboard/orders" startIcon={<ArrowBackRounded />}>
            {t("back")}
          </Button>
          <Typography component="h1" variant="h3" sx={{ mt: 1 }}>
            {t("title", { code: order.code })}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Chip
              label={list(`statuses.${order.status}`)}
              color={order.status === "completed" ? "success" : "default"}
            />
            <Typography color="text.secondary" variant="body2">
              {formatDateTime(new Date(order.createdAt), locale)}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" sx={{ gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Button
            startIcon={<RefreshRounded />}
            disabled={busy}
            onClick={() => {
              reload().catch(() => undefined);
            }}
          >
            {t("refresh")}
          </Button>
          {next ? (
            <Button variant="contained" disabled={busy} onClick={() => setConfirmStatus(next)}>
              {t("moveTo", { status: list(`statuses.${next}`) })}
            </Button>
          ) : null}
          {capabilities.cancel && canCancel(order) ? (
            <Button color="error" disabled={busy} onClick={() => setConfirmStatus("cancelled")}>
              {list("cancel")}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {loadError ? (
        <ErrorState
          title={t("refreshError")}
          description={t("staleWarning")}
          action={
            <Button
              onClick={() => {
                reload().catch(() => undefined);
              }}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : null}
      {order.refundFollowUpRequired ? (
        <Paper sx={{ ...card, borderColor: "warning.main" }}>
          <Typography color="warning.main" sx={{ fontWeight: 700 }}>
            {t("refundFollowUp")}
          </Typography>
        </Paper>
      ) : null}

      <Stack direction={{ xs: "column", lg: "row" }} sx={{ gap: 3, alignItems: "flex-start" }}>
        <Stack spacing={3} sx={{ flex: 2, width: "100%", minWidth: 0 }}>
          <Paper sx={card}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {t("items")}
            </Typography>
            <Stack spacing={2}>
              {order.items.map((item, index) => (
                <Stack
                  key={`${item.dishId}-${index}`}
                  direction={{ xs: "column", sm: "row" }}
                  sx={{
                    justifyContent: "space-between",
                    gap: 1,
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {t("quantity", { count: item.quantity })} ·{" "}
                      {formatEuro(item.effectiveUnitPriceCents, locale)} {t("each")}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { sm: "end" } }}>
                    <Typography>{formatEuro(item.lineSubtotalCents, locale)}</Typography>
                    {item.baseUnitPriceCents > item.effectiveUnitPriceCents ? (
                      <Typography color="text.secondary" variant="body2">
                        {t("discount")}:{" "}
                        {formatEuro(
                          (item.baseUnitPriceCents - item.effectiveUnitPriceCents) * item.quantity,
                          locale,
                        )}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper sx={card}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {t("timeline")}
            </Typography>
            <Stack spacing={0} component="ol" sx={{ listStyle: "none", p: 0, m: 0 }}>
              {order.statusHistory.map((event, index) => (
                <Box
                  component="li"
                  key={`${index}-${event.occurredAt}`}
                  sx={{ ps: 2, pb: 2, borderInlineStart: "2px solid", borderColor: "primary.main" }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {list(`statuses.${event.status}`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(new Date(event.occurredAt), locale)} ·{" "}
                    {t(`actors.${event.actorKind}`)} · {list(`payments.${event.paymentStatus}`)}
                  </Typography>
                  {event.reasonCode ? (
                    <Typography variant="body2">
                      {t("reason")}: {event.reasonCode}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Paper>

          {capabilities.readTransactions ? (
            <Paper sx={card}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {t("transactions")}
              </Typography>
              {transactions.length === 0 ? (
                <Typography color="text.secondary">{t("noTransactions")}</Typography>
              ) : (
                transactions.map((transaction) => (
                  <Stack key={transaction.id} spacing={1.5} sx={{ mb: 3 }}>
                    <DetailRow label={t("transactionId")} value={transaction.id} />
                    <DetailRow
                      label={t("provider")}
                      value={`${transaction.method} · ${transaction.provider}`}
                    />
                    <DetailRow
                      label={list("status")}
                      value={list(`payments.${transaction.status}`)}
                    />
                    <DetailRow
                      label={t("requested")}
                      value={formatEuro(transaction.amounts.requestedCents, locale)}
                    />
                    <DetailRow
                      label={t("captured")}
                      value={formatEuro(transaction.amounts.capturedCents, locale)}
                    />
                    <DetailRow
                      label={t("refunded")}
                      value={formatEuro(transaction.amounts.refundedCents, locale)}
                    />
                    <Divider />
                    {transaction.events.map((event, index) => (
                      <Typography
                        key={`${transaction.id}-${index}`}
                        variant="body2"
                        color="text.secondary"
                      >
                        {formatDateTime(new Date(event.occurredAt), locale)} ·{" "}
                        {list(`payments.${event.status}`)} · {t(`paymentSources.${event.source}`)}
                        {event.amountCents !== null
                          ? ` · ${formatEuro(event.amountCents, locale)}`
                          : ""}
                      </Typography>
                    ))}
                  </Stack>
                ))
              )}
            </Paper>
          ) : null}
        </Stack>

        <Stack spacing={3} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          <Paper sx={card}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {t("totals")}
            </Typography>
            <Stack spacing={1.5}>
              <DetailRow
                label={t("subtotal")}
                value={formatEuro(order.pricing.subtotalCents, locale)}
              />
              <DetailRow
                label={t("discount")}
                value={`−${formatEuro(order.pricing.discountCents, locale)}`}
              />
              <DetailRow
                label={t("deliveryFee")}
                value={formatEuro(order.pricing.deliveryFeeCents, locale)}
              />
              {order.pricing.adjustments.map((adjustment, index) => (
                <DetailRow
                  key={`${index}-${adjustment.code}`}
                  label={adjustment.code}
                  value={formatEuro(adjustment.amountCents, locale)}
                />
              ))}
              <DetailRow label={t("tax")} value={formatEuro(order.pricing.taxCents, locale)} />
              <Divider />
              <DetailRow label={t("total")} value={formatEuro(order.pricing.totalCents, locale)} />
            </Stack>
          </Paper>

          <Paper sx={card}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              {t("fulfillment")}
            </Typography>
            <Stack spacing={1.5}>
              <DetailRow label={t("method")} value={list(order.fulfillment.method)} />
              <DetailRow
                label={t("leadTime")}
                value={t("minutes", { count: order.fulfillment.leadTimeMinutes })}
              />
              <DetailRow
                label={t("earliestReady")}
                value={formatDateTime(new Date(order.fulfillment.earliestReadyAt), locale)}
              />
              {order.fulfillment.completedAt ? (
                <DetailRow
                  label={t("completedAt")}
                  value={formatDateTime(new Date(order.fulfillment.completedAt), locale)}
                />
              ) : null}
            </Stack>
          </Paper>

          {capabilities.readSensitive ? (
            <>
              <Paper sx={card}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  {t("customer")}
                </Typography>
                {order.customer ? (
                  <Stack spacing={1.5}>
                    <DetailRow
                      label={t("name")}
                      value={`${order.customer.firstName} ${order.customer.lastName}`}
                    />
                    <DetailRow label={t("mobile")} value={order.customer.mobile} />
                    {order.customer.email ? (
                      <DetailRow label={t("email")} value={order.customer.email} />
                    ) : null}
                  </Stack>
                ) : (
                  <Typography>{t("unavailable")}</Typography>
                )}
              </Paper>
              {order.address ? (
                <Paper sx={card}>
                  <Typography variant="h5" sx={{ mb: 2 }}>
                    {t("address")}
                  </Typography>
                  <Stack spacing={1.5}>
                    <DetailRow label={t("recipient")} value={order.address.recipientName} />
                    <DetailRow label={t("mobile")} value={order.address.recipientMobile} />
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                      {order.address.formattedAddress}
                    </Typography>
                    <Typography color="text.secondary">{order.address.postalCode}</Typography>
                    {order.address.deliveryNotes ? (
                      <Typography>{order.address.deliveryNotes}</Typography>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}
              <Paper sx={card}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  {t("notes")}
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }}>
                  {order.notes || t("noNotes")}
                </Typography>
                {capabilities.update ? (
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    <TextField
                      multiline
                      minRows={3}
                      fullWidth
                      label={t("internalNote")}
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                      slotProps={{ htmlInput: { maxLength: 1000 } }}
                    />
                    <Button
                      variant="outlined"
                      disabled={busy || internalNote === (order.internalNote ?? "")}
                      onClick={() => {
                        saveNote().catch(() => undefined);
                      }}
                    >
                      {t("saveNote")}
                    </Button>
                  </Stack>
                ) : order.internalNote ? (
                  <Typography sx={{ whiteSpace: "pre-wrap", mt: 2 }}>
                    {order.internalNote}
                  </Typography>
                ) : null}
              </Paper>
            </>
          ) : null}
        </Stack>
      </Stack>

      <ConfirmationDialog
        open={confirmStatus !== null}
        onCancel={() => setConfirmStatus(null)}
        onConfirm={() => {
          if (confirmStatus) applyStatus(confirmStatus).catch(() => undefined);
        }}
        closeLabel={t("close")}
        cancelLabel={t("back")}
        confirmLabel={t("confirm")}
        title={confirmStatus === "cancelled" ? t("confirmCancel") : t("confirmTransition")}
        description={confirmStatus === "cancelled" ? t("cancelWarning") : t("transitionWarning")}
        loading={busy}
      />
    </Stack>
  );
}
