"use client";

import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";

type RecordValue = Record<string, unknown>;
type Translator = (key: string, values?: Record<string, string | number>) => string;

function records(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? (item as RecordValue)
          : {},
      )
    : [];
}

function move<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function LanguageSettingsForm({
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
  const locales = records(data.locales).sort(
    (left, right) => Number(left.order ?? 0) - Number(right.order ?? 0),
  );
  const activeLocales = locales.filter((entry) => entry.visibility === "active");
  const fallbackOrder = Array.isArray(data.fallbackOrder) ? data.fallbackOrder.map(String) : [];
  const update = (patch: RecordValue) => onChange({ ...data, ...patch });

  const updateLocales = (next: RecordValue[]) => {
    const ordered: RecordValue[] = next.map((entry, order) => ({ ...entry, order }));
    const nextActive = ordered
      .filter((entry) => entry.visibility === "active")
      .map((entry) => String(entry.locale));
    const defaultLocale = nextActive.includes(String(data.defaultLocale))
      ? data.defaultLocale
      : (nextActive[0] ?? "en");
    const nextFallbackOrder = Array.isArray(data.fallbackOrder)
      ? data.fallbackOrder.map(String).filter((entry) => nextActive.includes(entry))
      : [];
    for (const locale of nextActive) {
      if (!nextFallbackOrder.includes(locale)) nextFallbackOrder.push(locale);
    }
    update({ locales: ordered, defaultLocale, fallbackOrder: nextFallbackOrder });
  };

  return (
    <Stack spacing={2.5} dir={direction}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{t("localeAvailability")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("localeAvailabilityHelp")}
            </Typography>
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {locales.map((entry, index) => {
              const locale = String(entry.locale);
              const isActive = entry.visibility === "active";
              return (
                <Card key={locale} variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                      >
                        <Stack direction="row" sx={{ alignItems: "center", gap: 1, minWidth: 0 }}>
                          <Chip size="small" variant="outlined" label={locale.toUpperCase()} />
                          <Typography noWrap sx={{ fontWeight: 700 }}>
                            {t(`language.${locale}`)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            aria-label={t("moveUp")}
                            disabled={!canEdit || index === 0}
                            onClick={() => updateLocales(move(locales, index, -1))}
                          >
                            <ArrowUpwardRounded fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={t("moveDown")}
                            disabled={!canEdit || index === locales.length - 1}
                            onClick={() => updateLocales(move(locales, index, 1))}
                          >
                            <ArrowDownwardRounded fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <FormControl fullWidth disabled={!canEdit} size="small">
                        <InputLabel id={`locale-visibility-${locale}`}>
                          {t("visibility")}
                        </InputLabel>
                        <Select
                          labelId={`locale-visibility-${locale}`}
                          label={t("visibility")}
                          value={String(entry.visibility)}
                          onChange={(event) => {
                            const visibility = event.target.value;
                            if (visibility !== "active" && activeLocales.length <= 1) return;
                            updateLocales(
                              locales.map((item) =>
                                String(item.locale) === locale ? { ...item, visibility } : item,
                              ),
                            );
                          }}
                        >
                          <MenuItem value="active">{t("visibilityActive")}</MenuItem>
                          <MenuItem
                            value="maintenance"
                            disabled={isActive && activeLocales.length <= 1}
                          >
                            {t("visibilityMaintenance")}
                          </MenuItem>
                          <MenuItem value="hidden" disabled={isActive && activeLocales.length <= 1}>
                            {t("visibilityHidden")}
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1.5, alignItems: { sm: "center" } }}
            >
              <Box sx={{ minWidth: { sm: 220 } }}>
                <Typography sx={{ fontWeight: 700 }}>{t("defaultLanguage")}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("defaultLanguageHelp")}
                </Typography>
              </Box>
              <FormControl fullWidth disabled={!canEdit} size="small">
                <InputLabel id="default-locale">{t("defaultLanguage")}</InputLabel>
                <Select
                  labelId="default-locale"
                  label={t("defaultLanguage")}
                  value={String(data.defaultLocale ?? "en")}
                  onChange={(event) => update({ defaultLocale: event.target.value })}
                >
                  {activeLocales.map((entry) => {
                    const locale = String(entry.locale);
                    return (
                      <MenuItem key={locale} value={locale}>
                        {t(`language.${locale}`)}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="h6">{t("languageFallbackOrder")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("languageFallbackHelp")}
            </Typography>
          </Box>
          <Stack spacing={0.75}>
            {fallbackOrder.map((locale, index) => (
              <Paper key={locale} variant="outlined" sx={{ px: 1.5, py: 0.75 }}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                >
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <Chip size="small" color="primary" variant="outlined" label={index + 1} />
                    <Typography sx={{ fontWeight: 600 }}>{t(`language.${locale}`)}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.25}>
                    <IconButton
                      size="small"
                      aria-label={t("moveUp")}
                      disabled={!canEdit || index === 0}
                      onClick={() => update({ fallbackOrder: move(fallbackOrder, index, -1) })}
                    >
                      <ArrowUpwardRounded fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t("moveDown")}
                      disabled={!canEdit || index === fallbackOrder.length - 1}
                      onClick={() => update({ fallbackOrder: move(fallbackOrder, index, 1) })}
                    >
                      <ArrowDownwardRounded fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
