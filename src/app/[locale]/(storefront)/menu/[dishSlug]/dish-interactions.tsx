"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackIosNewRounded from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRounded from "@mui/icons-material/ArrowForwardIosRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";

import { isRtlLocale, type SupportedLocale } from "@/constants";
import { useCart } from "@/hooks";
import { formatEuro, formatNumber } from "@/locales/formatters";

import type { DishDetailContent, DishDetailImage } from "./dish-detail-content";

export function DishGallery({
  images,
  name,
}: {
  images: readonly DishDetailImage[];
  name: string;
}) {
  const t = useTranslations("storefront.dishDetail");
  const rtl = isRtlLocale(useLocale() as SupportedLocale);
  const [selected, setSelected] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const current = images[selected] ?? null;
  const move = (step: number) =>
    setSelected((index) => (index + step + images.length) % images.length);
  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (images.length < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(rtl ? 1 : -1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(rtl ? -1 : 1);
    }
  };
  return (
    <Box component="section" aria-label={t("gallery")} onKeyDown={handleKeys}>
      <Paper variant="outlined" sx={{ position: "relative", overflow: "hidden", borderRadius: 4 }}>
        {current ? (
          <ButtonBase
            onClick={() => setFullscreen(true)}
            aria-label={t("openImage", { name, count: selected + 1 })}
            sx={{ display: "block", width: "100%" }}
          >
            <Box
              component="img"
              src={current.url}
              alt={current.alt}
              decoding="async"
              fetchPriority="high"
              sx={{
                display: "block",
                width: "100%",
                height: { xs: 310, sm: 430, md: 500 },
                objectFit: "cover",
              }}
            />
          </ButtonBase>
        ) : (
          <Box
            role="img"
            aria-label={t("noImage", { name })}
            sx={{
              height: { xs: 310, sm: 430, md: 500 },
              background: "linear-gradient(135deg, #ffe8df, #fff8ef 55%, #e1f1e7)",
            }}
          />
        )}
        {images.length > 1 && (
          <>
            <IconButton
              aria-label={t("previousImage")}
              onClick={() => move(-1)}
              sx={{
                position: "absolute",
                insetInlineStart: 12,
                top: "50%",
                transform: "translateY(-50%)",
                bgcolor: "background.paper",
              }}
            >
              <ArrowBackIosNewRounded sx={{ transform: rtl ? "rotate(180deg)" : undefined }} />
            </IconButton>
            <IconButton
              aria-label={t("nextImage")}
              onClick={() => move(1)}
              sx={{
                position: "absolute",
                insetInlineEnd: 12,
                top: "50%",
                transform: "translateY(-50%)",
                bgcolor: "background.paper",
              }}
            >
              <ArrowForwardIosRounded sx={{ transform: rtl ? "rotate(180deg)" : undefined }} />
            </IconButton>
          </>
        )}
      </Paper>
      {images.length > 0 && (
        <Typography
          aria-live="polite"
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {t("imageCount", { current: selected + 1, total: images.length })}
        </Typography>
      )}
      {images.length > 1 && (
        <Box sx={{ display: "flex", gap: 1.5, overflowX: "auto", mt: 2, pb: 1 }}>
          {images.map((image, index) => (
            <ButtonBase
              key={`${image.url}-${index}`}
              onClick={() => setSelected(index)}
              aria-label={t("chooseImage", { count: index + 1 })}
              aria-pressed={index === selected}
              sx={{
                flex: "0 0 88px",
                height: 76,
                borderRadius: 2,
                overflow: "hidden",
                border: index === selected ? "3px solid" : "1px solid",
                borderColor: index === selected ? "primary.main" : "divider",
              }}
            >
              <Box
                component="img"
                src={image.url}
                alt=""
                loading="lazy"
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </ButtonBase>
          ))}
        </Box>
      )}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="dish-fullscreen-title"
      >
        <DialogTitle id="dish-fullscreen-title">{t("fullscreenGallery")}</DialogTitle>
        <Box onKeyDown={handleKeys} sx={{ p: 1, position: "relative", textAlign: "center" }}>
          <Button
            onClick={() => setFullscreen(false)}
            sx={{
              position: "absolute",
              top: 8,
              insetInlineEnd: 8,
              bgcolor: "background.paper",
              zIndex: 1,
            }}
          >
            {t("close")}
          </Button>
          {current && (
            <Box
              component="img"
              src={current.url}
              alt={current.alt}
              sx={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
            />
          )}
          {images.length > 1 && (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Button onClick={() => move(-1)}>{t("previousImage")}</Button>
              <Button onClick={() => move(1)}>{t("nextImage")}</Button>
            </Stack>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}

export function DishPurchase({
  dish,
}: {
  dish: Pick<
    DishDetailContent,
    | "id"
    | "name"
    | "excerpt"
    | "priceCents"
    | "basePriceCents"
    | "discount"
    | "isOrderable"
    | "leadTimeMinutes"
    | "maxQuantity"
    | "portion"
  >;
}) {
  const t = useTranslations("storefront.dishDetail");
  const locale = useLocale() as SupportedLocale;
  const { addItem, pendingDishIds } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const pending = busy || pendingDishIds.has(dish.id);
  const add = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await addItem(dish.id, quantity);
      setFeedback("success");
    } catch {
      setFeedback("error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={2.5} sx={{ alignItems: "flex-start" }}>
      <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
        {dish.name}
      </Typography>
      {dish.excerpt && <Typography color="text.secondary">{dish.excerpt}</Typography>}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
        <Typography color="primary" variant="h4" sx={{ fontWeight: 800 }}>
          {formatEuro(dish.priceCents, locale)}
        </Typography>
        {dish.basePriceCents > dish.priceCents && (
          <Typography component="s" color="text.secondary">
            {formatEuro(dish.basePriceCents, locale)}
          </Typography>
        )}
      </Stack>
      {dish.discount && (
        <Typography color="primary.dark" variant="body2">
          {dish.discount.percentage !== null
            ? t("discountPercent", { percent: formatNumber(dish.discount.percentage, locale) })
            : t("discountAmount", { amount: formatEuro(dish.discount.amountCents, locale) })}
        </Typography>
      )}
      <Typography color={dish.isOrderable ? "success.main" : "error.main"} sx={{ fontWeight: 700 }}>
        {dish.isOrderable ? t("available") : t("unavailable")}
      </Typography>
      <Typography color="text.secondary">
        {t("leadTime", { minutes: formatNumber(dish.leadTimeMinutes, locale) })}
      </Typography>
      <Typography color="text.secondary">
        {t("portion", {
          amount: formatNumber(dish.portion.amount, locale),
          unit: t(
            `portionUnit.${dish.portion.unit as "serving" | "piece" | "gram" | "millilitre"}`,
          ),
        })}
      </Typography>
      {dish.isOrderable && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <IconButton
            aria-label={t("decreaseQuantity")}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={quantity <= 1 || pending}
          >
            <RemoveRounded />
          </IconButton>
          <Typography aria-live="polite" sx={{ minWidth: 32, textAlign: "center" }}>
            {formatNumber(quantity, locale)}
          </Typography>
          <IconButton
            aria-label={t("increaseQuantity")}
            onClick={() => setQuantity((value) => Math.min(dish.maxQuantity, value + 1))}
            disabled={quantity >= dish.maxQuantity || pending}
          >
            <AddRounded />
          </IconButton>
        </Stack>
      )}
      <Button
        variant="contained"
        size="large"
        startIcon={<ShoppingCartRounded />}
        disabled={!dish.isOrderable || pending}
        onClick={() => {
          void add().catch(() => undefined);
        }}
        sx={{ width: { xs: "100%", sm: "auto" }, minWidth: 220 }}
      >
        {pending ? t("adding") : t("addToCart")}
      </Button>
      {feedback && (
        <Alert severity={feedback} role="status">
          {feedback === "success" ? t("addedToCart") : t("addError")}
        </Alert>
      )}
    </Stack>
  );
}
