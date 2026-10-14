"use client";

import AddLocationAltOutlined from "@mui/icons-material/AddLocationAltOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AddressEditor,
  DEFAULT_PORTO_POSITION,
  geoJsonPointFromLatLng,
  type AddressEditorValue,
} from "@/components/address";
import { EmptyState, ErrorState } from "@/components/ui";
import { isSupportedLocale } from "@/constants";
import { useCart, useCustomerAuth } from "@/hooks";
import { broadcastCartInvalidation } from "@/lib/cart-client";
import { formatEuro } from "@/locales/formatters";

type Address = AddressEditorValue & Readonly<{ id: string; version: number }>;
type Fulfillment = "delivery" | "pickup" | null;

const EMPTY_ADDRESS: AddressEditorValue = {
  name: "",
  recipientName: "",
  recipientMobile: "",
  formattedAddress: "",
  location: geoJsonPointFromLatLng(
    DEFAULT_PORTO_POSITION.latitude,
    DEFAULT_PORTO_POSITION.longitude,
  ),
  postalCode: "",
  deliveryNotes: null,
  isDefault: false,
};

function responseData(value: unknown): unknown {
  return typeof value === "object" && value !== null && "data" in value
    ? (value as { data: unknown }).data
    : null;
}

function parseAddress(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const location = item.location as { type?: unknown; coordinates?: unknown } | undefined;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.recipientName !== "string" ||
    typeof item.recipientMobile !== "string" ||
    typeof item.formattedAddress !== "string" ||
    typeof item.postalCode !== "string" ||
    !location ||
    location.type !== "Point" ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2 ||
    !location.coordinates.every((coordinate) => typeof coordinate === "number")
  )
    return null;
  return {
    id: item.id,
    version: typeof item.version === "number" ? item.version : 0,
    name: item.name,
    recipientName: item.recipientName,
    recipientMobile: item.recipientMobile,
    formattedAddress: item.formattedAddress,
    postalCode: item.postalCode,
    deliveryNotes: typeof item.deliveryNotes === "string" ? item.deliveryNotes : null,
    isDefault: item.isDefault === true,
    location: {
      type: "Point",
      coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
    },
  };
}

function validAddress(value: AddressEditorValue): boolean {
  return (
    value.name.trim().length > 0 &&
    value.recipientName.trim().length > 0 &&
    value.recipientMobile.trim().length >= 8 &&
    value.formattedAddress.trim().length >= 5 &&
    /^\d{4}-\d{3}$/u.test(value.postalCode.trim())
  );
}

