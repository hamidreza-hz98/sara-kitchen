"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { SettingsPageSection } from "../settings-section-registry";
import { isStoredRichText, type StoredRichText } from "@/lib/rich-text";
import { EMPTY_STORED_RICH_TEXT, SettingsRichTextField } from "./settings-rich-text-field";

type Locale = "en" | "pt-PT" | "fa";
type RecordValue = Record<string, unknown>;
type TranslationSection = Exclude<SettingsPageSection, "homepage">;
type Field = Readonly<{
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  richText?: boolean;
  maxRows?: number;
}>;
type Translator = (key: string, values?: Record<string, string | number>) => string;
type FaqTranslationTab = "details" | "questions";
type PolicyTranslationTab = "details" | "sections";
type LanguageNameTab = "en" | "pt-PT" | "fa";
type AboutTranslationTab =
  "introduction" | "kitchenMedia" | "teamMembers" | "values" | "storySections" | "callsToAction";

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
function rows(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function emptyRichText() {
  return { schemaVersion: 1, document: { type: "doc", content: [] } };
}
function richText(value: unknown): StoredRichText {
  return isStoredRichText(value) ? value : EMPTY_STORED_RICH_TEXT;
}
function nextPolicySectionId(sections: readonly RecordValue[]): string {
  const existingIds = new Set(sections.map((item) => String(item.id ?? "")));
  let timestamp = Date.now();
  let id = `section-${timestamp.toString(36)}`;
  while (existingIds.has(id)) {
    timestamp += 1;
    id = `section-${timestamp.toString(36)}`;
  }
  return id;
}

function emptyTranslation(section: TranslationSection, english: RecordValue): RecordValue {
  if (section === "contact")
    return {
      phoneLabels: [],
      address: { line1: "", line2: "", city: "", region: "", country: "" },
      serviceArea: { name: "", description: "" },
      businessHoursNote: "",
      whatsappPrefilledMessage: "",
      mapLabel: "",
    };
  if (section === "social") return { labels: [] };
  if (section === "about")
    return {
      eyebrow: "",
      title: "",
      summary: "",
      content: emptyRichText(),
      heroMediaAlt: "",
      kitchenMedia: [],
      teamMembers: [],
      values: [],
      storySections: [],
      callsToAction: [],
    };
  if (section === "faq") return { title: "", description: "", entries: [] };
  if (section === "languages") return { displayNames: [] };
  const sections = rows(english.sections).map((item) => ({
    id: String(item.id ?? ""),
    title: "",
    content: emptyRichText(),
  }));
  return { title: "", summary: "", sections };
}

function TranslationSectionCard({
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
      <Stack spacing={1.5}>
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

function TranslationRows({
  locale,
  dataItems,
  localizedRows,
  idField,
  fields,
  disabled,
  t,
  onChange,
  collapsible = false,
  summaryField,
  summaryLabel = "itemNumber",
  canRemove = false,
  onRemove,
}: {
  locale: Locale;
  dataItems: readonly RecordValue[];
  localizedRows: readonly RecordValue[];
  idField: string;
  fields: readonly Field[];
  disabled: boolean;
  t: Translator;
  onChange: (rows: RecordValue[]) => void;
  collapsible?: boolean;
  summaryField?: string;
  summaryLabel?: "itemNumber" | "policySectionNumber";
  canRemove?: boolean;
  onRemove?: (id: string) => void;
}) {
  const idOf = (item: RecordValue) => String(item[idField] ?? "");
  const find = (id: string) => localizedRows.find((item) => idOf(item) === id);
  const updateRow = (id: string, key: string, value: unknown) => {
    const current = find(id);
    if (!current) {
      const base = Object.fromEntries(
        fields.map((field) => [field.key, field.richText ? emptyRichText() : ""]),
      );
      onChange([...localizedRows, { [idField]: id, ...base, [key]: value }]);
      return;
    }
    onChange(localizedRows.map((item) => (idOf(item) === id ? { ...item, [key]: value } : item)));
  };
  const begin = (id: string) => {
    if (find(id)) return;
    onChange([
      ...localizedRows,
      {
        [idField]: id,
        ...Object.fromEntries(
          fields.map((field) => [field.key, field.richText ? emptyRichText() : ""]),
        ),
      },
    ]);
  };
  if (dataItems.length === 0)
    return (
      <Typography color="text.secondary" variant="body2">
        {t("noItemsToTranslate")}
      </Typography>
    );
  return (
    <Stack spacing={1.25}>
      {dataItems.map((dataItem, index) => {
        const id = idOf(dataItem);
        const localized = find(id);
        const card = (
          <Card
            key={id}
            variant="outlined"
            sx={collapsible ? { border: 0, borderRadius: 0 } : undefined}
          >
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                >
                  {!collapsible ? (
                    <Typography sx={{ fontWeight: 700 }}>
                      {t("itemNumber", { number: index + 1 })}
                    </Typography>
                  ) : (
                    <Box sx={{ flex: 1 }} />
                  )}
                  <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                    {localized ? (
                      locale === "en" ? (
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={t("canonicalEnglish")}
                        />
                      ) : (
                        <Button
                          size="small"
                          disabled={disabled}
                          onClick={() =>
                            onChange(localizedRows.filter((item) => idOf(item) !== id))
                          }
                        >
                          {t("useEnglishFallback")}
                        </Button>
                      )
                    ) : (
                      <Button
                        size="small"
                        startIcon={<AddRounded />}
                        disabled={disabled}
                        onClick={() => begin(id)}
                      >
                        {locale === "en" ? t("addEnglishCopy") : t("addTranslatedCopy")}
                      </Button>
                    )}
                    {localized && canRemove && onRemove ? (
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={t("removePolicySection")}
                        disabled={disabled}
                        onClick={() => onRemove(id)}
                      >
                        <DeleteOutlineRounded fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>
                </Stack>
                {localized ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                      gap: 1.5,
                    }}
                  >
                    {fields.map((field) =>
                      field.richText ? (
                        <Box key={field.key} sx={{ gridColumn: { md: "span 2" } }}>
                          <SettingsRichTextField
                            label={field.label}
                            value={richText(localized[field.key])}
                            disabled={disabled}
                            direction={locale === "fa" ? "rtl" : "ltr"}
                            required={Boolean(field.required)}
                            onChange={(value) => updateRow(id, field.key, value)}
                          />
                        </Box>
                      ) : (
                        <TextField
                          key={field.key}
                          fullWidth
                          label={field.label}
                          value={String(localized[field.key] ?? "")}
                          disabled={disabled}
                          required={
                            Boolean(field.required) ||
                            (field.key === "mediaAlt" &&
                              locale === "en" &&
                              Boolean(dataItem.mediaId))
                          }
                          multiline={field.multiline}
                          minRows={field.multiline ? (field.maxRows ?? 2) : undefined}
                          dir={locale === "fa" ? "rtl" : "ltr"}
                          onChange={(event) => updateRow(id, field.key, event.target.value)}
                          sx={{ gridColumn: field.multiline ? { md: "span 2" } : undefined }}
                        />
                      ),
                    )}
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        );
        if (!collapsible) return card;
        const itemTitle = String(localized?.[summaryField ?? fields[0]?.key ?? ""] ?? "").trim();
        return (
          <Accordion
            key={id}
            disableGutters
            elevation={0}
            defaultExpanded={locale === "en" && index === 0}
            sx={{
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRounded />}
              dir={locale === "fa" ? "rtl" : "ltr"}
            >
              <Typography noWrap sx={{ minWidth: 0, fontWeight: 700 }}>
                {itemTitle || t(summaryLabel, { number: index + 1 })}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>{card}</AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}

export function SettingsTranslationForm({
  section,
  data,
  locale,
  value,
  englishValue,
  disabled,
  onChange,
  onClear,
  onEnglishChange,
}: {
  section: TranslationSection;
  data: RecordValue;
  locale: Locale;
  value: RecordValue | null;
  englishValue: RecordValue;
  disabled: boolean;
  onChange: (value: RecordValue) => void;
  onClear: () => void;
  onEnglishChange: (value: RecordValue) => void;
}) {
  const translator = useTranslations("dashboard.settingsEditor.forms");
  const t = translator as unknown as Translator;
  const uiDirection = useLocale() === "fa" ? "rtl" : "ltr";
  const direction = locale === "fa" ? "rtl" : "ltr";
  const [aboutTab, setAboutTab] = useState<AboutTranslationTab>("introduction");
  const [faqTab, setFaqTab] = useState<FaqTranslationTab>("details");
  const [policyTab, setPolicyTab] = useState<PolicyTranslationTab>("details");
  const [languageNameTab, setLanguageNameTab] = useState<LanguageNameTab>("en");
  if (locale !== "en" && !value)
    return (
      <Stack spacing={1.5}>
        <Typography variant="h6">{t("localizedSection")}</Typography>
        <Typography color="text.secondary">{t("optionalTranslationHelp")}</Typography>
        <Button
          startIcon={<AddRounded />}
          disabled={disabled}
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
          onClick={() => onChange(emptyTranslation(section, englishValue))}
        >
          {t("addThisLanguage")}
        </Button>
      </Stack>
    );

  const content = value ?? emptyTranslation(section, englishValue);
  const update = (patch: RecordValue) =>
    locale === "en" && section === "terms"
      ? onEnglishChange({ ...content, ...patch })
      : onChange({ ...content, ...patch });
  const updateRows = (key: string, next: RecordValue[]) => update({ [key]: next });
  const languageDisplayNames = rows(content.displayNames);
  const updateLanguageName = (targetLocale: LanguageNameTab, patch: RecordValue) => {
    const current = languageDisplayNames.find((item) => item.locale === targetLocale) ?? {
      locale: targetLocale,
      name: "",
      shortName: "",
    };
    const next = languageDisplayNames.some((item) => item.locale === targetLocale)
      ? languageDisplayNames.map((item) =>
          item.locale === targetLocale ? { ...item, ...patch } : item,
        )
      : [...languageDisplayNames, { ...current, ...patch }];
    update({ displayNames: next });
  };
  const selectedLanguageName = languageDisplayNames.find(
    (item) => item.locale === languageNameTab,
  ) ?? { locale: languageNameTab, name: "", shortName: "" };
  const requiredText = (key: string, label: string, multiline = false, maxRows = 3) => (
    <TextField
      fullWidth
      label={label}
      value={String(content[key] ?? "")}
      disabled={disabled}
      required
      multiline={multiline}
      minRows={multiline ? maxRows : undefined}
      dir={direction}
      onChange={(event) => update({ [key]: event.target.value })}
    />
  );

  return (
    <Stack spacing={2.5} dir={uiDirection}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">{t("localizedSection")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {locale === "en" ? t("canonicalContentHelp") : t("localizedContentHelp")}
          </Typography>
        </Box>
        {locale !== "en" ? (
          <Button disabled={disabled} onClick={onClear}>
            {t("useEnglishFallback")}
          </Button>
        ) : null}
      </Stack>

      {section === "contact" ? (
        <>
          <TranslationSectionCard title={t("contactAddressTranslation")}>
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
            >
              {(["line1", "line2", "city", "region", "country"] as const).map((key) => (
                <TextField
                  key={key}
                  fullWidth
                  label={t(`address.${key}`)}
                  value={String(record(content.address)[key] ?? "")}
                  disabled={disabled}
                  required={key !== "line2" && key !== "region"}
                  dir={direction}
                  onChange={(event) =>
                    update({ address: { ...record(content.address), [key]: event.target.value } })
                  }
                />
              ))}
            </Box>
          </TranslationSectionCard>
          <TranslationSectionCard
            title={t("contactPhoneLabels")}
            description={t("contactPhoneLabelsHelp")}
          >
            <TranslationRows
              locale={locale}
              dataItems={rows(data.phones)}
              localizedRows={rows(content.phoneLabels)}
              idField="id"
              fields={[{ key: "label", label: t("phoneLabel"), required: true }]}
              disabled={disabled}
              t={t}
              onChange={(phoneLabels) => updateRows("phoneLabels", phoneLabels)}
            />
          </TranslationSectionCard>
          <TranslationSectionCard title={t("serviceAreaTranslation")}>
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
            >
              <TextField
                fullWidth
                label={t("serviceAreaName")}
                value={String(record(content.serviceArea).name ?? "")}
                disabled={disabled}
                required
                dir={direction}
                onChange={(event) =>
                  update({
                    serviceArea: { ...record(content.serviceArea), name: event.target.value },
                  })
                }
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t("serviceAreaDescription")}
                value={String(record(content.serviceArea).description ?? "")}
                disabled={disabled}
                required
                dir={direction}
                onChange={(event) =>
                  update({
                    serviceArea: {
                      ...record(content.serviceArea),
                      description: event.target.value,
                    },
                  })
                }
              />
            </Box>
          </TranslationSectionCard>
          <TranslationSectionCard title={t("contactMoreTranslation")}>
            <Box
              sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
            >
              <TextField
                fullWidth
                label={t("mapLabel")}
                value={String(content.mapLabel ?? "")}
                disabled={disabled}
                required
                dir={direction}
                onChange={(event) => update({ mapLabel: event.target.value })}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t("businessHoursNote")}
                value={String(content.businessHoursNote ?? "")}
                disabled={disabled}
                dir={direction}
                onChange={(event) => update({ businessHoursNote: event.target.value })}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label={t("whatsappPrefilledMessage")}
                value={String(content.whatsappPrefilledMessage ?? "")}
                disabled={disabled}
                dir={direction}
                onChange={(event) => update({ whatsappPrefilledMessage: event.target.value })}
              />
            </Box>
          </TranslationSectionCard>
        </>
      ) : null}

      {section === "social" ? (
        <TranslationSectionCard
          title={t("socialLinkLabels")}
          description={t("socialLinkLabelsHelp")}
        >
          <TranslationRows
            locale={locale}
            dataItems={rows(data.links)}
            localizedRows={rows(content.labels)}
            idField="id"
            fields={[{ key: "label", label: t("socialLabel"), required: true }]}
            disabled={disabled}
            t={t}
            onChange={(labels) => updateRows("labels", labels)}
          />
        </TranslationSectionCard>
      ) : null}

      {section === "about" ? (
        <>
          <Tabs
            value={aboutTab}
            onChange={(_, value: AboutTranslationTab) => setAboutTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t("aboutEditorTabs")}
          >
            <Tab value="introduction" label={t("aboutIntroduction")} />
            <Tab
              value="kitchenMedia"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("kitchenGalleryTranslation")}</span>
                  <Chip
                    size="small"
                    label={Array.isArray(data.kitchenMediaIds) ? data.kitchenMediaIds.length : 0}
                  />
                </Stack>
              }
            />
            <Tab
              value="teamMembers"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("aboutTeamTranslation")}</span>
                  <Chip size="small" label={rows(data.teamMembers).length} />
                </Stack>
              }
            />
            <Tab
              value="values"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("aboutValuesTranslation")}</span>
                  <Chip size="small" label={rows(data.values).length} />
                </Stack>
              }
            />
            <Tab
              value="storySections"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("aboutStoriesTranslation")}</span>
                  <Chip size="small" label={rows(data.storySections).length} />
                </Stack>
              }
            />
            <Tab
              value="callsToAction"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("aboutActionsTranslation")}</span>
                  <Chip size="small" label={rows(data.callsToAction).length} />
                </Stack>
              }
            />
          </Tabs>
          {aboutTab === "introduction" ? (
            <TranslationSectionCard title={t("aboutIntroduction")}>
              <Stack spacing={1.5}>
                <TextField
                  fullWidth
                  label={t("eyebrow")}
                  value={String(content.eyebrow ?? "")}
                  disabled={disabled}
                  dir={direction}
                  onChange={(event) => update({ eyebrow: event.target.value })}
                />
                {requiredText("title", t("aboutTitle"))}
                {requiredText("summary", t("aboutSummary"), true)}
                <SettingsRichTextField
                  label={t("aboutContent")}
                  value={richText(content.content)}
                  disabled={disabled}
                  direction={direction}
                  required
                  onChange={(contentValue) => update({ content: contentValue })}
                />
                {typeof data.heroMediaId === "string" ? (
                  <TextField
                    fullWidth
                    label={t("heroImageAlt")}
                    value={String(content.heroMediaAlt ?? "")}
                    disabled={disabled}
                    required={locale === "en"}
                    dir={direction}
                    onChange={(event) => update({ heroMediaAlt: event.target.value })}
                  />
                ) : null}
              </Stack>
            </TranslationSectionCard>
          ) : null}
          {aboutTab === "kitchenMedia" ? (
            <TranslationSectionCard title={t("kitchenGalleryTranslation")}>
              <TranslationRows
                locale={locale}
                dataItems={(Array.isArray(data.kitchenMediaIds) ? data.kitchenMediaIds : []).map(
                  (mediaId) => ({ mediaId }),
                )}
                localizedRows={rows(content.kitchenMedia)}
                idField="mediaId"
                fields={[{ key: "alt", label: t("imageDescription"), required: true }]}
                disabled={disabled}
                t={t}
                onChange={(kitchenMedia) => updateRows("kitchenMedia", kitchenMedia)}
              />
            </TranslationSectionCard>
          ) : null}
          {aboutTab === "teamMembers" ? (
            <TranslationSectionCard title={t("aboutTeamTranslation")}>
              <TranslationRows
                locale={locale}
                dataItems={rows(data.teamMembers)}
                localizedRows={rows(content.teamMembers)}
                idField="id"
                fields={[
                  { key: "name", label: t("personName"), required: true },
                  { key: "role", label: t("personRole") },
                  { key: "bio", label: t("personBio"), multiline: true },
                  { key: "portraitAlt", label: t("portraitAlt"), required: true },
                ]}
                disabled={disabled}
                t={t}
                onChange={(teamMembers) => updateRows("teamMembers", teamMembers)}
              />
            </TranslationSectionCard>
          ) : null}
          {aboutTab === "values" ? (
            <TranslationSectionCard title={t("aboutValuesTranslation")}>
              <TranslationRows
                locale={locale}
                dataItems={rows(data.values)}
                localizedRows={rows(content.values)}
                idField="id"
                fields={[
                  { key: "title", label: t("valueTitle"), required: true },
                  {
                    key: "description",
                    label: t("valueDescription"),
                    required: true,
                    multiline: true,
                  },
                ]}
                disabled={disabled}
                t={t}
                onChange={(values) => updateRows("values", values)}
              />
            </TranslationSectionCard>
          ) : null}
          {aboutTab === "storySections" ? (
            <TranslationSectionCard title={t("aboutStoriesTranslation")}>
              <TranslationRows
                locale={locale}
                dataItems={rows(data.storySections)}
                localizedRows={rows(content.storySections)}
                idField="id"
                fields={[
                  { key: "title", label: t("storyTitle"), required: true },
                  { key: "content", label: t("storyContent"), required: true, richText: true },
                  { key: "mediaAlt", label: t("imageDescription") },
                ]}
                disabled={disabled}
                t={t}
                onChange={(storySections) => updateRows("storySections", storySections)}
              />
            </TranslationSectionCard>
          ) : null}
          {aboutTab === "callsToAction" ? (
            <TranslationSectionCard title={t("aboutActionsTranslation")}>
              <TranslationRows
                locale={locale}
                dataItems={rows(data.callsToAction)}
                localizedRows={rows(content.callsToAction)}
                idField="id"
                fields={[{ key: "label", label: t("buttonLabel"), required: true }]}
                disabled={disabled}
                t={t}
                onChange={(callsToAction) => updateRows("callsToAction", callsToAction)}
              />
            </TranslationSectionCard>
          ) : null}
        </>
      ) : null}

      {section === "faq" ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {t("faqTranslationHelp")}
          </Typography>
          <Tabs
            value={faqTab}
            onChange={(_, tab: FaqTranslationTab) => setFaqTab(tab)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t("faqTranslationTabs")}
          >
            <Tab value="details" label={t("faqSectionDetails")} />
            <Tab
              value="questions"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("faqQuestions")}</span>
                  <Chip size="small" label={rows(data.entries).length} />
                </Stack>
              }
            />
          </Tabs>
          {faqTab === "details" ? (
            <TranslationSectionCard title={t("faqCopy")}>
              <Stack spacing={1.5}>
                {requiredText("title", t("faqTitle"))}
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t("faqDescription")}
                  value={String(content.description ?? "")}
                  disabled={disabled}
                  dir={direction}
                  onChange={(event) => update({ description: event.target.value })}
                />
              </Stack>
            </TranslationSectionCard>
          ) : (
            <TranslationSectionCard title={t("faqQuestions")} description={t("faqQuestionsHelp")}>
              <TranslationRows
                locale={locale}
                dataItems={rows(data.entries)}
                localizedRows={rows(content.entries)}
                idField="id"
                fields={[
                  { key: "question", label: t("faqQuestion"), required: true },
                  {
                    key: "answer",
                    label: t("faqAnswer"),
                    required: true,
                    multiline: true,
                    maxRows: 4,
                  },
                ]}
                disabled={disabled}
                t={t}
                collapsible
                onChange={(entries) => updateRows("entries", entries)}
              />
            </TranslationSectionCard>
          )}
        </Stack>
      ) : null}

      {section === "languages" ? (
        <TranslationSectionCard title={t("languageNames")} description={t("languageNamesHelp")}>
          <Stack spacing={1.5}>
            <Tabs
              value={languageNameTab}
              onChange={(_, tab: LanguageNameTab) => setLanguageNameTab(tab)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label={t("languageNameTabs")}
            >
              {(["en", "pt-PT", "fa"] as const).map((targetLocale) => (
                <Tab
                  key={targetLocale}
                  value={targetLocale}
                  label={t(`language.${targetLocale}`)}
                />
              ))}
            </Tabs>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <Chip size="small" variant="outlined" label={languageNameTab.toUpperCase()} />
                    <Typography sx={{ fontWeight: 700 }}>
                      {t(`language.${languageNameTab}`)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <TextField
                      fullWidth
                      label={t("languageName")}
                      required
                      value={String(selectedLanguageName.name ?? "")}
                      disabled={disabled}
                      dir={direction}
                      onChange={(event) =>
                        updateLanguageName(languageNameTab, { name: event.target.value })
                      }
                    />
                    <TextField
                      fullWidth
                      label={t("shortLanguageName")}
                      required
                      value={String(selectedLanguageName.shortName ?? "")}
                      disabled={disabled}
                      dir={direction}
                      onChange={(event) =>
                        updateLanguageName(languageNameTab, { shortName: event.target.value })
                      }
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TranslationSectionCard>
      ) : null}

      {section === "terms" ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {t("policyTranslationHelp")}
          </Typography>
          <Tabs
            value={policyTab}
            onChange={(_, tab: PolicyTranslationTab) => setPolicyTab(tab)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t("policyTranslationTabs")}
          >
            <Tab value="details" label={t("policyIntroduction")} />
            <Tab
              value="sections"
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{t("policySections")}</span>
                  <Chip size="small" label={rows(englishValue.sections).length} />
                </Stack>
              }
            />
          </Tabs>
          {policyTab === "details" ? (
            <TranslationSectionCard title={t("policyIntroduction")}>
              <Stack spacing={1.5}>
                {requiredText("title", t("policyTitle"))}
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t("policySummary")}
                  value={String(content.summary ?? "")}
                  disabled={disabled}
                  dir={direction}
                  onChange={(event) => update({ summary: event.target.value })}
                />
              </Stack>
            </TranslationSectionCard>
          ) : (
            <TranslationSectionCard
              title={t("policySections")}
              description={t("policySectionsHelp")}
              action={
                locale === "en" ? (
                  <Button
                    startIcon={<AddRounded />}
                    disabled={disabled || rows(content.sections).length >= 40}
                    variant="outlined"
                    onClick={() => {
                      const sections = rows(content.sections);
                      update({
                        sections: [
                          ...sections,
                          {
                            id: nextPolicySectionId(sections),
                            title: "",
                            content: emptyRichText(),
                          },
                        ],
                      });
                    }}
                  >
                    {t("addPolicySection")}
                  </Button>
                ) : undefined
              }
            >
              <TranslationRows
                locale={locale}
                dataItems={rows(englishValue.sections)}
                localizedRows={rows(content.sections)}
                idField="id"
                fields={[
                  { key: "title", label: t("policySectionTitle"), required: true },
                  {
                    key: "content",
                    label: t("policySectionContent"),
                    required: true,
                    richText: true,
                  },
                ]}
                disabled={disabled}
                t={t}
                collapsible
                summaryField="title"
                summaryLabel="policySectionNumber"
                canRemove={locale === "en" && rows(content.sections).length > 1}
                onRemove={(id) =>
                  update({
                    sections: rows(content.sections).filter((item) => String(item.id) !== id),
                  })
                }
                onChange={(sections) => update({ sections })}
              />
            </TranslationSectionCard>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
