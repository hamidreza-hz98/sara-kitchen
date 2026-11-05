"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import PinterestIcon from "@mui/icons-material/Pinterest";
import TelegramIcon from "@mui/icons-material/Telegram";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { SettingsPageSection } from "../settings-section-registry";
import { AboutSettingsForm } from "./about-settings-form";
import { FaqSettingsForm } from "./faq-settings-form";
import { LanguageSettingsForm } from "./language-settings-form";

type RecordValue = Record<string, unknown>;
type SettingsDataSection = Exclude<SettingsPageSection, "homepage" | "terms">;
type Translator = (key: string, values?: Record<string, string | number>) => string;

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "whatsapp",
  "telegram",
  "linkedin",
  "youtube",
  "tiktok",
  "x",
  "threads",
  "pinterest",
  "snapchat",
] as const;
type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const SOCIAL_PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: "#E4405F",
  facebook: "#1877F2",
  whatsapp: "#25D366",
  telegram: "#26A5E4",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#111111",
  x: "#111111",
  threads: "#111111",
  pinterest: "#BD081C",
  snapchat: "#111111",
};

const SOCIAL_PROFILE_BASES: Record<SocialPlatform, string> = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  whatsapp: "https://wa.me/",
  telegram: "https://t.me/",
  linkedin: "https://www.linkedin.com/in/",
  youtube: "https://www.youtube.com/@",
  tiktok: "https://www.tiktok.com/@",
  x: "https://x.com/",
  threads: "https://www.threads.net/@",
  pinterest: "https://www.pinterest.com/",
  snapchat: "https://www.snapchat.com/add/",
};

function SocialPlatformLogo({ platform }: { platform: SocialPlatform }) {
  const sx = { color: SOCIAL_PLATFORM_COLORS[platform], fontSize: 28 };
  switch (platform) {
    case "instagram":
      return <InstagramIcon sx={sx} />;
    case "facebook":
      return <FacebookIcon sx={sx} />;
    case "whatsapp":
      return <WhatsAppIcon sx={sx} />;
    case "telegram":
      return <TelegramIcon sx={sx} />;
    case "linkedin":
      return <LinkedInIcon sx={sx} />;
    case "youtube":
      return <YouTubeIcon sx={sx} />;
    case "x":
      return <XIcon sx={sx} />;
    case "pinterest":
      return <PinterestIcon sx={sx} />;
    case "tiktok":
      return (
        <SvgIcon sx={sx} viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.58v13.67a2.9 2.9 0 0 1-2.9 2.9 2.9 2.9 0 1 1 2.9-2.9v-3.58a6.48 6.48 0 1 0 3.58 5.78V9.23a8.36 8.36 0 0 0 4.88 1.56V7.2a4.84 4.84 0 0 1-1.11-.51Z" />
        </SvgIcon>
      );
    case "threads":
      return (
        <SvgIcon sx={sx} viewBox="0 0 24 24">
          <path d="M12.05 2c-5.45 0-8.7 3.9-8.7 10.1 0 6.2 3.12 9.9 8.45 9.9 4.33 0 7.14-2.62 7.14-6.48 0-3.4-2.2-5.55-5.68-5.55-1.62 0-3 .6-3.95 1.67.2-2.48 1.43-3.83 3.38-3.83 1.24 0 2.1.55 2.62 1.67l2.45-1.14C16.8 5.97 14.85 4.8 12.7 4.8c-3.97 0-6.35 2.82-6.35 7.55 0 4.9 2.04 7.48 5.72 7.48 2.42 0 4.03-1.42 4.03-3.58 0-2.2-1.55-3.62-3.94-3.62-1.18 0-2.16.35-2.92 1.02.3-1.3 1.28-2.05 2.73-2.05 1.9 0 3.1 1.22 3.1 3.2 0 2.4-1.88 4.02-4.64 4.02-3.67 0-5.73-2.56-5.73-7.06 0-4.73 2.4-7.18 6.92-7.18 1.45 0 2.82.3 4.08.88l1.03-2.34A11.47 11.47 0 0 0 12.05 2Z" />
        </SvgIcon>
      );
    case "snapchat":
      return (
        <SvgIcon sx={{ ...sx, bgcolor: "#FFFC00", borderRadius: "50%" }} viewBox="0 0 24 24">
          <path d="M12 2.2c-3.4 0-5.7 2.5-5.7 5.8v3.1c0 .6-.4 1.1-1 1.3l-1.6.5c-.6.2-.7.9-.2 1.2l1.1.7c.4.2.5.6.4 1-.2.5-.1 1 .2 1.4.3.4.7.6 1.2.7.8.1 1.4.6 1.8 1.3.5.9 1.6 1.3 2.5.9.4-.2.9-.4 1.4-.4s1 .2 1.4.4c.9.4 2-.1 2.5-.9.4-.7 1-1.2 1.8-1.3.5-.1.9-.4 1.2-.7.3-.4.4-.9.2-1.4-.1-.4 0-.8.4-1l1.1-.7c.5-.3.4-1-.2-1.2l-1.6-.5c-.6-.2-1-.7-1-1.3V8c0-3.3-2.3-5.8-5.7-5.8Z" />
        </SvgIcon>
      );
  }
}

