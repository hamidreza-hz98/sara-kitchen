"use client";

import LocalDiningOutlined from "@mui/icons-material/LocalDiningOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { RichContent } from "@/components/ui";
import { isSupportedLocale } from "@/constants";
import { useCart, useCustomerAuth } from "@/hooks";
import {
  canSubmitCheckout,
  checkoutIdempotencyKey,
  type CheckoutReviewData,
  type CheckoutReviewPolicy,
} from "@/lib/checkout-client";
import { formatDateTime, formatEuro } from "@/locales/formatters";
import { useRouter } from "@/locales/navigation";

async function loadReview(signal?: AbortSignal): Promise<CheckoutReviewData> {
  const response = await fetch("/api/checkout/review", {
    cache: "no-store",
    credentials: "same-origin",
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error("review_unavailable");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("data" in body)) throw new Error("review_invalid");
  return (body as { data: CheckoutReviewData }).data;
}

function Progress({ label }: Readonly<{ label: string }>) {
  return (
    <Stack
      aria-label={label}
      direction="row"
      role="list"
      sx={{ alignItems: "center", mb: 4, maxWidth: 620 }}
    >
      {[1, 2, 3].map((step) => (
        <Box key={step} role="listitem" sx={{ alignItems: "center", display: "flex", flex: 1 }}>
          <Box
            aria-current={step === 3 ? "step" : undefined}
            sx={{
              bgcolor: "primary.main",
              borderRadius: "50%",
              color: "primary.contrastText",
              display: "grid",
              fontWeight: 800,
              blockSize: 34,
              inlineSize: 34,
              placeItems: "center",
              boxShadow: step === 3 ? 3 : 0,
            }}
          >
            {step}
          </Box>
          {step < 3 ? <Box sx={{ bgcolor: "primary.main", blockSize: 2, flex: 1 }} /> : null}
        </Box>
      ))}
    </Stack>
  );
}

export function ReviewBridge() {
  const t = useTranslations("storefront.cartReviewBridge");
  const localeValue = useLocale();
  const locale = isSupportedLocale(localeValue) ? localeValue : "en";
  const auth = useCustomerAuth();
  const { cart: providerCart, refresh } = useCart();
  const router = useRouter();
  const [review, setReview] = useState<CheckoutReviewData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | null>(null);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [openPolicy, setOpenPolicy] = useState<CheckoutReviewPolicy | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) return;
    const controller = new AbortController();
    loadReview(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setReview(value);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [auth.ready, auth.authenticated, providerCart?.version]);

  const reload = async (clearError = true) => {
    setStatus("loading");
    try {
      setReview(await loadReview());
      setStatus("ready");
      if (clearError) setError(null);
    } catch {
      setStatus("error");
    }
  };
  const cart = review?.cart ?? null;
  const terms =
    review?.policies.find((policy) => policy.documentType === "terms-of-service") ?? null;
  const privacy =
    review?.policies.find((policy) => policy.documentType === "privacy-policy") ?? null;
  const selectionReady = Boolean(
    cart?.lines.length &&
    cart.availability.valid &&
    (cart.pickupConfirmed ||
      (cart.selectedAddressId && review?.address?.id === cart.selectedAddressId)),
  );
  const stale = Boolean(
    providerCart?.version && cart?.version && providerCart.version !== cart.version,
  );
  const canSubmit =
    !stale &&
    Boolean(terms && privacy) &&
    canSubmitCheckout({
      cart,
      addressPresent: Boolean(review?.address),
      acceptedTerms,
      acceptedPrivacy,
      paymentMethod,
      paymentPhone,
      submissionAvailable:
        review?.submissionAvailable === true &&
        review.paymentMethods.some((method) => method.type === "mbway" && method.enabled),
      pending,
    });

  const submit = async () => {
    if (!canSubmit || !cart?.id || !cart.version || !terms || !privacy || submitLock.current)
      return;
    submitLock.current = true;
    setPending(true);
    setError(null);
    try {
      const latest = await loadReview();
      if (
        latest.cart?.id !== cart.id ||
        latest.cart.version !== cart.version ||
        latest.cart.pricing.totalCents !== cart.pricing.totalCents ||
        latest.cart.availability.valid !== true ||
        latest.cart.selectedAddressId !== cart.selectedAddressId ||
        latest.cart.pickupConfirmed !== cart.pickupConfirmed ||
        latest.policies.find((policy) => policy.documentType === "terms-of-service")?.id !==
          terms.id ||
        latest.policies.find((policy) => policy.documentType === "privacy-policy")?.id !==
          privacy.id
      ) {
        setReview(latest);
        setAcceptedTerms(false);
        setAcceptedPrivacy(false);
        setError(t("reviewChanged"));
        await refresh();
        return;
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": checkoutIdempotencyKey(cart.id, cart.version),
        },
        body: JSON.stringify({
          expectedCartVersion: cart.version,
          paymentMethod: "mbway",
          paymentPhone: paymentPhone.trim(),
          acceptedPolicies: [
            { id: terms.id, version: terms.version },
            { id: privacy.id, version: privacy.version },
          ],
        }),
      });
      if (!response.ok) {
        setError(response.status === 409 ? t("reviewChanged") : t("submitFailed"));
        await reload(false);
        return;
      }
      const body: unknown = await response.json();
      const data =
        body && typeof body === "object" && "data" in body
          ? (body as { data?: { orderCode?: string } }).data
          : null;
      if (!data?.orderCode) throw new Error("checkout_response_invalid");
      router.push(`/payment-result?order=${encodeURIComponent(data.orderCode)}`);
    } catch {
      setError(t("networkError"));
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 4, md: 6 } }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography color="primary.dark" sx={{ fontWeight: 700 }} variant="overline">
          {t("eyebrow")}
        </Typography>
        <Typography component="h1" variant="h2">
          {t("title")}
        </Typography>
        <Typography color="text.secondary">{t("description")}</Typography>
      </Stack>
      <Progress label={t("progressLabel")} />
      {!auth.ready || (auth.authenticated && status === "loading") ? (
        <Stack spacing={2}>
          <Skeleton height={180} variant="rounded" />
          <Skeleton height={260} variant="rounded" />
        </Stack>
      ) : !auth.authenticated ? (
        <Paper sx={{ p: 4 }}>
          <Alert severity="warning">{t("signInRequired")}</Alert>
          <Button component={NextLink} href="/login?returnTo=%2Fcart%2Faddress" sx={{ mt: 2 }}>
            {t("signIn")}
          </Button>
        </Paper>
      ) : status === "error" ? (
        <Paper sx={{ p: 4 }}>
          <Alert severity="error">{t("loadError")}</Alert>
          <Button
            onClick={() => {
              reload().catch(() => undefined);
            }}
            sx={{ mt: 2 }}
          >
            {t("tryAgain")}
          </Button>
        </Paper>
      ) : !selectionReady ? (
        <Paper sx={{ p: 4 }}>
          <Alert severity="warning">{t("selectionRequired")}</Alert>
          <Button component={NextLink} href="/cart/address" sx={{ mt: 2 }} variant="contained">
            {t("backToAddress")}
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 4,
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 350px" },
          }}
        >
          <Stack spacing={3}>
            {stale ? (
              <Alert
                action={
                  <Button
                    color="inherit"
                    onClick={() => {
                      reload().catch(() => undefined);
                    }}
                  >
                    {t("refresh")}
                  </Button>
                }
                severity="warning"
              >
                {t("reviewChanged")}
              </Alert>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Paper component="section" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography component="h2" sx={{ mb: 2 }} variant="h5">
                {t("itemsTitle")}
              </Typography>
              <Stack divider={<Divider flexItem />} spacing={2}>
                {cart?.lines.map((line) => (
                  <Stack
                    key={line.dishId}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center", minWidth: 0 }}
                  >
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {line.image ? (
                        <Box
                          alt={line.image.alt || line.name || ""}
                          component="img"
                          src={line.image.url}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <LocalDiningOutlined color="disabled" />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                        {line.name ?? t("dishFallback")}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {t("quantity", { count: line.quantity })}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {formatEuro(line.pricing?.lineSubtotalCents ?? 0, locale)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              {cart?.notes ? (
                <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
                  {t("notes", { value: cart.notes })}
                </Typography>
              ) : null}
              <Button component={NextLink} href="/cart" sx={{ mt: 2 }}>
                {t("editCart")}
              </Button>
            </Paper>
            <Paper component="section" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography component="h2" sx={{ mb: 2 }} variant="h5">
                {cart?.pickupConfirmed ? t("pickupTitle") : t("deliveryTitle")}
              </Typography>
              {cart?.pickupConfirmed ? (
                <Typography>{t("pickupDescription")}</Typography>
              ) : (
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 700 }}>{review?.address?.recipientName}</Typography>
                  <Typography>
                    {review?.address?.formattedAddress}, {review?.address?.postalCode}
                  </Typography>
                  <Typography color="text.secondary">{review?.address?.recipientMobile}</Typography>
                </Stack>
              )}
              {cart?.availability.earliestReadyAt ? (
                <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
                  {t("earliestReady", {
                    time: formatDateTime(Date.parse(cart.availability.earliestReadyAt), locale),
                  })}
                </Typography>
              ) : null}
              <Button component={NextLink} href="/cart/address" sx={{ mt: 2 }}>
                {t("changeFulfillment")}
              </Button>
            </Paper>
            <Paper component="section" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography component="h2" sx={{ mb: 2 }} variant="h5">
                {t("paymentTitle")}
              </Typography>
              <FormControlLabel
                control={
                  <Radio
                    checked={paymentMethod === "mbway"}
                    onChange={() => setPaymentMethod("mbway")}
                  />
                }
                label={t("mbway")}
              />
              <TextField
                autoComplete="tel"
                fullWidth
                inputMode="tel"
                label={t("mbwayPhone")}
                onChange={(event) => setPaymentPhone(event.target.value)}
                placeholder="+351912345678"
                sx={{ mt: 2 }}
                value={paymentPhone}
              />
              {paymentPhone && !/^\+3519\d{8}$/u.test(paymentPhone.trim()) ? (
                <Typography color="error" sx={{ mt: 1 }} variant="body2">
                  {t("phoneInvalid")}
                </Typography>
              ) : null}
              <Alert severity="info" sx={{ mt: 2 }}>
                {t("providerPending")}
              </Alert>
            </Paper>
            <Paper component="section" sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography component="h2" sx={{ mb: 1 }} variant="h5">
                {t("policiesTitle")}
              </Typography>
              {!terms || !privacy ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t("policiesUnavailable")}
                </Alert>
              ) : null}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedTerms}
                    disabled={!terms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                  />
                }
                label={t("acceptTerms")}
              />
              {terms ? (
                <Button onClick={() => setOpenPolicy(terms)} size="small">
                  {t("readPolicy", { title: terms.title, version: terms.version })}
                </Button>
              ) : null}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acceptedPrivacy}
                    disabled={!privacy}
                    onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                  />
                }
                label={t("acceptPrivacy")}
              />
              {privacy ? (
                <Button onClick={() => setOpenPolicy(privacy)} size="small">
                  {t("readPolicy", { title: privacy.title, version: privacy.version })}
                </Button>
              ) : null}
            </Paper>
          </Stack>
          <Paper sx={{ alignSelf: "start", p: 3, position: { lg: "sticky" }, top: { lg: 96 } }}>
            <Typography component="h2" variant="h5">
              {t("summary")}
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={1.5} sx={{ my: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("subtotal")}</Typography>
                <Typography>{formatEuro(cart?.pricing.subtotalCents ?? 0, locale)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("discount")}</Typography>
                <Typography>−{formatEuro(cart?.pricing.discountCents ?? 0, locale)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("deliveryFee")}</Typography>
                <Typography>{formatEuro(cart?.pricing.deliveryFeeCents ?? 0, locale)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("tax")}</Typography>
                <Typography>{formatEuro(cart?.pricing.taxCents ?? 0, locale)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 800 }}>{t("total")}</Typography>
                <Typography component="p" sx={{ fontWeight: 800 }} variant="h6">
                  {formatEuro(cart?.pricing.totalCents ?? 0, locale)}
                </Typography>
              </Stack>
            </Stack>
            <Button
              disabled={!canSubmit}
              fullWidth
              onClick={() => {
                submit().catch(() => undefined);
              }}
              size="large"
              startIcon={
                pending ? <CircularProgress color="inherit" size={20} /> : <LockOutlined />
              }
              variant="contained"
            >
              {pending ? t("submitting") : t("placeOrder")}
            </Button>
            {!review?.submissionAvailable ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t("checkoutPending")}
              </Alert>
            ) : null}
            <Button component={NextLink} fullWidth href="/cart/address" sx={{ mt: 1 }}>
              {t("backToAddress")}
            </Button>
          </Paper>
        </Box>
      )}
      <Dialog
        fullWidth
        maxWidth="md"
        onClose={() => setOpenPolicy(null)}
        open={openPolicy !== null}
      >
        <DialogTitle>{openPolicy?.title}</DialogTitle>
        <DialogContent dividers>
          {openPolicy?.summary ? (
            <Typography sx={{ mb: 2 }}>{openPolicy.summary}</Typography>
          ) : null}
          {openPolicy?.sections.map((section) => (
            <Box key={section.id} sx={{ mb: 3 }}>
              <Typography component="h3" sx={{ mb: 1 }} variant="h6">
                {section.title}
              </Typography>
              <RichContent content={section.content} />
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
