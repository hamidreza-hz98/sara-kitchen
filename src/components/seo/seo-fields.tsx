"use client";

import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
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

function Guidance({
  value,
  maximum,
  direction,
}: {
  value: string;
  maximum: number;
  direction: "ltr" | "rtl";
}) {
  const t = useTranslations("dashboard.seoControls");
  const count = value.length;
  const optimal = maximum === 70 ? count >= 30 && count <= 60 : count >= 70 && count <= 160;
  return (
    <Typography
      component="span"
      dir={direction}
      color={count > maximum ? "error.main" : "text.secondary"}
      sx={{ display: "block", textAlign: direction === "rtl" ? "right" : "left" }}
    >
      {t("characters", { count, maximum })} · {optimal ? t("lengthGood") : t("lengthGuidance")}
    </Typography>
  );
}

export function SeoFields({
  disabled = false,
  ownershipEditable = true,
  shareImageUrl = null,
  values,
  onChange,
}: {
  disabled?: boolean;
  ownershipEditable?: boolean;
  shareImageUrl?: string | null;
  values: SeoEditorValues;
  onChange: (value: SeoEditorValues) => void;
}) {
  const t = useTranslations("dashboard.seoControls");
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const direction = locale === "fa" ? "rtl" : "ltr";
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
    <Stack spacing={0.5} key={name} dir={direction} sx={{ minWidth: 0 }}>
      <FormControlLabel
        sx={{ m: 0, alignSelf: direction === "rtl" ? "flex-end" : "flex-start" }}
        labelPlacement={direction === "rtl" ? "start" : "end"}
        control={
          <Switch
            size="small"
            disabled={disabled || !ownershipEditable}
            checked={modes[name] === "manual"}
            onChange={(event) => updateMode(name, event.target.checked)}
          />
        }
        label={modes[name] === "manual" ? t("manual") : t("automatic")}
      />
      <TextField
        fullWidth
        dir={direction}
        disabled={disabled || modes[name] === "automatic"}
        label={options.label}
        slotProps={{ htmlInput: { dir: direction } }}
        multiline={options.multiline}
        rows={options.rows}
        value={current[name]}
        onChange={(event) => updateField(name, event.target.value)}
        error={modes[name] === "manual" && current[name].length > FIELD_LIMITS[name]}
        helperText={
          <Guidance value={current[name]} maximum={FIELD_LIMITS[name]} direction={direction} />
        }
        sx={{
          minWidth: 0,
          "& .MuiInputBase-input": { textAlign: direction === "rtl" ? "right" : "left" },
          "& .MuiFormHelperText-root": { mx: 0, textAlign: direction === "rtl" ? "right" : "left" },
        }}
      />
      {modes[name] === "automatic" ? (
        <Typography
          variant="caption"
          color="text.secondary"
          dir={direction}
          sx={{ textAlign: direction === "rtl" ? "right" : "left" }}
        >
          {t("fallbackState")}
        </Typography>
      ) : null}
    </Stack>
  );

  const canonicalModeControl = (
    <FormControlLabel
      sx={{ m: 0, alignSelf: direction === "rtl" ? "flex-end" : "flex-start" }}
      labelPlacement={direction === "rtl" ? "start" : "end"}
      control={
        <Switch
          size="small"
          disabled={disabled || !ownershipEditable}
          checked={values.canonicalMode === "manual"}
          onChange={(event) =>
            onChange({ ...values, canonicalMode: event.target.checked ? "manual" : "automatic" })
          }
        />
      }
      label={values.canonicalMode === "manual" ? t("manual") : t("automatic")}
    />
  );

  const previewTitle = current.openGraphTitle || current.title || t("previewTitleFallback");
  const previewDescription =
    current.openGraphDescription || current.description || t("previewDescriptionFallback");
  const hasSocialValues = Boolean(
    current.openGraphTitle ||
    current.openGraphDescription ||
    current.twitterTitle ||
    current.twitterDescription,
  );

  return (
    <Stack spacing={2.5} dir={direction}>
      <Stack spacing={1}>
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
      </Stack>
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

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(0, 1.35fr) minmax(280px, 0.85fr)",
          },
          alignItems: "start",
          gap: 2.5,
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {field("title", { label: t("metaTitle") })}
          {field("description", { label: t("metaDescription"), multiline: true, rows: 3 })}
          {field("keywords", { label: t("keywords") })}
          <Stack spacing={0.5}>
            {canonicalModeControl}
            <TextField
              fullWidth
              dir="ltr"
              label={t("canonicalUrl")}
              disabled={disabled || values.canonicalMode === "automatic"}
              value={values.canonicalUrl}
              onChange={(event) => onChange({ ...values, canonicalUrl: event.target.value })}
              helperText={
                values.canonicalMode === "automatic" ? t("canonicalFallback") : t("canonicalHelp")
              }
              slotProps={{ htmlInput: { dir: "ltr" } }}
              sx={{ minWidth: 0, "& .MuiInputBase-input": { textAlign: "left" } }}
            />
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, minWidth: 0, overflow: "hidden" }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t("socialPreview")}
            </Typography>
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Box
                sx={{
                  aspectRatio: "1.91 / 1",
                  bgcolor: "action.hover",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {shareImageUrl ? (
                  <Box
                    component="img"
                    src={shareImageUrl}
                    alt={t("shareImageFallback")}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Typography color="text.secondary">{t("shareImageFallback")}</Typography>
                )}
              </Box>
              <Stack spacing={0.5} sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary" dir="ltr">
                  SARAKITCHEN.PT
                </Typography>
                <Typography sx={{ fontWeight: 700 }} dir={direction}>
                  {previewTitle.slice(0, 100)}
                </Typography>
                <Typography variant="body2" color="text.secondary" dir={direction}>
                  {previewDescription.slice(0, 220)}
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Box>

      <Accordion key={locale} defaultExpanded={hasSocialValues} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <Stack spacing={0.25}>
            <Typography sx={{ fontWeight: 700 }}>{t("socialOverrides")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("socialOverridesHint")}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
              gap: 2.5,
            }}
          >
            {field("openGraphTitle", { label: t("socialTitle") })}
            {field("openGraphDescription", {
              label: t("socialDescription"),
              multiline: true,
              rows: 2,
            })}
            {field("twitterTitle", { label: t("twitterTitle") })}
            {field("twitterDescription", {
              label: t("twitterDescription"),
              multiline: true,
              rows: 2,
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
