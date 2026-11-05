"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

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

function newQuestionId(): string {
  return `question-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function FaqSettingsForm({
  data,
  labelsTranslation,
  canEdit,
  onChange,
}: {
  data: RecordValue;
  labelsTranslation: RecordValue;
  canEdit: boolean;
  onChange: (value: RecordValue) => void;
}) {
  const translator = useTranslations("dashboard.settingsEditor.forms");
  const t = translator as unknown as Translator;
  const direction = useLocale() === "fa" ? "rtl" : "ltr";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const entries = records(data.entries).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const localizedEntries = records(labelsTranslation.entries);
  const updateEntries = (next: RecordValue[]) =>
    onChange({ ...data, entries: next.map((entry, order) => ({ ...entry, order })) });
  const addEntry = () => {
    const id = newQuestionId();
    updateEntries([...entries, { id, active: true, order: entries.length }]);
    setExpandedId(id);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }} dir={direction}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{t("faqQuestions")}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t("faqQuestionsHelp")}
            </Typography>
          </Box>
          <Button
            startIcon={<AddRounded />}
            variant="outlined"
            disabled={!canEdit || entries.length >= 100}
            onClick={addEntry}
          >
            {t("addFaqQuestion")}
          </Button>
        </Stack>

        {entries.length ? (
          <Stack spacing={1}>
            {entries.map((entry, index) => {
              const id = String(entry.id ?? "");
              const localized = localizedEntries.find((item) => String(item.id ?? "") === id);
              const title =
                String(localized?.question ?? "").trim() || t("itemNumber", { number: index + 1 });
              const enabled = Boolean(entry.active);
              return (
                <Accordion
                  key={id}
                  disableGutters
                  elevation={0}
                  expanded={expandedId === id}
                  onChange={(_, expanded) => setExpandedId(expanded ? id : null)}
                  sx={{
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                    <Stack
                      direction="row"
                      sx={{ minWidth: 0, alignItems: "center", gap: 1, flex: 1, pe: 1 }}
                    >
                      <Typography noWrap sx={{ minWidth: 0, fontWeight: 700 }}>
                        {title}
                      </Typography>
                      <Chip
                        size="small"
                        color={enabled ? "success" : "default"}
                        label={enabled ? t("active") : t("visibilityHidden")}
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                      >
                        <FormControlLabel
                          control={
                            <Switch
                              checked={enabled}
                              disabled={!canEdit}
                              onChange={(event) =>
                                updateEntries(
                                  entries.map((item, position) =>
                                    position === index
                                      ? { ...item, active: event.target.checked }
                                      : item,
                                  ),
                                )
                              }
                            />
                          }
                          label={t("active")}
                        />
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                          <IconButton
                            size="small"
                            aria-label={t("moveUp")}
                            disabled={!canEdit || index === 0}
                            onClick={() => {
                              const target = index - 1;
                              const next = [...entries];
                              [next[index], next[target]] = [next[target]!, next[index]!];
                              updateEntries(next);
                            }}
                          >
                            <ArrowUpwardRounded fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label={t("moveDown")}
                            disabled={!canEdit || index === entries.length - 1}
                            onClick={() => {
                              const next = [...entries];
                              [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                              updateEntries(next);
                            }}
                          >
                            <ArrowDownwardRounded fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={t("removeFaqQuestion")}
                            disabled={!canEdit}
                            onClick={() => {
                              updateEntries(entries.filter((_, position) => position !== index));
                              setExpandedId(null);
                            }}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {t("faqQuestionTranslationHelp")}
                      </Typography>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        ) : (
          <Box
            sx={{
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
              px: 2,
              py: 4,
              textAlign: "center",
            }}
          >
            <Typography color="text.secondary" variant="body2">
              {t("faqEmptyQuestions")}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
