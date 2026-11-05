"use client";

import CloudDoneRounded from "@mui/icons-material/CloudDoneRounded";
import PreviewRounded from "@mui/icons-material/PreviewRounded";
import PublishRounded from "@mui/icons-material/PublishRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/ui";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import type {
  HomepageSettingsData,
  HomepageSettingsTranslationValue,
} from "@/server/modules/settings";

import {
  createInitialSettingsPayload,
  type SettingsPageDefinition,
  type SettingsPageSection,
} from "../settings-section-registry";
import { HomepageSettingsEditor, HomepageTranslationsEditor } from "./homepage-settings-editor";
import { SettingsDataForm } from "./settings-data-forms";
import { SettingsTranslationForm } from "./settings-translation-forms";

type Locale = "en" | "pt-PT" | "fa";
type JsonObject = Record<string, unknown>;
type ApiEnvelope = Readonly<{ data?: unknown; error?: Readonly<{ message?: string }> }>;
type MutableSnapshot = Readonly<{
  draft: Readonly<{ payload: JsonObject; revision: number }> | null;
  published: Readonly<{ payload: JsonObject; revision: number }> | null;
}>;
type PolicySnapshot = Readonly<{
  id: string;
  documentType: string;
  version: number;
  state: string;
  effectiveAt: string;
  sectionIds: string[];
  translations: unknown;
}>;

const LOCALES: readonly Locale[] = ["en", "pt-PT", "fa"];
const POLICY_TYPE_TRANSLATIONS = {
  "terms-of-service": "forms.policyTypes.terms-of-service",
  "privacy-policy": "forms.policyTypes.privacy-policy",
  "marketing-consent": "forms.policyTypes.marketing-consent",
  "delivery-policy": "forms.policyTypes.delivery-policy",
  "refund-policy": "forms.policyTypes.refund-policy",
} as const;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function readJson(value: string): JsonObject | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return asObject(parsed);
  } catch {
    return null;
  }
}

function translationMap(payload: JsonObject, terms: boolean): Record<Locale, string> {
  const result: Record<Locale, string> = { en: "", "pt-PT": "", fa: "" };
  const translations = Array.isArray(payload.translations) ? payload.translations : [];
  for (const item of translations) {
    const translation = asObject(item);
    const locale = translation.locale;
    if (!LOCALES.includes(locale as Locale)) continue;
    if (terms) {
      const value = { ...translation };
      delete value.locale;
      result[locale as Locale] = pretty(value);
    } else {
      result[locale as Locale] = pretty(translation.value ?? {});
    }
  }
  return result;
}

function initialDraft(section: SettingsPageSection) {
  const payload = createInitialSettingsPayload(section);
  return {
    dataText: section === "terms" ? "" : pretty(payload.data ?? {}),
    translations: translationMap(payload, section === "terms"),
    documentType: String(payload.documentType ?? "terms-of-service"),
    version: String(payload.version ?? 1),
    effectiveAt: String(payload.effectiveAt ?? ""),
    policyId: null as string | null,
    publishable: false,
  };
}

function policyPayload(policy: PolicySnapshot): JsonObject {
  return {
    documentType: policy.documentType,
    version: policy.version,
    effectiveAt: policy.effectiveAt.slice(0, 10),
    sectionIds: policy.sectionIds,
    translations: policy.translations,
  };
}

function editorState(section: SettingsPageSection, response: unknown) {
  if (section === "terms") {
    const policies = Array.isArray(response) ? (response as PolicySnapshot[]) : [];
    const draft = policies.find(({ state }) => state === "draft");
    const latest = policies[0];
    if (!draft && !latest) return initialDraft(section);
    const source = draft ?? latest!;
    const payload = policyPayload(source);
    if (!draft) payload.version = Math.max(...policies.map(({ version }) => version), 0) + 1;
    return {
      dataText: "",
      translations: translationMap(payload, true),
      documentType: String(payload.documentType),
      version: String(payload.version),
      effectiveAt: String(payload.effectiveAt),
      policyId: draft?.id ?? null,
      publishable: Boolean(draft),
    };
  }
  const snapshot = response as MutableSnapshot | null;
  const payload = snapshot?.draft?.payload ?? snapshot?.published?.payload;
  if (!payload) return initialDraft(section);
  return {
    dataText: pretty(payload.data ?? {}),
    translations: translationMap(payload, false),
    documentType: "",
    version: "",
    effectiveAt: "",
    policyId: null,
    publishable: Boolean(snapshot?.draft),
  };
}

