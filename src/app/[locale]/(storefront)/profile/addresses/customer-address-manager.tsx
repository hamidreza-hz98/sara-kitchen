"use client";

import AddLocationAltOutlined from "@mui/icons-material/AddLocationAltOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import StarRounded from "@mui/icons-material/StarRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { AddressEditor, type AddressEditorValue } from "@/components/address";
import { EmptyState } from "@/components/ui";
import { useCart } from "@/hooks";
import { broadcastCartInvalidation } from "@/lib/cart-client";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import {
  EMPTY_CUSTOMER_ADDRESS,
  parseCustomerAddress,
  responseData,
  validateCustomerAddress,
  type CustomerAddress,
} from "@/components/address/address-client";

type Eligibility = Readonly<{ id: string; eligible: boolean; distanceMeters: number }>;
type State = "loading" | "ready" | "error";
type Notice =
  | "saved"
  | "deleted"
  | "selectedDeleted"
  | "defaultSaved"
  | "conflict"
  | "saveError"
  | "deleteError"
  | "defaultError"
  | null;

function parseEligibility(value: unknown): Map<string, Eligibility> | null {
  const data = responseData(value);
  if (!Array.isArray(data)) return null;
  const entries: Eligibility[] = data.filter(
    (item): item is Eligibility =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.eligible === "boolean" &&
      typeof item.distanceMeters === "number" &&
      Number.isFinite(item.distanceMeters),
  );
  return new Map(entries.map((item) => [item.id, item]));
}

