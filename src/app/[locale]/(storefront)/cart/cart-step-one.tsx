"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import ShoppingBasketRounded from "@mui/icons-material/ShoppingBasketRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { EmptyState, ErrorState } from "@/components/ui";
import { isSupportedLocale } from "@/constants";
import { useCart } from "@/hooks";
import { formatEuro } from "@/locales/formatters";

type Recommendation = Readonly<{
  basePriceCents: number;
  effectivePriceCents: number;
  id: string;
  image: Readonly<{ alt: string; url: string }> | null;
  name: string;
  reason: "category" | "featured" | "related";
  slug: string;
}>;

function CartStepper() {
  const t = useTranslations("storefront.cart");
  return (
    <Stack
      aria-label={t("progressLabel")}
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center" }}
    >
      {[1, 2, 3].map((step) => (
        <Box key={step} sx={{ display: "contents" }}>
          {step > 1 ? (
            <Box sx={{ width: { xs: 14, sm: 28 }, height: 2, bgcolor: "divider" }} />
          ) : null}
          <Box
            aria-current={step === 1 ? "step" : undefined}
            sx={{
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              bgcolor: step === 1 ? "primary.main" : "action.hover",
              color: step === 1 ? "primary.contrastText" : "text.secondary",
              fontWeight: 800,
              boxShadow: step === 1 ? 3 : 0,
            }}
          >
            {step}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function CartLoading() {
  return (
    <Stack aria-busy="true" aria-label="Loading cart" role="status" spacing={3}>
      {[0, 1, 2].map((item) => (
        <Paper key={item} sx={{ p: 3, border: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={3}>
            <Skeleton height={112} variant="rounded" width={112} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="55%" />
              <Skeleton width="30%" />
              <Skeleton sx={{ mt: 3 }} width={132} />
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function DishImage({ image, name }: { image: Recommendation["image"]; name: string }) {
  return (
    <Box
      sx={{
        width: { xs: 88, sm: 112 },
        height: { xs: 88, sm: 112 },
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: 3,
        bgcolor: "action.hover",
        display: "grid",
        placeItems: "center",
      }}
    >
      {image ? (
        <Box
          alt={image.alt || name}
          component="img"
          loading="lazy"
          src={image.url}
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <LocalDiningRounded aria-hidden="true" color="disabled" sx={{ fontSize: 38 }} />
      )}
    </Box>
  );
}

function CartNotesEditor({
  serverNotes,
  save,
}: {
  serverNotes: string | null;
  save(notes: string | null): Promise<void>;
}) {
  const t = useTranslations("storefront.cart");
  const [notes, setNotes] = useState(serverNotes ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if ((serverNotes ?? "") === notes.trim()) return;
    setSaving(true);
    try {
      await save(notes.trim() || null);
    } catch {
      setNotes(serverNotes ?? "");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Paper sx={{ p: { xs: 4, sm: 5 }, border: "1px solid", borderColor: "divider" }}>
      <Typography component="h2" variant="h4">
        {t("notesTitle")}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
        {t("notesDescription")}
      </Typography>
      <TextField
        fullWidth
        multiline
        minRows={3}
        label={t("notesLabel")}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        sx={{ mt: 3 }}
        slotProps={{ htmlInput: { maxLength: 1000 } }}
      />
      <Stack direction="row" sx={{ mt: 2, justifyContent: "space-between", alignItems: "center" }}>
        <Typography color="text.secondary" variant="caption">
          {t("characters", { count: notes.length })}
        </Typography>
        <Button
          disabled={saving || notes.trim() === (serverNotes ?? "")}
          onClick={() => {
            submit().catch(() => undefined);
          }}
        >
          {saving ? t("saving") : t("saveNotes")}
        </Button>
      </Stack>
    </Paper>
  );
}

function CartRecommendations({ addItem }: { addItem(dishId: string): Promise<void> }) {
  const t = useTranslations("storefront.cart");
  const localeValue = useLocale();
  const locale = isSupportedLocale(localeValue) ? localeValue : "en";
  const [items, setItems] = useState<readonly Recommendation[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cart/recommendations", { cache: "no-store", signal: controller.signal })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { data?: { items?: Recommendation[] } }) : null,
      )
      .then((payload) => {
        if (!controller.signal.aborted) setItems(payload?.data?.items ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, []);
  if (items?.length === 0) return null;
  return (
    <Box component="section" aria-labelledby="cart-recommendations-title">
      <Typography component="h2" id="cart-recommendations-title" variant="h3">
        {t("recommendations")}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {t("recommendationsDescription")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          gap: 3,
        }}
      >
        {items === null
          ? [0, 1, 2, 3].map((item) => <Skeleton height={245} key={item} variant="rounded" />)
          : items.map((item) => (
              <Card key={item.id}>
                <DishImage image={item.image} name={item.name} />
                <CardContent sx={{ p: 3 }}>
                  <Chip label={t(`recommendationReason.${item.reason}`)} size="small" />
                  <Typography noWrap sx={{ mt: 2, fontWeight: 800 }}>
                    {item.name}
                  </Typography>
                  <Typography color="primary.dark" sx={{ mt: 1, fontWeight: 800 }}>
                    {formatEuro(item.effectivePriceCents, locale)}
                  </Typography>
                  <Button
                    fullWidth
                    size="small"
                    startIcon={<AddRounded />}
                    sx={{ mt: 2 }}
                    variant="outlined"
                    onClick={() => {
                      void addItem(item.id).catch(() => undefined);
                    }}
                  >
                    {t("add")}
                  </Button>
                </CardContent>
              </Card>
            ))}
      </Box>
    </Box>
  );
}

export function CartStepOne() {
  const t = useTranslations("storefront.cart");
  const localeValue = useLocale();
  const locale = isSupportedLocale(localeValue) ? localeValue : "en";
  const {
    addItem,
    cart,
    clearCart,
    clearError,
    error,
    pendingDishIds,
    refresh,
    removeItem,
    setNotes,
    status,
    updateQuantity,
  } = useCart();
  const [clearOpen, setClearOpen] = useState(false);
  const dishKey = useMemo(() => cart?.lines.map(({ dishId }) => dishId).join(",") ?? "", [cart]);
  const mutate = (work: Promise<void>) => {
    void work.catch(() => undefined);
  };

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "70vh", pb: { xs: 28, lg: 14 } }}>
      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{
            mb: 6,
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
          }}
        >
          <Box>
            <Typography color="primary.dark" sx={{ fontWeight: 800 }} variant="overline">
              {t("eyebrow")}
            </Typography>
            <Typography component="h1" variant="h1">
              {t("title")}
            </Typography>
          </Box>
          <CartStepper />
        </Stack>

        {status === "loading" && !cart ? <CartLoading /> : null}
        {status === "error" && !cart ? (
          <ErrorState
            action={
              <Button variant="contained" onClick={() => mutate(refresh())}>
                {t("tryAgain")}
              </Button>
            }
            description={t("loadErrorDescription")}
            title={t("loadError")}
          />
        ) : null}
        {status !== "loading" && !cart?.lines.length ? (
          <EmptyState
            action={
              <Button component={NextLink} href="/menu" variant="contained">
                {t("browseMenu")}
              </Button>
            }
            description={t("emptyDescription")}
            icon={<ShoppingBasketRounded fontSize="inherit" />}
            title={t("empty")}
          />
        ) : null}

        {cart?.lines.length ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 380px" },
              gap: 5,
              alignItems: "start",
            }}
          >
            <Stack spacing={4}>
              {error ? (
                <Alert severity="error" onClose={clearError}>
                  {t("mutationError")}
                </Alert>
              ) : null}
              {cart.pricingChanged ? <Alert severity="warning">{t("stalePrice")}</Alert> : null}
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                <Typography component="h2" variant="h3">
                  {t("items", { count: cart.lines.length })}
                </Typography>
                <Button
                  color="error"
                  startIcon={<DeleteOutlineRounded />}
                  onClick={() => setClearOpen(true)}
                >
                  {t("clear")}
                </Button>
              </Stack>

              {cart.lines.map((line) => {
                const pending = pendingDishIds.has(line.dishId);
                const available = line.availability?.available !== false;
                const name = line.name ?? t("unavailableItem");
                const maximum = Math.max(1, line.availability?.maxAllowedQuantity ?? 99);
                return (
                  <Card
                    key={line.dishId}
                    sx={{
                      overflow: "visible",
                      bgcolor: "rgba(var(--sara-palette-background-paperChannel) / 0.88)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        spacing={{ xs: 3, sm: 4 }}
                        sx={{ alignItems: "center" }}
                      >
                        <DishImage image={line.image} name={name} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{ justifyContent: "space-between" }}
                          >
                            <Box>
                              <Typography component="h3" noWrap sx={{ fontWeight: 800 }}>
                                {name}
                              </Typography>
                              {line.pricing ? (
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  sx={{ alignItems: "baseline", mt: 1 }}
                                >
                                  <Typography color="primary.dark" sx={{ fontWeight: 800 }}>
                                    {formatEuro(line.pricing.effectiveUnitPriceCents, locale)}
                                  </Typography>
                                  {line.pricing.baseUnitPriceCents >
                                  line.pricing.effectiveUnitPriceCents ? (
                                    <Typography
                                      color="text.secondary"
                                      sx={{ textDecoration: "line-through" }}
                                      variant="caption"
                                    >
                                      {formatEuro(line.pricing.baseUnitPriceCents, locale)}
                                    </Typography>
                                  ) : null}
                                </Stack>
                              ) : null}
                            </Box>
                            {line.pricing ? (
                              <Typography sx={{ fontWeight: 800 }}>
                                {formatEuro(line.pricing.lineSubtotalCents, locale)}
                              </Typography>
                            ) : null}
                          </Stack>
                          {!available ? (
                            <Alert severity="warning" sx={{ mt: 2, py: 0 }}>
                              {t(
                                `availability.${(line.availability?.issueCodes[0] ?? "dish_unavailable") as "dish_not_found" | "dish_not_active" | "dish_unavailable" | "dish_schedule_not_started" | "dish_schedule_ended" | "quantity_exceeds_limit" | "stock_unavailable" | "stock_insufficient" | "lead_time_changed" | "service_closed" | "order_cutoff_passed" | "delivery_address_unverified" | "outside_delivery_area"}`,
                              )}
                            </Alert>
                          ) : null}
                          <Stack
                            direction="row"
                            spacing={2}
                            sx={{ mt: 3, alignItems: "center", justifyContent: "space-between" }}
                          >
                            <Paper
                              variant="outlined"
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                borderRadius: 999,
                                p: 0.5,
                              }}
                            >
                              <IconButton
                                aria-label={t("decrease", { name })}
                                disabled={pending || line.quantity <= 1 || !available}
                                size="small"
                                onClick={() =>
                                  mutate(updateQuantity(line.dishId, line.quantity - 1))
                                }
                              >
                                <RemoveRounded fontSize="small" />
                              </IconButton>
                              <Typography
                                aria-live="polite"
                                component="span"
                                sx={{ minWidth: 36, textAlign: "center", fontWeight: 800 }}
                              >
                                {pending ? <CircularProgress size={16} /> : line.quantity}
                              </Typography>
                              <IconButton
                                aria-label={t("increase", { name })}
                                disabled={pending || line.quantity >= maximum || !available}
                                size="small"
                                onClick={() =>
                                  mutate(updateQuantity(line.dishId, line.quantity + 1))
                                }
                              >
                                <AddRounded fontSize="small" />
                              </IconButton>
                            </Paper>
                            <IconButton
                              aria-label={t("remove", { name })}
                              color="error"
                              disabled={pending}
                              onClick={() => mutate(removeItem(line.dishId))}
                            >
                              <DeleteOutlineRounded />
                            </IconButton>
                          </Stack>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}

              <CartNotesEditor
                key={cart.notes ?? "empty"}
                save={setNotes}
                serverNotes={cart.notes}
              />
              <CartRecommendations addItem={addItem} key={dishKey} />
            </Stack>

            <Paper
              component="aside"
              sx={{
                position: { lg: "sticky" },
                top: { lg: 96 },
                p: 5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                boxShadow: 3,
              }}
            >
              <Typography component="h2" variant="h3">
                {t("summary")}
              </Typography>
              <Stack spacing={2.5} sx={{ mt: 4 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography color="text.secondary">{t("subtotal")}</Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatEuro(cart.pricing.subtotalCents, locale)}
                  </Typography>
                </Stack>
                {cart.pricing.discountCents > 0 ? (
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography color="success.main">{t("discount")}</Typography>
                    <Typography color="success.main" sx={{ fontWeight: 700 }}>
                      −{formatEuro(cart.pricing.discountCents, locale)}
                    </Typography>
                  </Stack>
                ) : null}
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography color="text.secondary">{t("delivery")}</Typography>
                  <Typography color="success.main" sx={{ fontWeight: 700 }}>
                    {cart.pricing.deliveryFeeCents === 0
                      ? t("free")
                      : formatEuro(cart.pricing.deliveryFeeCents, locale)}
                  </Typography>
                </Stack>
                <Divider />
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "baseline" }}
                >
                  <Typography sx={{ fontWeight: 800 }} variant="h4">
                    {t("total")}
                  </Typography>
                  <Typography color="primary.dark" sx={{ fontWeight: 900 }} variant="h2">
                    {formatEuro(cart.pricing.totalCents, locale)}
                  </Typography>
                </Stack>
              </Stack>
              {cart.availability.orderLeadTimeMinutes > 0 ? (
                <Alert severity="info" sx={{ mt: 4 }}>
                  {t("leadTime", { minutes: cart.availability.orderLeadTimeMinutes })}
                </Alert>
              ) : null}
              <Button
                component={NextLink}
                disabled={!cart.availability.valid}
                endIcon={<ArrowForwardRounded />}
                fullWidth
                href="/cart/address"
                size="large"
                sx={{ mt: 4 }}
                variant="contained"
              >
                {t("checkout")}
              </Button>
              {!cart.availability.valid ? (
                <Typography color="error" sx={{ mt: 2, textAlign: "center" }} variant="caption">
                  {t("resolveAvailability")}
                </Typography>
              ) : null}
            </Paper>
          </Box>
        ) : null}
      </Container>

      <ConfirmationDialog
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        confirmLabel={t("confirmClear")}
        danger
        description={t("clearDescription")}
        loading={false}
        open={clearOpen}
        title={t("clearTitle")}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          void clearCart().catch(() => undefined);
        }}
      />
    </Box>
  );
}