function stableKey(state: ReturnType<typeof initialDraft>): string {
  return JSON.stringify(state);
}

export function SettingsSectionEditor({
  canEdit,
  canUploadMedia = false,
  definition,
}: {
  canEdit: boolean;
  canUploadMedia?: boolean;
  definition: SettingsPageDefinition;
}) {
  const t = useTranslations("dashboard.settingsEditor");
  const [locale, setLocale] = useState<Locale>("en");
  const [state, setState] = useState(() => initialDraft(definition.key));
  const [initial, setInitial] = useState(() => initialDraft(definition.key));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = useMemo(() => stableKey(state) !== stableKey(initial), [state, initial]);
  const parsedData = useMemo(() => readJson(state.dataText), [state.dataText]);
  const parsedTranslation = useMemo(
    () => readJson(state.translations[locale]),
    [locale, state.translations],
  );

  const apply = useCallback((patch: Partial<typeof state>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);
  const setTranslation = useCallback(
    (target: Locale, value: JsonObject) =>
      setState((current) => ({
        ...current,
        translations: { ...current.translations, [target]: pretty(value) },
      })),
    [],
  );
  const setHomepageData = useCallback((data: HomepageSettingsData) => {
    setState((current) => {
      const fields = [
        [
          "heroSlides",
          "id",
          (id: string) => ({ id, title: "", description: "", ctaLabel: "", imageAlt: "" }),
        ],
        ["linkedBanners", "id", (id: string) => ({ id, title: "", imageAlt: "" })],
        ["benefits", "id", (id: string) => ({ id, title: "", description: "" })],
        ["testimonials", "id", (id: string) => ({ id, authorName: "", authorRole: "", quote: "" })],
        [
          "categoryBanners",
          "categoryId",
          (categoryId: string) => ({ categoryId, title: "", imageAlt: "" }),
        ],
      ] as const;
      const translations = { ...current.translations };
      const english = readJson(translations.en) ?? {};
      for (const language of LOCALES) {
        const localized = readJson(translations[language]);
        if (!localized && language !== "en") continue;
        const target = localized ?? english;
        for (const [key, idField, createTranslation] of fields) {
          const configuredItems = data[key] as unknown as readonly JsonObject[];
          const ids = new Set(configuredItems.map((item) => String(item[idField] ?? "")));
          const existingRows = Array.isArray(target[key]) ? (target[key] as unknown[]) : [];
          const retainedRows = existingRows.filter((item) =>
            ids.has(String(asObject(item)[idField] ?? "")),
          );
          target[key] =
            language === "en"
              ? [
                  ...retainedRows,
                  ...configuredItems
                    .filter(
                      (item) =>
                        !existingRows.some(
                          (row) =>
                            String(asObject(row)[idField] ?? "") === String(item[idField] ?? ""),
                        ),
                    )
                    .map((item) => createTranslation(String(item[idField]))),
                ]
              : retainedRows;
        }
        if (language === "en") {
          translations.en = pretty(target);
        } else if (localized) {
          translations[language] = pretty(target);
        }
      }
      return { ...current, dataText: pretty(data), translations };
    });
  }, []);
  const setStructuredData = useCallback(
    (data: JsonObject) => {
      setState((current) => {
        const collectionConfigs = {
          contact: [["phones", "phoneLabels", "id", (id: string) => ({ id, label: "" })]],
          social: [["links", "labels", "id", (id: string) => ({ id, label: "" })]],
          about: [
            [
              "kitchenMediaIds",
              "kitchenMedia",
              "mediaId",
              (mediaId: string) => ({ mediaId, alt: "" }),
            ],
            [
              "teamMembers",
              "teamMembers",
              "id",
              (id: string) => ({ id, name: "", role: "", bio: "", portraitAlt: "" }),
            ],
            ["values", "values", "id", (id: string) => ({ id, title: "", description: "" })],
            [
              "storySections",
              "storySections",
              "id",
              (id: string) => ({
                id,
                title: "",
                content: { schemaVersion: 1, document: { type: "doc", content: [] } },
                mediaAlt: "",
              }),
            ],
            ["callsToAction", "callsToAction", "id", (id: string) => ({ id, label: "" })],
          ],
          faq: [["entries", "entries", "id", (id: string) => ({ id, question: "", answer: "" })]],
        } as const;
        const config = collectionConfigs[definition.key as keyof typeof collectionConfigs];
        if (!config) return { ...current, dataText: pretty(data) };
        const translations = { ...current.translations };
        for (const language of LOCALES) {
          const existing = readJson(translations[language]);
          if (!existing && language !== "en") continue;
          const target = existing ?? {};
          for (const [dataKey, translationKey, idKey, createTranslation] of config) {
            const rawItems = data[dataKey];
            const items = Array.isArray(rawItems)
              ? rawItems.map((item) =>
                  dataKey === "kitchenMediaIds" ? { [idKey]: String(item) } : asObject(item),
                )
              : [];
            const expectedIds = new Set(items.map((item) => String(item[idKey] ?? "")));
            const existingRows = Array.isArray(target[translationKey])
              ? (target[translationKey] as unknown[])
              : [];
            const retained = existingRows.filter((item) =>
              expectedIds.has(String(asObject(item)[idKey] ?? "")),
            );
            target[translationKey] =
              language === "en"
                ? [
                    ...retained,
                    ...items
                      .filter(
                        (item) =>
                          !existingRows.some(
                            (row) =>
                              String(asObject(row)[idKey] ?? "") === String(item[idKey] ?? ""),
                          ),
                      )
                      .map((item) => createTranslation(String(item[idKey] ?? ""))),
                  ]
                : retained;
          }
          translations[language] = pretty(target);
        }
        return { ...current, dataText: pretty(data), translations };
      });
    },
    [definition.key],
  );
  const setStructuredTranslation = useCallback(
    (target: Locale, value: JsonObject) => {
      setState((current) => {
        const translations = { ...current.translations, [target]: pretty(value) };
        if (definition.key === "terms" && target === "en") {
          const ids = new Set(
            (Array.isArray(value.sections) ? value.sections : []).map((item) =>
              String(asObject(item).id ?? ""),
            ),
          );
          for (const language of LOCALES.filter((item) => item !== "en")) {
            const localized = readJson(translations[language]);
            if (!localized || !Array.isArray(localized.sections)) continue;
            translations[language] = pretty({
              ...localized,
              sections: localized.sections.filter((item) =>
                ids.has(String(asObject(item).id ?? "")),
              ),
            });
          }
        }
        return { ...current, translations };
      });
    },
    [definition.key],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/settings/${definition.key}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("load_failed");
      const body = (await response.json()) as ApiEnvelope;
      const next = editorState(definition.key, body.data);
      setState(next);
      setInitial(next);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [definition.key, t]);

  useEffect(() => {
    queueMicrotask(() => {
      load().catch(() => undefined);
    });
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey)
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.href !== window.location.href
      ) {
        if (!window.confirm(t("leaveWarning"))) event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, t]);

  function assemblePayload(): JsonObject | null {
    const translations: JsonObject[] = LOCALES.flatMap((language) => {
      const text = state.translations[language].trim();
      if (!text) return [];
      const value = readJson(text);
      if (!value) return [];
      return definition.key === "terms"
        ? [{ locale: language, ...value }]
        : [{ locale: language, value }];
    });
    if (definition.key === "terms") {
      const english = translations.some((translation) => translation.locale === "en");
      if (!english) return null;
      const englishValue = translations.find((translation) => translation.locale === "en");
      const sections = Array.isArray(englishValue?.sections)
        ? (englishValue.sections as unknown[])
        : [];
      return {
        documentType: state.documentType,
        version: Number(state.version),
        effectiveAt: state.effectiveAt,
        sectionIds: sections.map((entry) => String(asObject(entry).id ?? "")),
        translations,
      };
    }
    if (!parsedData || !translations.some((translation) => translation.locale === "en"))
      return null;
    return { data: parsedData, translations };
  }

  async function save() {
    const payload = assemblePayload();
    setError("");
    setNotice("");
    if (!payload) {
      setError(t("invalidJson"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/${definition.key}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ApiEnvelope;
      if (!response.ok) {
        setError(body.error?.message ?? t("saveError"));
        return;
      }
      const next = editorState(
        definition.key,
        definition.key === "terms" ? [body.data] : body.data,
      );
      setState(next);
      setInitial(next);
      setNotice(definition.policy === "direct" ? t("savedPublished") : t("draftSaved"));
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (dirty || !state.publishable) return;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const requestInit: RequestInit = {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        ...(definition.key === "terms"
          ? { body: JSON.stringify({ policyVersionId: state.policyId }) }
          : {}),
      };
      const response = await fetch(`/api/settings/${definition.key}/publish`, requestInit);
      if (!response.ok) {
        const body = (await response.json()) as ApiEnvelope;
        setError(body.error?.message ?? t("publishError"));
        return;
      }
      setNotice(t("published"));
      await load();
    } catch {
      setError(t("publishError"));
    } finally {
      setPublishing(false);
    }
  }

  if (loading)
    return (
      <Stack sx={{ alignItems: "center", p: 8 }}>
        <CircularProgress aria-label={t("loading")} />
      </Stack>
    );
  if (error && !dirty && stableKey(state) === stableKey(initial)) {
    return (
      <ErrorState
        title={t("loadError")}
        description={error}
        action={
          <Button
            onClick={() => {
              load().catch(() => undefined);
            }}
          >
            {t("retry")}
          </Button>
        }
      />
    );
  }

  const currentPreview = parsedTranslation ?? {};

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ gap: 2, justifyContent: "space-between" }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {t(`sections.${definition.labelKey}`)}
          </Typography>
          <Typography color="text.secondary">{t(`descriptions.${definition.labelKey}`)}</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            label={t(`policy.${definition.policy}`)}
            color={definition.policy === "direct" ? "success" : "primary"}
            variant="outlined"
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress color="inherit" size={18} /> : <SaveRounded />}
            disabled={!canEdit || saving || !dirty}
            onClick={() => {
              save().catch(() => undefined);
            }}
          >
            {saving ? t("saving") : definition.policy === "direct" ? t("save") : t("saveDraft")}
          </Button>
          {definition.policy !== "direct" ? (
            <Button
              variant="outlined"
              startIcon={publishing ? <CircularProgress size={18} /> : <PublishRounded />}
              disabled={!canEdit || publishing || dirty || !state.publishable}
              onClick={() => {
                publish().catch(() => undefined);
              }}
            >
              {publishing ? t("publishing") : t("publish")}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {!canEdit ? <Alert severity="warning">{t("readOnly")}</Alert> : null}
      {error ? (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" icon={<CloudDoneRounded />} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}

      {definition.key === "terms" ? (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6">{t("forms.policyMetadata")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("forms.policyMetadataHelp")}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                  xl: "2fr 1fr 1fr",
                },
                gap: 1.5,
              }}
            >
              <FormControl fullWidth>
                <InputLabel id="policy-document-type">{t("documentType")}</InputLabel>
                <Select
                  labelId="policy-document-type"
                  label={t("documentType")}
                  value={state.documentType}
                  onChange={(event) => apply({ documentType: event.target.value })}
                  disabled={!canEdit || Boolean(state.policyId)}
                >
                  {[
                    "terms-of-service",
                    "privacy-policy",
                    "marketing-consent",
                    "delivery-policy",
                    "refund-policy",
                  ].map((value) => (
                    <MenuItem key={value} value={value}>
                      {t(POLICY_TYPE_TRANSLATIONS[value as keyof typeof POLICY_TYPE_TRANSLATIONS])}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                type="number"
                label={t("version")}
                value={state.version}
                onChange={(event) => apply({ version: event.target.value })}
                disabled={!canEdit || Boolean(state.policyId)}
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
              />
              <TextField
                fullWidth
                type="date"
                label={t("effectiveAt")}
                value={state.effectiveAt}
                onChange={(event) => apply({ effectiveAt: event.target.value })}
                disabled={!canEdit || Boolean(state.policyId)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Stack>
        </Paper>
      ) : definition.key === "homepage" ? (
        parsedData ? (
          <HomepageSettingsEditor
            data={parsedData as unknown as HomepageSettingsData}
            locale={locale}
            canEdit={canEdit}
            canUploadMedia={canUploadMedia}
            onDataChange={setHomepageData}
          />
        ) : (
          <Alert
            severity="error"
            action={
              <Button
                onClick={() => {
                  load().catch(() => undefined);
                }}
              >
                {t("retry")}
              </Button>
            }
          >
            {t("homepageConfigError")}
          </Alert>
        )
      ) : parsedData ? (
        <SettingsDataForm
          section={definition.key}
          data={parsedData}
          labelsTranslation={
            readJson(state.translations[locale]) ?? readJson(state.translations.en) ?? {}
          }
          canEdit={canEdit}
          canUploadMedia={canUploadMedia}
          onChange={setStructuredData}
        />
      ) : (
        <Alert
          severity="error"
          action={
            <Button
              onClick={() => {
                load().catch(() => undefined);
              }}
            >
              {t("retry")}
            </Button>
          }
        >
          {t("structuredConfigError")}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Tabs
          value={locale}
          onChange={(_, value: Locale) => setLocale(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("translationTabs")}
        >
          {LOCALES.map((language) => (
            <Tab key={language} value={language} label={t(`language.${language}`)} />
          ))}
        </Tabs>
        {definition.key === "homepage" ? (
          parsedData ? (
            <Box sx={{ mt: 2 }}>
              <HomepageTranslationsEditor
                data={parsedData as unknown as HomepageSettingsData}
                locale={locale}
                value={parsedTranslation as unknown as HomepageSettingsTranslationValue | null}
                canEdit={canEdit}
                onChange={(value) => setTranslation(locale, value as unknown as JsonObject)}
                onClear={() =>
                  setState((current) => ({
                    ...current,
                    translations: { ...current.translations, [locale]: "" },
                  }))
                }
              />
            </Box>
          ) : (
            <Alert
              severity="error"
              action={
                <Button
                  onClick={() => {
                    load().catch(() => undefined);
                  }}
                >
                  {t("retry")}
                </Button>
              }
            >
              {t("homepageConfigError")}
            </Alert>
          )
        ) : parsedData || definition.key === "terms" ? (
          <Box sx={{ mt: 2 }}>
            <SettingsTranslationForm
              section={definition.key}
              data={parsedData ?? {}}
              locale={locale}
              value={parsedTranslation}
              englishValue={readJson(state.translations.en) ?? {}}
              disabled={!canEdit || (definition.key === "terms" && Boolean(state.policyId))}
              onChange={(value) => setStructuredTranslation(locale, value)}
              onClear={() =>
                setState((current) => ({
                  ...current,
                  translations: { ...current.translations, [locale]: "" },
                }))
              }
              onEnglishChange={(value) => setStructuredTranslation("en", value)}
            />
          </Box>
        ) : (
          <Alert severity="error">{t("structuredConfigError")}</Alert>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 }, bgcolor: "background.default" }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
            <PreviewRounded color="primary" />
            <Typography variant="h6">{t("preview")}</Typography>
          </Stack>
          <Typography variant="subtitle1">
            {String(
              definition.key === "homepage"
                ? (asObject(currentPreview.sectionTitles).featured ?? t("homepage.featuredDishes"))
                : (currentPreview.title ??
                    currentPreview.eyebrow ??
                    t(`sections.${definition.labelKey}`)),
            )}
          </Typography>
          <Typography color="text.secondary">
            {String(
              definition.key === "homepage"
                ? ((Array.isArray(currentPreview.heroSlides)
                    ? asObject(currentPreview.heroSlides[0]).description
                    : null) ?? t("homepage.homepagePreviewHelp"))
                : (currentPreview.summary ?? currentPreview.description ?? t("previewHelp")),
            )}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {definition.key === "homepage" && parsedData
              ? (
                  [
                    ["heroSlides", "heroSlides"],
                    ["linkedBanners", "linkedBanners"],
                    ["featuredDishIds", "featuredDishes"],
                    ["categoryBanners", "categoryShowcase"],
                    ["benefits", "benefits"],
                    ["testimonials", "testimonials"],
                    ["blogIds", "blogPosts"],
                  ] as const
                ).map(([field, label]) => (
                  <Chip
                    key={field}
                    label={`${t(`homepage.${label}`)}: ${Array.isArray(parsedData[field]) ? parsedData[field].length : 0}`}
                    size="small"
                  />
                ))
              : null}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
