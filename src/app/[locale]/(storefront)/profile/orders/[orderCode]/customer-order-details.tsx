"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { SupportedLocale } from "@/constants";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { formatDateTime, formatEuro, formatNumber } from "@/locales";
import { Link, useRouter } from "@/locales/navigation";
import type { CustomerOrderDetail } from "@/types/customer-order-detail";

type Props = Readonly<{ locale: SupportedLocale; order: CustomerOrderDetail }>;

export function CustomerOrderDetails({ locale, order }: Props) {
  const t = useTranslations("profile.orderDetails");
  const statusT = useTranslations("profile.summary.status");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(false);

  async function cancelOrder() {
    setCancelling(true);
    setCancelError(false);
    try {
      const response = await fetch(`/api/profile/orders/${encodeURIComponent(order.code)}/cancel`, {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("customer"),
        body: JSON.stringify({ expectedRevision: order.revision, reasonCode: "customer_request" }),
      });
      if (!response.ok) throw new Error("cancel_failed");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setCancelError(true);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 1050, mx: "auto" }}>
      <Box>
        <Button component={Link} href="/profile/orders" size="small">
          {t("back")}
        </Button>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 1, alignItems: { sm: "center" } }}
        >
          <Typography component="h1" variant="h2">
            {t("title", { code: order.code })}
          </Typography>
          <Chip label={statusT(order.status)} />
        </Stack>
        <Typography color="text.secondary">
          {t("placedAt", { date: formatDateTime(new Date(order.createdAt), locale) })}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}>
        <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("timeline")}
        </Typography>
        <Stack component="ol" spacing={2} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {order.history.map((event, index) => (
            <Stack component="li" key={`${index}-${event.occurredAt}`} direction="row" spacing={2}>
              <Box
                aria-hidden
                sx={{
                  width: 12,
                  height: 12,
                  mt: 0.8,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  flexShrink: 0,
                }}
              />
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{statusT(event.status)}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {formatDateTime(new Date(event.occurredAt), locale)} ·{" "}
                  {t("paymentState", { state: t(`paymentStatuses.${event.paymentStatus}`) })}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 3, alignItems: "stretch" }}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3, flex: 2 }}>
          <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
            {t("items")}
          </Typography>
          <Stack spacing={2} divider={<Divider flexItem />}>
            {order.items.map((item, index) => (
              <Stack
                key={`${index}-${item.slug}`}
                direction={{ xs: "column", sm: "row" }}
                sx={{ gap: 1, justifyContent: "space-between" }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {t("quantity", { count: item.quantity })} ·{" "}
                    {t("portion", {
                      amount: formatNumber(item.portionAmount, locale),
                      unit: t(`portionUnits.${item.portionUnit}`),
                    })}
                  </Typography>
                  {item.lineDiscountCents > 0 && (
                    <Typography color="success.main" variant="body2">
                      {t("itemDiscount", { amount: formatEuro(item.lineDiscountCents, locale) })}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ textAlign: { sm: "end" } }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatEuro(item.lineSubtotalCents, locale)}
                  </Typography>
                  {item.baseUnitPriceCents !== item.effectiveUnitPriceCents && (
                    <Typography color="text.secondary" variant="body2">
                      {t("unitPrices", {
                        base: formatEuro(item.baseUnitPriceCents, locale),
                        current: formatEuro(item.effectiveUnitPriceCents, locale),
                      })}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
          {order.notes && (
            <Typography sx={{ mt: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {t("orderNotes", { notes: order.notes })}
            </Typography>
          )}
        </Paper>

        <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}>
            <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
              {t("fulfillment")}
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{t(order.fulfillment.method)}</Typography>
            {!order.address && (
              <Typography>{t("pickupFor", { name: order.customerName })}</Typography>
            )}
            {order.address && (
              <Stack sx={{ mt: 1 }}>
                <Typography>
                  {order.address.recipientName} · {order.address.recipientMobile}
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {order.address.formattedAddress}
                </Typography>
                <Typography>{order.address.postalCode}</Typography>
                {order.address.deliveryNotes && (
                  <Typography color="text.secondary">
                    {t("deliveryNotes", { notes: order.address.deliveryNotes })}
                  </Typography>
                )}
              </Stack>
            )}
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              {t("readyAt", {
                date: formatDateTime(new Date(order.fulfillment.earliestReadyAt), locale),
              })}
            </Typography>
            <Typography color="text.secondary">
              {t("leadTime", { minutes: order.fulfillment.leadTimeMinutes })}
            </Typography>
            {order.fulfillment.completedAt && (
              <Typography color="text.secondary">
                {t("completedAt", {
                  date: formatDateTime(new Date(order.fulfillment.completedAt), locale),
                })}
              </Typography>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}>
            <Typography component="h2" variant="h5" sx={{ mb: 2 }}>
              {t("pricing")}
            </Typography>
            <Stack spacing={1}>
              <PriceRow label={t("subtotal")} value={order.pricing.subtotalCents} locale={locale} />
              {order.pricing.discountCents > 0 && (
                <PriceRow
                  label={t("discount")}
                  value={-order.pricing.discountCents}
                  locale={locale}
                />
              )}
              <PriceRow
                label={t("deliveryFee")}
                value={order.pricing.deliveryFeeCents}
                locale={locale}
              />
              {order.pricing.freeDeliveryApplied && (
                <Typography color="success.main" variant="body2">
                  {t("freeDelivery")}
                </Typography>
              )}
              {order.pricing.adjustmentsCents !== 0 && (
                <PriceRow
                  label={t("adjustments")}
                  value={order.pricing.adjustmentsCents}
                  locale={locale}
                />
              )}
              {order.pricing.taxCents > 0 && (
                <PriceRow label={t("tax")} value={order.pricing.taxCents} locale={locale} />
              )}
              <Divider />
              <PriceRow
                label={t("total")}
                value={order.pricing.totalCents}
                locale={locale}
                strong
              />
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}>
        <Typography component="h2" variant="h5">
          {t("payment")}
        </Typography>
        <Typography sx={{ mt: 1 }}>
          {t("paymentState", { state: t(`paymentStatuses.${order.paymentStatus}`) })}
        </Typography>
        {order.paymentStatus === "unknown" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t("paymentUnknown")}
          </Alert>
        )}
        {cancelError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t("cancelError")}
          </Alert>
        )}
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ mt: 2, gap: 1.5 }}>
          {order.status === "pending_payment" && (
            <Button
              component={Link}
              href={`/payment-result?order=${encodeURIComponent(order.code)}`}
              variant="contained"
            >
              {t("checkPayment")}
            </Button>
          )}
          {order.canCancel && (
            <Button color="error" onClick={() => setConfirmOpen(true)} variant="outlined">
              {t("cancel")}
            </Button>
          )}
          {order.canStartNewOrder && (
            <Button component={Link} href="/menu" variant="contained">
              {t("startNewOrder")}
            </Button>
          )}
          <Button component={Link} href="/contact" variant="outlined">
            {t("contact")}
          </Button>
        </Stack>
        {!order.canCancel &&
          ["pending_payment", "confirmed", "preparing", "ready", "out_for_delivery"].includes(
            order.status,
          ) && (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              {t("cancelByContact")}
            </Typography>
          )}
      </Paper>

      <Dialog open={confirmOpen} onClose={() => !cancelling && setConfirmOpen(false)}>
        <DialogTitle>{t("confirmCancelTitle")}</DialogTitle>
        <DialogContent>{t("confirmCancelBody")}</DialogContent>
        <DialogActions>
          <Button disabled={cancelling} onClick={() => setConfirmOpen(false)}>
            {t("keepOrder")}
          </Button>
          <Button
            color="error"
            disabled={cancelling}
            onClick={() => {
              cancelOrder().catch(() => setCancelError(true));
            }}
          >
            {cancelling ? t("cancelling") : t("cancel")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function PriceRow({
  label,
  value,
  locale,
  strong = false,
}: {
  label: string;
  value: number;
  locale: SupportedLocale;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography sx={{ fontWeight: strong ? 700 : 400 }}>{label}</Typography>
      <Typography sx={{ fontWeight: strong ? 700 : 400 }}>
        {value < 0 ? `−${formatEuro(-value, locale)}` : formatEuro(value, locale)}
      </Typography>
    </Stack>
  );
}
