"use client";

import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { SupportedLocale } from "@/constants";

export const SEO_LOCALES = ["en", "pt-PT", "fa"] as const;
export type SeoEditableField =
  | "title"
  | "description"
  | "keywords"
  | "openGraphTitle"
  | "openGraphDescription"
  | "twitterTitle"
  | "twitterDescription";
export type SeoLocaleValues = Record<SeoEditableField, string>;
export type SeoLocaleModes = Record<SeoEditableField, "automatic" | "manual">;

export type SeoEditorValues = Readonly<{
  locales: Record<SupportedLocale, SeoLocaleValues>;
  modes: Record<SupportedLocale, SeoLocaleModes>;
  canonicalUrl: string;
  canonicalMode: "automatic" | "manual";
}>;

const FIELD_LIMITS: Readonly<Record<SeoEditableField, number>> = {
  title: 70,
  description: 170,
  keywords: 1_220,
  openGraphTitle: 100,
  openGraphDescription: 220,
  twitterTitle: 100,
  twitterDescription: 220,
};

function Guidance({ value, maximum }: { value: string; maximum: number }) {
  const t = useTranslations("dashboard.seoControls");
  const count = value.length;
  const optimal = maximum === 70 ? count >= 30 && count <= 60 : count >= 70 && count <= 160;
  return (
    <Typography component="span" color={count > maximum ? "error.main" : "text.secondary"}>
      {t("characters", { count, maximum })} · {optimal ? t("lengthGood") : t("lengthGuidance")}
    </Typography>
  );
}

export function SeoFields({
  disabled = false,
  ownershipEditable = true,
  values,
  onChange,
}: {
  disabled?: boolean;
  ownershipEditable?: boolean;
  values: SeoEditorValues;
  onChange: (value: SeoEditorValues) => void;
}) {
  const t = useTranslations("dashboard.seoControls");
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const current = values.locales[locale];
  const modes = values.modes[locale];

  const updateField = (field: SeoEditableField, value: string) =>
    onChange({
      ...values,
      locales: { ...values.locales, [locale]: { ...current, [field]: value } },
    });
  const updateMode = (field: SeoEditableField, manual: boolean) =>
    onChange({
      ...values,
      modes: {
        ...values.modes,
        [locale]: { ...modes, [field]: manual ? "manual" : "automatic" },
      },
    });

  const field = (
    name: SeoEditableField,
    options: Readonly<{ multiline?: boolean; label: string; rows?: number }>,
  ) => (
    <Stack spacing={0.5} key={name}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, gap: 1 }}>
        <TextField
          fullWidth
          disabled={disabled || modes[name] === "automatic"}
          label={options.label}
          multiline={options.multiline}
          rows={options.rows}
          value={current[name]}
          onChange={(event) => updateField(name, event.target.value)}
          error={modes[name] === "manual" && current[name].length > FIELD_LIMITS[name]}
          helperText={<Guidance value={current[name]} maximum={FIELD_LIMITS[name]} />}
        />
        <FormControlLabel
          sx={{ minWidth: 170, m: 0 }}
          control={
            <Switch
              disabled={disabled || !ownershipEditable}
              checked={modes[name] === "manual"}
              onChange={(event) => updateMode(name, event.target.checked)}
            />
          }
          label={modes[name] === "manual" ? t("manual") : t("automatic")}
        />
      </Stack>
      {modes[name] === "automatic" ? (
        <Typography variant="caption" color="text.secondary">
          {t("fallbackState")}
        </Typography>
      ) : null}
    </Stack>
  );

  const previewTitle = current.openGraphTitle || current.title || t("previewTitleFallback");
  const previewDescription =
    current.openGraphDescription || current.description || t("previewDescriptionFallback");

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6">{t("title")}</Typography>
        <Chip
          size="small"
          icon={
            Object.values(modes).some((mode) => mode === "manual") ? (
              <EditRounded />
            ) : (
              <AutoAwesomeRounded />
            )
          }
          label={
            Object.values(modes).some((mode) => mode === "manual")
              ? t("mixedStatus")
              : t("automaticStatus")
          }
          color={Object.values(modes).some((mode) => mode === "manual") ? "primary" : "default"}
        />
      </Stack>
      <Typography color="text.secondary">{t("intro")}</Typography>
      <Tabs
        value={locale}
        onChange={(_, value: SupportedLocale) => setLocale(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t("languages")}
      >
        {SEO_LOCALES.map((item) => (
          <Tab key={item} value={item} label={t(`locale.${item}`)} />
        ))}
      </Tabs>
      {field("title", { label: t("metaTitle") })}
      {field("description", { label: t("metaDescription"), multiline: true, rows: 3 })}
      {field("keywords", { label: t("keywords") })}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t("socialOverrides")}
      </Typography>
      {field("openGraphTitle", { label: t("socialTitle") })}
      {field("openGraphDescription", { label: t("socialDescription"), multiline: true, rows: 2 })}
      {field("twitterTitle", { label: t("twitterTitle") })}
      {field("twitterDescription", { label: t("twitterDescription"), multiline: true, rows: 2 })}
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, gap: 1 }}>
        <TextField
          fullWidth
          label={t("canonicalUrl")}
          disabled={disabled || values.canonicalMode === "automatic"}
          value={values.canonicalUrl}
          onChange={(event) => onChange({ ...values, canonicalUrl: event.target.value })}
          helperText={
            values.canonicalMode === "automatic" ? t("canonicalFallback") : t("canonicalHelp")
          }
          slotProps={{ htmlInput: { dir: "ltr" } }}
        />
        <FormControlLabel
          sx={{ minWidth: 170, m: 0 }}
          control={
            <Switch
              disabled={disabled || !ownershipEditable}
              checked={values.canonicalMode === "manual"}
              onChange={(event) =>
                onChange({
                  ...values,
                  canonicalMode: event.target.checked ? "manual" : "automatic",
                })
              }
            />
          }
          label={values.canonicalMode === "manual" ? t("manual") : t("automatic")}
        />
      </Stack>
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
          {t("socialPreview")}
        </Typography>
        <Paper variant="outlined" sx={{ maxWidth: 600, overflow: "hidden" }}>
          <Box
            sx={{
              aspectRatio: "1.91 / 1",
              bgcolor: "background.default",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Typography color="text.secondary">{t("shareImageFallback")}</Typography>
          </Box>
          <Stack spacing={0.5} sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              SARAKITCHEN.PT
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{previewTitle.slice(0, 100)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {previewDescription.slice(0, 220)}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