export function CustomerAddressManager() {
  const t = useTranslations("profile.addressesManager");
  const { cart, refresh: refreshCart, status: cartStatus } = useCart();
  const [addresses, setAddresses] = useState<readonly CustomerAddress[]>([]);
  const [eligibility, setEligibility] = useState<Map<string, Eligibility> | null>(null);
  const [state, setState] = useState<State>("loading");
  const [editor, setEditor] = useState<AddressEditorValue | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/profile/addresses", {
        cache: "no-store",
        credentials: "same-origin",
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error("addresses_unavailable");
      const data = responseData(await response.json());
      if (!Array.isArray(data)) throw new Error("invalid_addresses_response");
      setAddresses(
        data.map(parseCustomerAddress).filter((item): item is CustomerAddress => item !== null),
      );
      setState("ready");
      try {
        const eligibilityResponse = await fetch("/api/profile/addresses/eligibility", {
          cache: "no-store",
          credentials: "same-origin",
          ...(signal ? { signal } : {}),
        });
        setEligibility(
          eligibilityResponse.ok ? parseEligibility(await eligibilityResponse.json()) : null,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEligibility(null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile/addresses", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("addresses_unavailable");
        const data = responseData(await response.json());
        if (!Array.isArray(data)) throw new Error("invalid_addresses_response");
        setAddresses(
          data.map(parseCustomerAddress).filter((item): item is CustomerAddress => item !== null),
        );
        setState("ready");
        try {
          const eligibilityResponse = await fetch("/api/profile/addresses/eligibility", {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          });
          setEligibility(
            eligibilityResponse.ok ? parseEligibility(await eligibilityResponse.json()) : null,
          );
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setEligibility(null);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, []);

  function openNew() {
    setEditingId(null);
    setEditor(EMPTY_CUSTOMER_ADDRESS);
    setLocationConfirmed(false);
    setEditorError(null);
    setNotice(null);
  }

  function openEdit(address: CustomerAddress) {
    setEditingId(address.id);
    setEditor(address);
    setLocationConfirmed(true);
    setEditorError(null);
    setNotice(null);
  }

  async function saveAddress() {
    if (!editor || pending) return;
    if (!validateCustomerAddress(editor) || !locationConfirmed) {
      setEditorError(t("validation"));
      return;
    }
    setPending(true);
    setEditorError(null);
    try {
      const payload = {
        name: editor.name,
        recipientName: editor.recipientName,
        recipientMobile: editor.recipientMobile,
        formattedAddress: editor.formattedAddress,
        location: editor.location,
        postalCode: editor.postalCode,
        deliveryNotes: editor.deliveryNotes,
        ...(editingId ? {} : { isDefault: editor.isDefault }),
      };
      const response = await fetch(
        editingId
          ? `/api/profile/addresses/${encodeURIComponent(editingId)}`
          : "/api/profile/addresses",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("customer"),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setEditorError(t(response.status === 409 ? "conflict" : "saveError"));
        return;
      }
      setEditor(null);
      setNotice("saved");
      await load();
      broadcastCartInvalidation();
      await refreshCart().catch(() => undefined);
    } catch {
      setEditorError(t("saveError"));
    } finally {
      setPending(false);
    }
  }

  async function makeDefault(address: CustomerAddress) {
    if (pending || address.isDefault) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/profile/addresses/${encodeURIComponent(address.id)}/default`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("customer"),
          body: "{}",
        },
      );
      if (!response.ok) {
        setNotice(response.status === 409 ? "conflict" : "defaultError");
        return;
      }
      setNotice("defaultSaved");
      await load();
    } catch {
      setNotice("defaultError");
    } finally {
      setPending(false);
    }
  }

  async function removeAddress() {
    if (!deleting || pending || cartStatus === "loading") return;
    const referencedByCart = cart?.selectedAddressId === deleting.id;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/profile/addresses/${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("customer"),
        body: "{}",
      });
      if (!response.ok) {
        setNotice(response.status === 409 ? "conflict" : "deleteError");
        return;
      }
      setDeleting(null);
      setNotice(referencedByCart ? "selectedDeleted" : "deleted");
      await load();
      broadcastCartInvalidation();
      await refreshCart().catch(() => undefined);
    } catch {
      setNotice("deleteError");
    } finally {
      setPending(false);
    }
  }

  const deletingSelected = deleting !== null && cart?.selectedAddressId === deleting.id;
  return (
    <Stack spacing={3} sx={{ maxWidth: 980 }}>
      <Box>
        <Typography component="h1" variant="h2">
          {t("title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("intro")}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={openNew} startIcon={<AddLocationAltOutlined />} variant="contained">
          {t("add")}
        </Button>
      </Box>
      {notice && (
        <Alert
          role="status"
          severity={
            ["saved", "deleted", "selectedDeleted", "defaultSaved"].includes(notice)
              ? "success"
              : "error"
          }
        >
          {t(notice)}
        </Alert>
      )}
      {state === "loading" && (
        <Stack spacing={2} aria-busy="true">
          <Skeleton height={150} variant="rounded" />
          <Skeleton height={150} variant="rounded" />
        </Stack>
      )}
      {state === "error" && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={() => {
                load().catch(() => undefined);
              }}
            >
              {t("retry")}
            </Button>
          }
        >
          {t("loadError")}
        </Alert>
      )}
      {state === "ready" && addresses.length === 0 && (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button onClick={openNew} variant="outlined">
              {t("add")}
            </Button>
          }
        />
      )}
      {state === "ready" && addresses.length > 0 && (
        <Stack spacing={2} component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {addresses.map((address) => {
            const decision = eligibility?.get(address.id);
            return (
              <Paper
                component="li"
                key={address.id}
                variant="outlined"
                sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 3 }}
              >
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1 }}
                  >
                    <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Typography component="h2" variant="h6">
                        {address.name}
                      </Typography>
                      {address.isDefault && (
                        <Chip color="primary" label={t("default")} size="small" />
                      )}
                      {cart?.selectedAddressId === address.id && (
                        <Chip label={t("inCart")} size="small" variant="outlined" />
                      )}
                    </Stack>
                    <Chip
                      color={decision?.eligible ? "success" : decision ? "warning" : "default"}
                      label={
                        decision
                          ? decision.eligible
                            ? t("eligible")
                            : t("outsideArea")
                          : t("eligibilityUnknown")
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography>
                    {address.recipientName} · {address.recipientMobile}
                  </Typography>
                  <Typography color="text.secondary">
                    {address.formattedAddress}, {address.postalCode}
                  </Typography>
                  {address.deliveryNotes && (
                    <Typography color="text.secondary" variant="body2">
                      {address.deliveryNotes}
                    </Typography>
                  )}
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                    <Button
                      aria-label={t("editNamed", { name: address.name })}
                      onClick={() => openEdit(address)}
                      size="small"
                      startIcon={<EditOutlined />}
                    >
                      {t("edit")}
                    </Button>
                    {!address.isDefault && (
                      <Button
                        aria-label={t("defaultNamed", { name: address.name })}
                        disabled={pending}
                        onClick={() => {
                          makeDefault(address).catch(() => setNotice("defaultError"));
                        }}
                        size="small"
                        startIcon={<StarRounded />}
                      >
                        {t("makeDefault")}
                      </Button>
                    )}
                    <Button
                      aria-label={t("deleteNamed", { name: address.name })}
                      color="error"
                      disabled={pending}
                      onClick={() => setDeleting(address)}
                      size="small"
                      startIcon={<DeleteOutlineRounded />}
                    >
                      {t("delete")}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
      <Typography color="text.secondary" variant="body2">
        {t("eligibilityNote")}
      </Typography>

      <Dialog
        fullWidth
        maxWidth="md"
        open={editor !== null}
        onClose={() => {
          if (!pending) setEditor(null);
        }}
      >
        <DialogTitle>{editingId ? t("editTitle") : t("addTitle")}</DialogTitle>
        <DialogContent dividers>
          {editor && (
            <Stack spacing={2}>
              {editorError && (
                <Alert severity="error" role="alert">
                  {editorError}
                </Alert>
              )}
              <AddressEditor
                disabled={pending}
                idPrefix="profile-address"
                value={editor}
                onChange={(value) => {
                  if (
                    value.location.coordinates[0] !== editor.location.coordinates[0] ||
                    value.location.coordinates[1] !== editor.location.coordinates[1]
                  )
                    setLocationConfirmed(true);
                  setEditor(value);
                  setEditorError(null);
                }}
              />
              {!locationConfirmed && <Alert severity="info">{t("pinRequired")}</Alert>}
              {!locationConfirmed && (
                <Button onClick={() => setLocationConfirmed(true)} variant="outlined">
                  {t("confirmPin")}
                </Button>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setEditor(null)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              saveAddress().catch(() => setEditorError(t("saveError")));
            }}
            variant="contained"
          >
            {pending ? <CircularProgress size={20} /> : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => {
          if (!pending) setDeleting(null);
        }}
        aria-labelledby="delete-address-title"
      >
        <DialogTitle id="delete-address-title">{t("deleteTitle")}</DialogTitle>
        <DialogContent>
          <Typography>{deleting ? t("deleteConfirm", { name: deleting.name }) : ""}</Typography>
          {deletingSelected && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t("cartWarning")}
            </Alert>
          )}
          {cartStatus !== "ready" && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t("cartUnknown")}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setDeleting(null)}>
            {t("cancel")}
          </Button>
          <Button
            color="error"
            disabled={pending || cartStatus === "loading"}
            onClick={() => {
              removeAddress().catch(() => setNotice("deleteError"));
            }}
            variant="contained"
          >
            {pending ? <CircularProgress size={20} /> : t("confirmDelete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
