"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { isSupportedLocale } from "@/constants";
import { useCart, useCustomerAuth } from "@/hooks";
import { formatEuro } from "@/locales/formatters";

export function ReviewBridge() {
  const t = useTranslations("storefront.cartReviewBridge");
  const auth = useCustomerAuth();
  const { cart, status } = useCart();
  const requestedLocale = useLocale();
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : "en";
  const eligible =
    auth.authenticated &&
    Boolean(cart?.lines.length) &&
    cart?.availability.valid === true &&
    (cart.pickupConfirmed === true || Boolean(cart.selectedAddressId));

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 6 }}>
      <Typography component="h1" sx={{ mb: 3 }} variant="h2">
        {t("title")}
      </Typography>
      {!auth.ready || status === "loading" ? (
        <Skeleton height={250} variant="rounded" />
      ) : !eligible ? (
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Alert severity="warning">{t("selectionRequired")}</Alert>
            <Button component={NextLink} href="/cart/address" variant="contained">
              {t("backToAddress")}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography component="h2" variant="h5">
              {t("summary")}
            </Typography>
            <Typography>{t("itemCount", { count: cart.lines.length })}</Typography>
            <Typography variant="h5">{formatEuro(cart.pricing.totalCents, locale)}</Typography>
            <Alert severity="info">{t("paymentNotReady")}</Alert>
            <Button component={NextLink} href="/cart/address" variant="outlined">
              {t("backToAddress")}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