function CheckoutProgress({ label }: Readonly<{ label: string }>) {
  return (
    <Stack aria-label={label} direction="row" role="list" sx={{ alignItems: "center" }}>
      {[1, 2, 3].map((step) => (
        <Box key={step} role="listitem" sx={{ alignItems: "center", display: "flex", flex: 1 }}>
          <Box
            aria-current={step === 2 ? "step" : undefined}
            sx={{
              alignItems: "center",
              bgcolor: step <= 2 ? "primary.main" : "action.disabledBackground",
              borderRadius: "50%",
              color: step <= 2 ? "primary.contrastText" : "text.secondary",
              display: "flex",
              fontWeight: 700,
              blockSize: 32,
              inlineSize: 32,
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {step}
          </Box>
          {step < 3 ? (
            <Box sx={{ bgcolor: step < 2 ? "primary.main" : "divider", blockSize: 2, flex: 1 }} />
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

export function CartStepTwo() {
  const t = useTranslations("storefront.cartAddress");
  const localeValue = useLocale();
  const locale = isSupportedLocale(localeValue) ? localeValue : "en";
  const auth = useCustomerAuth();
  const { cart, error: cartError, refresh, status: cartStatus } = useCart();
  const [addresses, setAddresses] = useState<readonly Address[]>([]);
  const [addressState, setAddressState] = useState<"idle" | "loading" | "error">("loading");
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [savingSelection, setSavingSelection] = useState(false);
  const [editor, setEditor] = useState<AddressEditorValue | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const loadAddresses = useCallback(async (signal?: AbortSignal, showLoading = true) => {
    if (showLoading) setAddressState("loading");
    try {
      const response = await fetch("/api/profile/addresses", {
        cache: "no-store",
        credentials: "same-origin",
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error("address_read_failed");
      const data = responseData(await response.json());
      const parsed = Array.isArray(data)
        ? (data.map(parseAddress).filter(Boolean) as Address[])
        : [];
      setAddresses(parsed);
      setAddressState("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAddressState("error");
    }
  }, []);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) return;
    const controller = new AbortController();
    fetch("/api/profile/addresses", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("address_read_failed");
        const data = responseData(await response.json());
        setAddresses(
          Array.isArray(data) ? (data.map(parseAddress).filter(Boolean) as Address[]) : [],
        );
        setAddressState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAddressState("error");
      });
    return () => controller.abort();
  }, [auth.authenticated, auth.ready]);

  const fulfillment: Fulfillment = cart?.selectedAddressId
    ? "delivery"
    : cart?.pickupConfirmed
      ? "pickup"
      : null;

  const selectedAddress = useMemo(
    () => addresses.find(({ id }) => id === cart?.selectedAddressId) ?? null,
    [addresses, cart?.selectedAddressId],
  );

  const selectFulfillment = async (method: Exclude<Fulfillment, null>, addressId?: string) => {
    if (!cart?.version) return;
    setSavingSelection(true);
    setSelectionError(null);
    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: cart.version,
          fulfillment: method === "delivery" ? { method, addressId } : { method },
        }),
      });
      if (!response.ok) {
        setSelectionError(response.status === 409 ? t("outsideArea") : t("selectionError"));
        return;
      }
      broadcastCartInvalidation();
      await refresh();
    } catch {
      setSelectionError(t("networkError"));
    } finally {
      setSavingSelection(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setEditor(EMPTY_ADDRESS);
    setAddressError(null);
    setLocationConfirmed(false);
  };
  const openEdit = (address: Address) => {
    setEditingId(address.id);
    setEditor(address);
    setAddressError(null);
    setLocationConfirmed(true);
  };
  const saveAddress = async () => {
    if (!editor || !validAddress(editor) || !locationConfirmed) {
      setAddressError(t("addressValidation"));
      return;
    }
    setSavingAddress(true);
    setAddressError(null);
    try {
      const payload = editingId
        ? {
            name: editor.name,
            recipientName: editor.recipientName,
            recipientMobile: editor.recipientMobile,
            formattedAddress: editor.formattedAddress,
            location: editor.location,
            postalCode: editor.postalCode,
            deliveryNotes: editor.deliveryNotes,
          }
        : editor;
      const response = await fetch(
        editingId
          ? `/api/profile/addresses/${encodeURIComponent(editingId)}`
          : "/api/profile/addresses",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error("address_write_failed");
      const saved = parseAddress(responseData(await response.json()));
      await loadAddresses();
      setEditor(null);
      await refresh();
      if (saved) await selectFulfillment("delivery", saved.id);
    } catch {
      setAddressError(t("addressSaveError"));
    } finally {
      setSavingAddress(false);
    }
  };

  const canContinue =
    Boolean(cart?.lines.length) &&
    cart?.availability.valid === true &&
    cartError === null &&
    ((fulfillment === "pickup" && cart.pickupConfirmed === true) ||
      (fulfillment === "delivery" && Boolean(cart.selectedAddressId) && Boolean(selectedAddress)));

  if (!auth.ready || cartStatus === "loading") {
    return (
      <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 3 }, py: 5 }}>
        <Skeleton height={52} width="45%" />
        <Skeleton height={320} sx={{ mt: 3 }} variant="rounded" />
      </Box>
    );
  }

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
      <Box sx={{ maxWidth: 620, mb: 5 }}>
        <CheckoutProgress label={t("progressLabel")} />
      </Box>

      {!auth.authenticated ? (
        <Paper sx={{ maxWidth: 680, mx: "auto", p: { xs: 4, sm: 6 }, textAlign: "center" }}>
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Typography component="h2" variant="h4">
              {t("signInTitle")}
            </Typography>
            <Typography color="text.secondary">{t("signInDescription")}</Typography>
            <Button
              component={NextLink}
              href="/login?returnTo=%2Fcart%2Faddress"
              variant="contained"
            >
              {t("signIn")}
            </Button>
          </Stack>
        </Paper>
      ) : cartError && !cart ? (
        <ErrorState
          action={
            <Button
              onClick={() => {
                refresh().catch(() => undefined);
              }}
            >
              {t("tryAgain")}
            </Button>
          }
          description={t("loadErrorDescription")}
          title={t("loadError")}
        />
      ) : !cart?.lines.length ? (
        <EmptyState
          action={
            <Button component={NextLink} href="/cart" variant="contained">
              {t("backToCart")}
            </Button>
          }
          description={t("emptyDescription")}
          title={t("emptyTitle")}
        />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 4,
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 360px" },
          }}
        >
          <Stack spacing={3}>
            {selectionError ? <Alert severity="error">{selectionError}</Alert> : null}
            {cartError ? <Alert severity="error">{t("cartChanged")}</Alert> : null}
            <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography component="h2" sx={{ mb: 2 }} variant="h5">
                {t("methodTitle")}
              </Typography>
              <Stack spacing={2}>
                <Paper
                  variant="outlined"
                  sx={{ borderColor: fulfillment === "pickup" ? "primary.main" : "divider", p: 2 }}
                >
                  <FormControlLabel
                    control={
                      <Radio
                        checked={fulfillment === "pickup"}
                        disabled={savingSelection}
                        onChange={() => {
                          selectFulfillment("pickup").catch(() => undefined);
                        }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <StorefrontOutlined color="primary" />
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{t("pickup")}</Typography>
                          <Typography color="text.secondary" variant="body2">
                            {t("pickupDescription")}
                          </Typography>
                        </Box>
                      </Stack>
                    }
                  />
                </Paper>
                <Paper
                  variant="outlined"
                  sx={{
                    borderColor: fulfillment === "delivery" ? "primary.main" : "divider",
                    p: 2,
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Radio checked={fulfillment === "delivery"} disabled />
                    <LocalShippingOutlined color="primary" />
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{t("delivery")}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {t("deliveryDescription")}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </Paper>

            <Paper sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 2 }}
              >
                <Box>
                  <Typography component="h2" variant="h5">
                    {t("savedAddresses")}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {t("savedDescription")}
                  </Typography>
                </Box>
                <Button onClick={openNew} startIcon={<AddLocationAltOutlined />} variant="outlined">
                  {t("newAddress")}
                </Button>
              </Stack>
              {addressState === "loading" ? (
                <Stack spacing={2}>
                  {[1, 2].map((item) => (
                    <Skeleton height={118} key={item} variant="rounded" />
                  ))}
                </Stack>
              ) : null}
              {addressState === "error" ? (
                <Alert
                  action={
                    <Button
                      color="inherit"
                      onClick={() => {
                        loadAddresses().catch(() => undefined);
                      }}
                      size="small"
                    >
                      {t("tryAgain")}
                    </Button>
                  }
                  severity="error"
                >
                  {t("addressLoadError")}
                </Alert>
              ) : null}
              {addressState === "idle" && addresses.length === 0 ? (
                <Alert severity="info">{t("noAddresses")}</Alert>
              ) : null}
              <Stack spacing={2}>
                {addresses.map((address) => {
                  const selected =
                    cart.selectedAddressId === address.id && fulfillment === "delivery";
                  return (
                    <Paper
                      key={address.id}
                      variant="outlined"
                      sx={{ borderColor: selected ? "primary.main" : "divider", p: 2 }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                        <Radio
                          checked={selected}
                          disabled={savingSelection}
                          slotProps={{
                            input: { "aria-label": t("selectAddress", { name: address.name }) },
                          }}
                          onChange={() => {
                            selectFulfillment("delivery", address.id).catch(() => undefined);
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography sx={{ fontWeight: 700 }}>{address.name}</Typography>
                            {address.isDefault ? (
                              <Chip label={t("defaultAddress")} size="small" />
                            ) : null}
                          </Stack>
                          <Typography>
                            {address.recipientName} · {address.recipientMobile}
                          </Typography>
                          <Typography color="text.secondary" variant="body2">
                            {address.formattedAddress}, {address.postalCode}
                          </Typography>
                        </Box>
                        <Button
                          aria-label={t("editAddress", { name: address.name })}
                          onClick={() => openEdit(address)}
                          size="small"
                          startIcon={<EditOutlined />}
                        >
                          {t("edit")}
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>
          </Stack>

          <Paper sx={{ alignSelf: "start", p: 3, position: { lg: "sticky" }, top: { lg: 96 } }}>
            <Typography component="h2" variant="h5">
              {t("summary")}
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={1.5} sx={{ my: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("subtotal")}</Typography>
                <Typography>{formatEuro(cart.pricing.subtotalCents, locale)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("discount")}</Typography>
                <Typography color="success.main">
                  −{formatEuro(cart.pricing.discountCents, locale)}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography color="text.secondary">{t("deliveryFee")}</Typography>
                <Typography>
                  {fulfillment
                    ? formatEuro(cart.pricing.deliveryFeeCents, locale)
                    : t("chooseMethod")}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700 }}>{t("total")}</Typography>
                <Typography sx={{ fontWeight: 800 }} variant="h6">
                  {formatEuro(cart.pricing.totalCents, locale)}
                </Typography>
              </Stack>
            </Stack>
            {fulfillment === "delivery" && selectedAddress ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                {t("eligible", { name: selectedAddress.name })}
              </Alert>
            ) : null}
            <Button
              aria-disabled={!canContinue || savingSelection}
              component={canContinue ? NextLink : "button"}
              disabled={!canContinue || savingSelection}
              fullWidth
              href={canContinue ? "/cart/review" : undefined}
              size="large"
              variant="contained"
            >
              {savingSelection ? <CircularProgress color="inherit" size={22} /> : t("continue")}
            </Button>
            <Button component={NextLink} fullWidth href="/cart" sx={{ mt: 1 }}>
              {t("back")}
            </Button>
          </Paper>
        </Box>
      )}

      <Dialog
        fullWidth
        maxWidth="md"
        onClose={() => !savingAddress && setEditor(null)}
        open={editor !== null}
      >
        <DialogTitle>{editingId ? t("editAddressTitle") : t("newAddressTitle")}</DialogTitle>
        <DialogContent dividers>
          {addressError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addressError}
            </Alert>
          ) : null}
          {editor ? (
            <AddressEditor
              disabled={savingAddress}
              idPrefix="checkout-address"
              onChange={(value) => {
                if (
                  value.location.coordinates[0] !== editor.location.coordinates[0] ||
                  value.location.coordinates[1] !== editor.location.coordinates[1]
                )
                  setLocationConfirmed(true);
                setEditor(value);
              }}
              value={editor}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button disabled={savingAddress} onClick={() => setEditor(null)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={savingAddress}
            onClick={() => {
              saveAddress().catch(() => undefined);
            }}
            variant="contained"
          >
            {savingAddress ? t("saving") : t("saveAddress")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