function socialProfileLink(link: RecordValue): string {
  const platform = String(link.platform) as SocialPlatform;
  const destination = record(link.destination);
  if (destination.type === "url") return String(destination.url ?? "");
  const handle = String(destination.handle ?? "")
    .trim()
    .replace(/^@/u, "");
  if (!handle || !(platform in SOCIAL_PROFILE_BASES)) return "";
  const path = platform === "whatsapp" ? handle.replace(/\D/gu, "") : handle;
  return `${SOCIAL_PROFILE_BASES[platform]}${encodeURIComponent(path)}`;
}

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function list(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function moveOrder(items: readonly RecordValue[], index: number, offset: number): RecordValue[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((item, order) => ({ ...item, order }));
}

function DataSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

function OrderActions({
  index,
  length,
  canEdit,
  onMove,
  onRemove,
  removeLabel,
  upLabel,
  downLabel,
}: {
  index: number;
  length: number;
  canEdit: boolean;
  onMove: (offset: number) => void;
  onRemove: () => void;
  removeLabel: string;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
      <IconButton
        size="small"
        aria-label={upLabel}
        disabled={!canEdit || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUpwardRounded fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        aria-label={downLabel}
        disabled={!canEdit || index === length - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDownwardRounded fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        color="error"
        aria-label={removeLabel}
        disabled={!canEdit}
        onClick={onRemove}
      >
        <DeleteOutlineRounded fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function NumberField({
  label,
  value,
  disabled,
  min,
  max,
  step = 1,
  onChange,
  dir,
}: {
  label: string;
  value: unknown;
  disabled: boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  dir?: "ltr" | "rtl";
}) {
  return (
    <TextField
      fullWidth
      type="number"
      label={label}
      value={String(value ?? "")}
      disabled={disabled}
      slotProps={{ htmlInput: { min, max, step, dir: dir ?? "ltr" } }}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function SettingsDataForm({
  section,
  data,
  labelsTranslation,
  canEdit,
  canUploadMedia,
  onChange,
}: {
  section: SettingsDataSection;
  data: RecordValue;
  labelsTranslation: RecordValue;
  canEdit: boolean;
  canUploadMedia: boolean;
  onChange: (value: RecordValue) => void;
}) {
  switch (section) {
    case "contact":
      return <ContactDataForm data={data} canEdit={canEdit} onChange={onChange} />;
    case "social":
      return <SocialDataForm data={data} canEdit={canEdit} onChange={onChange} />;
    case "about":
      return (
        <AboutSettingsForm
          data={data}
          labelsTranslation={labelsTranslation}
          canEdit={canEdit}
          canUploadMedia={canUploadMedia}
          onChange={onChange}
        />
      );
    case "faq":
      return (
        <FaqSettingsForm
          data={data}
          labelsTranslation={labelsTranslation}
          canEdit={canEdit}
          onChange={onChange}
        />
      );
    case "languages":
      return <LanguageSettingsForm data={data} canEdit={canEdit} onChange={onChange} />;
  }
}

function ContactDataForm({
  data,
  canEdit,
  onChange,
}: {
  data: RecordValue;
  canEdit: boolean;
  onChange: (value: RecordValue) => void;
}) {
  const translator = useTranslations("dashboard.settingsEditor.forms");
  const t = translator as unknown as Translator;
  const direction = useLocale() === "fa" ? "rtl" : "ltr";
  const phones = list(data.phones);
  const bands = list(data.deliveryBands);
  const hours = list(data.businessHours);
  const map = data.map === null ? null : record(data.map);
  const update = (patch: RecordValue) => onChange({ ...data, ...patch });
  const patchPhone = (index: number, patch: RecordValue) =>
    update({
      phones: phones.map((phone, position) =>
        position === index ? { ...phone, ...patch } : phone,
      ),
    });
  const removePhone = (index: number) => {
    const next = phones.filter((_, position) => position !== index);
    if (!next.some((phone) => phone.primary) && next[0]) next[0] = { ...next[0], primary: true };
    update({ phones: next });
  };
  const updateBand = (index: number, field: "maxDistanceMeters" | "feeCents", value: number) =>
    update({
      deliveryBands: bands.map((band, position) =>
        position === index ? { ...band, [field]: value } : band,
      ),
    });

  return (
    <Stack spacing={2.5} dir={direction}>
      <DataSection title={t("contactDetails")} description={t("contactDetailsHelp")}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
          <TextField
            fullWidth
            type="email"
            label={t("email")}
            value={String(data.email ?? "")}
            disabled={!canEdit}
            slotProps={{ htmlInput: { dir: "ltr" } }}
            onChange={(event) => update({ email: event.target.value })}
          />
          <TextField
            fullWidth
            label={t("postalCode")}
            value={String(record(data.address).postalCode ?? "")}
            disabled={!canEdit}
            onChange={(event) =>
              update({ address: { ...record(data.address), postalCode: event.target.value } })
            }
          />
          <TextField
            fullWidth
            label={t("countryCode")}
            value={String(record(data.address).countryCode ?? "")}
            disabled={!canEdit}
            slotProps={{ htmlInput: { maxLength: 2, dir: "ltr" } }}
            onChange={(event) =>
              update({
                address: { ...record(data.address), countryCode: event.target.value.toUpperCase() },
              })
            }
          />
          <NumberField
            label={t("latitude")}
            value={record(data.location).latitude}
            disabled={!canEdit}
            min={-90}
            max={90}
            step={0.000001}
            onChange={(latitude) => update({ location: { ...record(data.location), latitude } })}
          />
          <NumberField
            label={t("longitude")}
            value={record(data.location).longitude}
            disabled={!canEdit}
            min={-180}
            max={180}
            step={0.000001}
            onChange={(longitude) => update({ location: { ...record(data.location), longitude } })}
          />
          <FormControl fullWidth disabled={!canEdit}>
            <InputLabel id="service-area-mode">{t("serviceAreaMode")}</InputLabel>
            <Select
              labelId="service-area-mode"
              label={t("serviceAreaMode")}
              value={String(record(data.serviceArea).mode ?? "city")}
              onChange={(event) =>
                update({
                  serviceArea: {
                    ...record(data.serviceArea),
                    mode: event.target.value,
                    radiusKm:
                      event.target.value === "city"
                        ? null
                        : Number(record(data.serviceArea).radiusKm ?? 10),
                  },
                })
              }
            >
              <MenuItem value="city">{t("cityCoverage")}</MenuItem>
              <MenuItem value="radius">{t("radiusCoverage")}</MenuItem>
            </Select>
          </FormControl>
          {record(data.serviceArea).mode === "radius" ? (
            <NumberField
              label={t("radiusKilometers")}
              value={record(data.serviceArea).radiusKm}
              disabled={!canEdit}
              min={0.1}
              max={200}
              step={0.1}
              onChange={(radiusKm) =>
                update({ serviceArea: { ...record(data.serviceArea), radiusKm } })
              }
            />
          ) : null}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t("configuredTimeZone", { timeZone: String(data.timeZone ?? "Europe/Lisbon") })}
        </Typography>
      </DataSection>

      <DataSection
        title={t("contactPhones")}
        description={t("contactPhonesHelp")}
        action={
          <Button
            startIcon={<AddRounded />}
            disabled={!canEdit || phones.length >= 8}
            variant="outlined"
            onClick={() =>
              update({
                phones: [
                  ...phones,
                  {
                    id: makeId("phone"),
                    kind: "mobile",
                    number: "",
                    primary: phones.length === 0,
                    public: true,
                  },
                ],
              })
            }
          >
            {t("addPhone")}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          {phones.map((phone, index) => (
            <Card key={String(phone.id)} variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{ gap: 1.5, alignItems: { sm: "center" } }}
                  >
                    <FormControl fullWidth disabled={!canEdit}>
                      <InputLabel id={`phone-kind-${String(phone.id)}`}>
                        {t("phoneType")}
                      </InputLabel>
                      <Select
                        labelId={`phone-kind-${String(phone.id)}`}
                        label={t("phoneType")}
                        value={String(phone.kind)}
                        onChange={(event) => patchPhone(index, { kind: event.target.value })}
                      >
                        <MenuItem value="mobile">{t("mobile")}</MenuItem>
                        <MenuItem value="landline">{t("landline")}</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      required
                      type="tel"
                      label={t("phoneNumber")}
                      value={String(phone.number ?? "")}
                      disabled={!canEdit}
                      slotProps={{ htmlInput: { dir: "ltr", inputMode: "tel" } }}
                      onChange={(event) => patchPhone(index, { number: event.target.value })}
                    />
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={t("removePhone")}
                      disabled={!canEdit || phones.length <= 1}
                      onClick={() => removePhone(index)}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(phone.primary)}
                          disabled={!canEdit}
                          onChange={() =>
                            update({
                              phones: phones.map((item, position) => ({
                                ...item,
                                primary: position === index,
                              })),
                            })
                          }
                        />
                      }
                      label={t("primaryPhone")}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(phone.public)}
                          disabled={!canEdit}
                          onChange={(event) => patchPhone(index, { public: event.target.checked })}
                        />
                      }
                      label={t("showPhonePublicly")}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(record(data.whatsapp).enabled)}
              disabled={!canEdit}
              onChange={(event) =>
                update({ whatsapp: { ...record(data.whatsapp), enabled: event.target.checked } })
              }
            />
          }
          label={t("enableWhatsapp")}
        />
        <TextField
          fullWidth
          label={t("whatsappNumber")}
          value={String(record(data.whatsapp).number ?? "")}
          disabled={!canEdit || !record(data.whatsapp).enabled}
          slotProps={{ htmlInput: { dir: "ltr", inputMode: "tel" } }}
          onChange={(event) =>
            update({ whatsapp: { ...record(data.whatsapp), number: event.target.value } })
          }
        />
      </DataSection>

      <DataSection title={t("deliveryBands")} description={t("deliveryBandsHelp")}>
        <Stack spacing={1.5}>
          {bands.map((band, index) => (
            <Stack
              key={index}
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1.5, alignItems: { sm: "center" } }}
            >
              <NumberField
                label={t("deliveryBandKilometers", { number: index + 1 })}
                value={Number(band.maxDistanceMeters ?? 0) / 1_000}
                disabled={!canEdit}
                min={0.1}
                max={100}
                step={0.1}
                onChange={(value) =>
                  updateBand(index, "maxDistanceMeters", Math.round(value * 1_000))
                }
              />
              <NumberField
                label={t("deliveryBandEuros", { number: index + 1 })}
                value={Number(band.feeCents ?? 0) / 100}
                disabled={!canEdit}
                min={0}
                max={1_000}
                step={0.01}
                onChange={(value) => updateBand(index, "feeCents", Math.round(value * 100))}
              />
              <Button
                disabled={!canEdit || bands.length <= 1}
                onClick={() =>
                  update({ deliveryBands: bands.filter((_, position) => position !== index) })
                }
                sx={{ minWidth: 104, minHeight: 56, flexShrink: 0, whiteSpace: "nowrap" }}
              >
                {t("removeDeliveryBand")}
              </Button>
            </Stack>
          ))}
          <Button
            variant="outlined"
            disabled={!canEdit || bands.length >= 12}
            onClick={() => {
              const last = bands.at(-1);
              update({
                deliveryBands: [
                  ...bands,
                  {
                    maxDistanceMeters: Number(last?.maxDistanceMeters ?? 0) + 5_000,
                    feeCents: Number(last?.feeCents ?? 0) + 200,
                  },
                ],
              });
            }}
          >
            {t("addDeliveryBand")}
          </Button>
        </Stack>
      </DataSection>

      <DataSection title={t("businessHours")} description={t("businessHoursHelp")}>
        <Stack spacing={1.25}>
          {WEEKDAYS.map((day) => {
            const index = hours.findIndex((item) => item.day === day);
            const entry = index >= 0 ? hours[index]! : { day, periods: [] };
            const periods = Array.isArray(entry.periods) ? entry.periods.map(record) : [];
            const updatePeriods = (next: RecordValue[]) => {
              const nextHours =
                index < 0
                  ? [...hours, { day, periods: next }]
                  : hours.map((item, position) =>
                      position === index ? { ...item, periods: next } : item,
                    );
              update({ businessHours: nextHours });
            };
            return (
              <Card key={day} variant="outlined">
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1 }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>{t(`weekday.${day}`)}</Typography>
                      {periods.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t("closedDay")}
                        </Typography>
                      ) : null}
                      <Button
                        size="small"
                        startIcon={<AddRounded />}
                        disabled={!canEdit || periods.length >= 3}
                        onClick={() =>
                          updatePeriods([
                            ...periods,
                            {
                              opensAt: periods.length ? "14:00" : "09:00",
                              closesAt: periods.length ? "18:00" : "17:00",
                            },
                          ])
                        }
                      >
                        {t("addHoursPeriod")}
                      </Button>
                    </Stack>
                    {periods.map((period, periodIndex) => (
                      <Stack
                        key={periodIndex}
                        direction={{ xs: "column", sm: "row" }}
                        sx={{ gap: 1.5, alignItems: { sm: "center" } }}
                      >
                        <TextField
                          fullWidth
                          type="time"
                          label={t("opensAt")}
                          value={String(period.opensAt ?? "09:00")}
                          disabled={!canEdit}
                          slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                          onChange={(event) =>
                            updatePeriods(
                              periods.map((item, position) =>
                                position === periodIndex
                                  ? { ...item, opensAt: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <TextField
                          fullWidth
                          type="time"
                          label={t("closesAt")}
                          value={String(period.closesAt ?? "17:00")}
                          disabled={!canEdit}
                          slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                          onChange={(event) =>
                            updatePeriods(
                              periods.map((item, position) =>
                                position === periodIndex
                                  ? { ...item, closesAt: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Button
                          disabled={!canEdit}
                          onClick={() =>
                            updatePeriods(periods.filter((_, position) => position !== periodIndex))
                          }
                          sx={{ minWidth: 104, minHeight: 56, whiteSpace: "nowrap" }}
                        >
                          {t("removeHoursPeriod")}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DataSection>

      <DataSection title={t("mapSettings")} description={t("mapSettingsHelp")}>
        {map ? (
          <Stack spacing={1.5}>
            <FormControl fullWidth disabled={!canEdit}>
              <InputLabel id="contact-map-provider">{t("mapProvider")}</InputLabel>
              <Select
                labelId="contact-map-provider"
                label={t("mapProvider")}
                value={String(map.provider)}
                onChange={(event) =>
                  update({
                    map: {
                      ...map,
                      provider: event.target.value,
                      embedUrl: event.target.value === "leaflet" ? null : map.embedUrl,
                    },
                  })
                }
              >
                <MenuItem value="leaflet">{t("leafletMap")}</MenuItem>
                <MenuItem value="google_maps_embed">{t("googleMapsEmbed")}</MenuItem>
              </Select>
            </FormControl>
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
            >
              <NumberField
                label={t("mapZoom")}
                value={map.zoom}
                disabled={!canEdit}
                min={1}
                max={20}
                onChange={(zoom) => update({ map: { ...map, zoom } })}
              />
              {map.provider === "google_maps_embed" ? (
                <TextField
                  fullWidth
                  required
                  label={t("mapEmbedUrl")}
                  value={String(map.embedUrl ?? "")}
                  disabled={!canEdit}
                  slotProps={{ htmlInput: { dir: "ltr" } }}
                  onChange={(event) =>
                    update({ map: { ...map, embedUrl: event.target.value || null } })
                  }
                />
              ) : null}
              <TextField
                fullWidth
                label={t("directionsUrl")}
                value={String(map.directionsUrl ?? "")}
                disabled={!canEdit}
                slotProps={{ htmlInput: { dir: "ltr" } }}
                onChange={(event) =>
                  update({ map: { ...map, directionsUrl: event.target.value || null } })
                }
              />
            </Box>
            <Button
              color="inherit"
              disabled={!canEdit}
              onClick={() => update({ map: null })}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("disableMap")}
            </Button>
          </Stack>
        ) : (
          <Button
            variant="outlined"
            disabled={!canEdit}
            onClick={() =>
              update({
                map: { provider: "leaflet", zoom: 14, embedUrl: null, directionsUrl: null },
              })
            }
          >
            {t("enableMap")}
          </Button>
        )}
      </DataSection>
    </Stack>
  );
}

function SocialDataForm({
  data,
  canEdit,
  onChange,
}: {
  data: RecordValue;
  canEdit: boolean;
  onChange: (value: RecordValue) => void;
}) {
  const translator = useTranslations("dashboard.settingsEditor.forms");
  const t = translator as unknown as Translator;
  const direction = useLocale() === "fa" ? "rtl" : "ltr";
  const [selectingPlatform, setSelectingPlatform] = useState<"new" | number | null>(null);
  const links = list(data.links).sort(
    (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0),
  );
  const updateLinks = (next: RecordValue[]) =>
    onChange({ ...data, links: next.map((link, order) => ({ ...link, order })) });
  const patch = (index: number, values: RecordValue) =>
    updateLinks(
      links.map((link, position) => (position === index ? { ...link, ...values } : link)),
    );
  const choosePlatform = (platform: SocialPlatform) => {
    if (selectingPlatform === "new") {
      updateLinks([
        ...links,
        {
          id: makeId("social"),
          platform,
          destination: { type: "url", url: "" },
          iconKey: platform,
          active: true,
          order: links.length,
        },
      ]);
    } else if (typeof selectingPlatform === "number") {
      patch(selectingPlatform, {
        platform,
        iconKey: platform,
        destination: { type: "url", url: "" },
      });
    }
    setSelectingPlatform(null);
  };
  return (
    <Stack spacing={2.5} dir={direction}>
      <DataSection
        title={t("socialLinks")}
        description={t("socialLinksHelp")}
        action={
          <Button
            startIcon={<AddRounded />}
            variant="outlined"
            disabled={!canEdit || links.length >= 20}
            onClick={() => setSelectingPlatform("new")}
          >
            {t("addSocialLink")}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          {links.map((link, index) => {
            return (
              <Card key={String(link.id)} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      sx={{ gap: 1.5, alignItems: { md: "center" } }}
                    >
                      <Button
                        variant="outlined"
                        disabled={!canEdit}
                        title={t("changeSocialPlatform")}
                        onClick={() => setSelectingPlatform(index)}
                        startIcon={
                          <SocialPlatformLogo platform={link.platform as SocialPlatform} />
                        }
                        sx={{ justifyContent: "flex-start", minHeight: 56, flex: "1 1 auto" }}
                      >
                        {t(`platforms.${String(link.platform)}`)}
                      </Button>
                      <OrderActions
                        index={index}
                        length={links.length}
                        canEdit={canEdit}
                        onMove={(offset) => updateLinks(moveOrder(links, index, offset))}
                        onRemove={() =>
                          updateLinks(links.filter((_, position) => position !== index))
                        }
                        removeLabel={t("removeSocialLink")}
                        upLabel={t("moveUp")}
                        downLabel={t("moveDown")}
                      />
                    </Stack>
                    <TextField
                      fullWidth
                      required
                      type="url"
                      label={t("socialProfileLink")}
                      value={socialProfileLink(link)}
                      disabled={!canEdit}
                      placeholder="https://"
                      helperText={t("socialProfileLinkHelp")}
                      slotProps={{ htmlInput: { dir: "ltr", autoComplete: "url" } }}
                      onChange={(event) =>
                        patch(index, {
                          destination: { type: "url", url: event.target.value },
                        })
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(link.active)}
                          disabled={!canEdit}
                          onChange={(event) => patch(index, { active: event.target.checked })}
                        />
                      }
                      label={t("active")}
                    />
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </DataSection>
      <Dialog
        open={selectingPlatform !== null}
        onClose={() => setSelectingPlatform(null)}
        fullWidth
        maxWidth="sm"
        dir={direction}
        aria-labelledby="social-platform-picker-title"
      >
        <DialogTitle id="social-platform-picker-title">{t("selectSocialPlatform")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography color="text.secondary" variant="body2">
              {t("socialPlatformPickerHelp")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1,
              }}
            >
              {SOCIAL_PLATFORMS.map((platform) => {
                const selected =
                  typeof selectingPlatform === "number" &&
                  links[selectingPlatform]?.platform === platform;
                return (
                  <Button
                    key={platform}
                    variant={selected ? "contained" : "outlined"}
                    disabled={!canEdit || selected}
                    onClick={() => choosePlatform(platform)}
                    startIcon={<SocialPlatformLogo platform={platform} />}
                    sx={{ justifyContent: "flex-start", minHeight: 60, px: 1.5 }}
                  >
                    {t(`platforms.${platform}`)}
                  </Button>
                );
              })}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectingPlatform(null)}>{t("cancelPlatformPicker")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
