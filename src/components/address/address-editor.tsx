"use client";

import MyLocationOutlined from "@mui/icons-material/MyLocationOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormField } from "@/components/ui";

import type { AddressMapPosition } from "./address-map";

const AddressMap = dynamic(() => import("./address-map").then((module) => module.AddressMap), {
  ssr: false,
  loading: () => (
    <Box
      aria-busy="true"
      sx={{
        alignItems: "center",
        blockSize: { xs: 280, md: 360 },
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <CircularProgress size={28} />
    </Box>
  ),
});

export const DEFAULT_PORTO_POSITION: AddressMapPosition = {
  latitude: 41.1579,
  longitude: -8.6291,
};

export type AddressEditorValue = Readonly<{
  name: string;
  recipientName: string;
  recipientMobile: string;
  formattedAddress: string;
  location: Readonly<{ type: "Point"; coordinates: readonly [number, number] }>;
  postalCode: string;
  deliveryNotes: string | null;
  isDefault: boolean;
}>;

export type AddressEditorField =
  Exclude<keyof AddressEditorValue, "location"> | "latitude" | "longitude";

export type AddressEditorProps = Readonly<{
  value: AddressEditorValue;
  onChange(value: AddressEditorValue): void;
  errors?: Partial<Record<AddressEditorField, string>>;
  disabled?: boolean;
  idPrefix?: string;
}>;

export function geoJsonPointFromLatLng(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    throw new RangeError("Latitude must be between -90 and 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    throw new RangeError("Longitude must be between -180 and 180.");
  return { type: "Point" as const, coordinates: [longitude, latitude] as const };
}

export function latLngFromGeoJsonPoint(point: AddressEditorValue["location"]): AddressMapPosition {
  return { latitude: point.coordinates[1], longitude: point.coordinates[0] };
}

export function AddressEditor({
  value,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = "address",
}: AddressEditorProps) {
  const t = useTranslations("profile.addressEditor");
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "denied" | "failed">(
    "idle",
  );
  const position = latLngFromGeoJsonPoint(value.location);
  const update = <Key extends keyof AddressEditorValue>(key: Key, next: AddressEditorValue[Key]) =>
    onChange({ ...value, [key]: next });
  const updatePosition = (next: AddressMapPosition) =>
    update("location", geoJsonPointFromLatLng(next.latitude, next.longitude));
  const numericPosition = (key: keyof AddressMapPosition, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = { ...position, [key]: parsed };
    try {
      updatePosition(next);
    } catch {
      // Keep the last valid point while the field exposes its native range validation.
    }
  };
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("failed");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updatePosition({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationStatus("idle");
      },
      (error) => setLocationStatus(error.code === 1 ? "denied" : "failed"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <FormField
          disabled={disabled}
          error={Boolean(errors.name)}
          fullWidth
          helperText={errors.name}
          id={`${idPrefix}-name`}
          label={t("name")}
          name="name"
          onChange={(event) => update("name", event.target.value)}
          required
          value={value.name}
        />
        <FormField
          disabled={disabled}
          error={Boolean(errors.recipientName)}
          fullWidth
          helperText={errors.recipientName}
          id={`${idPrefix}-recipient-name`}
          label={t("recipientName")}
          name="recipientName"
          onChange={(event) => update("recipientName", event.target.value)}
          required
          value={value.recipientName}
        />
        <FormField
          disabled={disabled}
          error={Boolean(errors.recipientMobile)}
          fullWidth
          helperText={errors.recipientMobile ?? t("mobileHint")}
          id={`${idPrefix}-recipient-mobile`}
          label={t("recipientMobile")}
          name="recipientMobile"
          onChange={(event) => update("recipientMobile", event.target.value)}
          required
          slotProps={{ htmlInput: { inputMode: "tel", autoComplete: "tel" } }}
          value={value.recipientMobile}
        />
        <FormField
          disabled={disabled}
          error={Boolean(errors.postalCode)}
          fullWidth
          helperText={errors.postalCode ?? t("postalHint")}
          id={`${idPrefix}-postal-code`}
          label={t("postalCode")}
          name="postalCode"
          onChange={(event) => update("postalCode", event.target.value)}
          required
          slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "postal-code" } }}
          value={value.postalCode}
        />
        <FormField
          disabled={disabled}
          error={Boolean(errors.formattedAddress)}
          fullWidth
          helperText={errors.formattedAddress}
          id={`${idPrefix}-formatted-address`}
          label={t("formattedAddress")}
          multiline
          name="formattedAddress"
          onChange={(event) => update("formattedAddress", event.target.value)}
          required
          rows={3}
          sx={{ gridColumn: { md: "1 / -1" } }}
          value={value.formattedAddress}
        />
        <FormField
          disabled={disabled}
          error={Boolean(errors.deliveryNotes)}
          fullWidth
          helperText={errors.deliveryNotes}
          id={`${idPrefix}-delivery-notes`}
          label={t("deliveryNotes")}
          multiline
          name="deliveryNotes"
          onChange={(event) => update("deliveryNotes", event.target.value || null)}
          rows={2}
          sx={{ gridColumn: { md: "1 / -1" } }}
          value={value.deliveryNotes ?? ""}
        />
      </Box>

      <Stack spacing={1.5}>
        <Box sx={{ alignItems: { sm: "center" }, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <Box sx={{ flex: "1 1 280px" }}>
            <Typography component="h3" variant="h6">
              {t("mapTitle")}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {t("mapHelp")}
            </Typography>
          </Box>
          <Button
            disabled={disabled || locationStatus === "locating"}
            onClick={locate}
            startIcon={
              locationStatus === "locating" ? (
                <CircularProgress size={18} />
              ) : (
                <MyLocationOutlined />
              )
            }
            type="button"
            variant="outlined"
          >
            {locationStatus === "locating" ? t("locating") : t("useLocation")}
          </Button>
        </Box>
        {(locationStatus === "denied" || locationStatus === "failed") && (
          <Alert severity="info" role="status">
            {locationStatus === "denied" ? t("permissionDenied") : t("locationUnavailable")}
          </Alert>
        )}
        <AddressMap
          ariaLabel={t("mapLabel")}
          disabled={disabled}
          onPositionChange={updatePosition}
          position={position}
        />
        <Typography color="text.secondary" variant="caption">
          {t.rich("attribution", {
            link: (chunks) => (
              <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
                {chunks}
              </a>
            ),
          })}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          <FormField
            disabled={disabled}
            error={Boolean(errors.latitude)}
            fullWidth
            helperText={errors.latitude ?? t("coordinateFallback")}
            id={`${idPrefix}-latitude`}
            label={t("latitude")}
            name="latitude"
            onChange={(event) => numericPosition("latitude", event.target.value)}
            required
            slotProps={{ htmlInput: { inputMode: "decimal", min: -90, max: 90, step: "any" } }}
            type="number"
            value={position.latitude}
          />
          <FormField
            disabled={disabled}
            error={Boolean(errors.longitude)}
            fullWidth
            helperText={errors.longitude ?? t("coordinateOrder")}
            id={`${idPrefix}-longitude`}
            label={t("longitude")}
            name="longitude"
            onChange={(event) => numericPosition("longitude", event.target.value)}
            required
            slotProps={{ htmlInput: { inputMode: "decimal", min: -180, max: 180, step: "any" } }}
            type="number"
            value={position.longitude}
          />
        </Box>
      </Stack>

      <FormControlLabel
        control={
          <Checkbox
            checked={value.isDefault}
            disabled={disabled}
            name="isDefault"
            onChange={(event) => update("isDefault", event.target.checked)}
          />
        }
        label={t("isDefault")}
      />
    </Stack>
  );
}
