"use client";

import AddRounded from "@mui/icons-material/AddRounded";
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

import { MediaPicker } from "@/components/media";
import { ErrorState } from "@/components/ui";
import { csrfJsonHeaders } from "@/lib/csrf-client";

import {
  createInitialSettingsPayload,
  type SettingsPageDefinition,
  type SettingsPageSection,
} from "../settings-section-registry";

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
  definition,
}: {
  canEdit: boolean;
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
  const setData = useCallback((data: JsonObject) => apply({ dataText: pretty(data) }), [apply]);
  const setTranslation = useCallback(
    (target: Locale, value: JsonObject) =>
      setState((current) => ({
        ...current,
        translations: { ...current.translations, [target]: pretty(value) },
      })),
    [],
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

  function setPrimaryMedia(mediaId: string | null) {
    if (!parsedData) return;
    if (definition.key === "about") {
      setData({ ...parsedData, heroMediaId: mediaId });
      return;
    }
    if (definition.key !== "homepage") return;
    const slides = Array.isArray(parsedData.heroSlides) ? [...parsedData.heroSlides] : [];
    if (!mediaId) slides.splice(0, 1);
    else {
      slides[0] = {
        ...asObject(slides[0]),
        id: "primary-hero",
        imageMediaId: mediaId,
        mobileImageMediaId: null,
        href: "/menu",
        openInNewTab: false,
        enabled: true,
      };
    }
    setData({ ...parsedData, heroSlides: slides });
    for (const language of LOCALES) {
      const translation = readJson(state.translations[language]);
      if (!translation) continue;
      const localizedSlides = Array.isArray(translation.heroSlides)
        ? [...translation.heroSlides]
        : [];
      if (!mediaId) localizedSlides.splice(0, 1);
      else {
        localizedSlides[0] = {
          ...asObject(localizedSlides[0]),
          id: "primary-hero",
          title: String(asObject(localizedSlides[0]).title ?? "Sara Kitchen"),
          description: String(asObject(localizedSlides[0]).description ?? ""),
          ctaLabel: String(asObject(localizedSlides[0]).ctaLabel ?? "View menu"),
          imageAlt: String(asObject(localizedSlides[0]).imageAlt ?? "Sara Kitchen Persian food"),
        };
      }
      setTranslation(language, { ...translation, heroSlides: localizedSlides });
    }
  }

  function addFaq() {
    if (!parsedData) return;
    const id = `question-${Date.now().toString(36)}`;
    const entries = Array.isArray(parsedData.entries) ? [...parsedData.entries] : [];
    entries.push({ id, active: true, order: entries.length });
    setData({ ...parsedData, entries });
    for (const language of LOCALES) {
      const translation = readJson(state.translations[language]);
      if (!translation) continue;
      const localized = Array.isArray(translation.entries) ? [...translation.entries] : [];
      localized.push({ id, question: "New question", answer: "New answer" });
      setTranslation(language, { ...translation, entries: localized });
    }
  }

  function addSocialLink() {
    if (!parsedData) return;
    const id = `social-${Date.now().toString(36)}`;
    const links = Array.isArray(parsedData.links) ? [...parsedData.links] : [];
    links.push({
      id,
      platform: "instagram",
      destination: { type: "handle", handle: "sara_kitchenpt" },
      iconKey: "instagram",
      active: true,
      order: links.length,
    });
    setData({ ...parsedData, links });
    for (const language of LOCALES) {
      const translation = readJson(state.translations[language]);
      if (!translation) continue;
      const labels = Array.isArray(translation.labels) ? [...translation.labels] : [];
      labels.push({ id, label: "Sara Kitchen on Instagram" });
      setTranslation(language, { ...translation, labels });
    }
  }

  function setLocaleVisibility(target: Locale, visibility: string) {
    if (!parsedData) return;
    const locales = Array.isArray(parsedData.locales)
      ? parsedData.locales.map((entry) =>
          asObject(entry).locale === target ? { ...asObject(entry), visibility } : entry,
        )
      : [];
    const active = locales
      .filter((entry) => asObject(entry).visibility === "active")
      .map((entry) => asObject(entry).locale);
    const defaultLocale = active.includes(parsedData.defaultLocale)
      ? parsedData.defaultLocale
      : active[0];
    setData({ ...parsedData, locales, defaultLocale, fallbackOrder: active });
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

  const primaryMedia =
    definition.key === "about"
      ? typeof parsedData?.heroMediaId === "string"
        ? parsedData.heroMediaId
        : null
      : definition.key === "homepage" && Array.isArray(parsedData?.heroSlides)
        ? String(asObject(parsedData.heroSlides[0]).imageMediaId ?? "") || null
        : null;
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
          <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
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
                    {value}
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
          </Stack>
        </Paper>
      ) : (
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">{t("sectionData")}</Typography>
            {definition.supportsMedia ? (
              <MediaPicker
                label={t("primaryMedia")}
                allowedKinds={["image"]}
                value={primaryMedia}
                onChange={setPrimaryMedia}
                disabled={!canEdit}
              />
            ) : null}
            {definition.key === "contact" && parsedData ? (
              <Stack sx={{ gap: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
                  <TextField
                    label={t("email")}
                    value={String(parsedData.email ?? "")}
                    onChange={(event) => setData({ ...parsedData, email: event.target.value })}
                    disabled={!canEdit}
                    fullWidth
                  />
                  <TextField
                    label={t("latitude")}
                    value={String(asObject(parsedData.location).latitude ?? "")}
                    onChange={(event) =>
                      setData({
                        ...parsedData,
                        location: {
                          ...asObject(parsedData.location),
                          latitude: Number(event.target.value),
                        },
                      })
                    }
                    disabled={!canEdit}
                    fullWidth
                  />
                  <TextField
                    label={t("longitude")}
                    value={String(asObject(parsedData.location).longitude ?? "")}
                    onChange={(event) =>
                      setData({
                        ...parsedData,
                        location: {
                          ...asObject(parsedData.location),
                          longitude: Number(event.target.value),
                        },
                      })
                    }
                    disabled={!canEdit}
                    fullWidth
                  />
                </Stack>
                <Typography component="h3" variant="h6">
                  {t("deliveryBands")}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {t("deliveryBandsHelp")}
                </Typography>
                {Array.isArray(parsedData.deliveryBands)
                  ? parsedData.deliveryBands.map((entry, index) => {
                      const band = asObject(entry);
                      const updateBand = (field: "maxDistanceMeters" | "feeCents", value: number) =>
                        setData({
                          ...parsedData,
                          deliveryBands: (parsedData.deliveryBands as unknown[]).map(
                            (current, position) =>
                              position === index
                                ? { ...asObject(current), [field]: value }
                                : current,
                          ),
                        });
                      return (
                        <Stack key={index} direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
                          <TextField
                            disabled={!canEdit}
                            fullWidth
                            label={t("deliveryBandMeters", { number: index + 1 })}
                            onChange={(event) =>
                              updateBand("maxDistanceMeters", Number(event.target.value))
                            }
                            slotProps={{ htmlInput: { min: 1, step: 1 } }}
                            type="number"
                            value={String(band.maxDistanceMeters ?? "")}
                          />
                          <TextField
                            disabled={!canEdit}
                            fullWidth
                            label={t("deliveryBandCents", { number: index + 1 })}
                            onChange={(event) => updateBand("feeCents", Number(event.target.value))}
                            slotProps={{ htmlInput: { min: 0, step: 1 } }}
                            type="number"
                            value={String(band.feeCents ?? "")}
                          />
                          <Button
                            disabled={
                              !canEdit || (parsedData.deliveryBands as unknown[]).length <= 1
                            }
                            onClick={() =>
                              setData({
                                ...parsedData,
                                deliveryBands: (parsedData.deliveryBands as unknown[]).filter(
                                  (_item, position) => position !== index,
                                ),
                              })
                            }
                          >
                            {t("removeDeliveryBand")}
                          </Button>
                        </Stack>
                      );
                    })
                  : null}
                <Button
                  disabled={
                    !canEdit ||
                    (Array.isArray(parsedData.deliveryBands) &&
                      parsedData.deliveryBands.length >= 12)
                  }
                  onClick={() => {
                    const bands = Array.isArray(parsedData.deliveryBands)
                      ? parsedData.deliveryBands
                      : [];
                    const last = asObject(bands.at(-1));
                    setData({
                      ...parsedData,
                      deliveryBands: [
                        ...bands,
                        {
                          maxDistanceMeters: Number(last.maxDistanceMeters ?? 0) + 5_000,
                          feeCents: Number(last.feeCents ?? 0) + 200,
                        },
                      ],
                    });
                  }}
                  variant="outlined"
                >
                  {t("addDeliveryBand")}
                </Button>
              </Stack>
            ) : null}
            {definition.key === "languages" && parsedData && Array.isArray(parsedData.locales) ? (
              <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
                {parsedData.locales.map((entry) => {
                  const item = asObject(entry);
                  const language = item.locale as Locale;
                  return (
                    <FormControl key={language} fullWidth>
                      <InputLabel id={`visibility-${language}`}>
                        {t(`language.${language}`)}
                      </InputLabel>
                      <Select
                        labelId={`visibility-${language}`}
                        label={t(`language.${language}`)}
                        value={String(item.visibility)}
                        onChange={(event) => setLocaleVisibility(language, event.target.value)}
                        disabled={!canEdit}
                      >
                        {(["active", "maintenance", "hidden"] as const).map((value) => (
                          <MenuItem key={value} value={value}>
                            {t(`visibility.${value}`)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })}
              </Stack>
            ) : null}
            {definition.key === "faq" ? (
              <Button startIcon={<AddRounded />} onClick={addFaq} disabled={!canEdit}>
                {t("addFaq")}
              </Button>
            ) : null}
            {definition.key === "social" ? (
              <Button startIcon={<AddRounded />} onClick={addSocialLink} disabled={!canEdit}>
                {t("addSocial")}
              </Button>
            ) : null}
            <TextField
              label={t("structuredData")}
              value={state.dataText}
              onChange={(event) => apply({ dataText: event.target.value })}
              disabled={!canEdit}
              error={!parsedData}
              helperText={t("structuredDataHelp")}
              multiline
              minRows={10}
              fullWidth
              slotProps={{ htmlInput: { dir: "ltr", spellCheck: false } }}
            />
          </Stack>
        </Paper>
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
        <TextField
          sx={{ mt: 2 }}
          label={t("localizedContent")}
          value={state.translations[locale]}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              translations: { ...current.translations, [locale]: event.target.value },
            }))
          }
          disabled={!canEdit || (definition.key === "terms" && Boolean(state.policyId))}
          error={Boolean(state.translations[locale]) && !parsedTranslation}
          helperText={locale === "en" ? t("englishRequired") : t("optionalLocale")}
          multiline
          minRows={12}
          fullWidth
          slotProps={{ htmlInput: { dir: locale === "fa" ? "rtl" : "ltr", spellCheck: false } }}
        />
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 }, bgcolor: "background.default" }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
            <PreviewRounded color="primary" />
            <Typography variant="h6">{t("preview")}</Typography>
          </Stack>
          <Typography variant="subtitle1">
            {String(
              currentPreview.title ??
                currentPreview.eyebrow ??
                t(`sections.${definition.labelKey}`),
            )}
          </Typography>
          <Typography color="text.secondary">
            {String(currentPreview.summary ?? currentPreview.description ?? t("previewHelp"))}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            {Object.entries(currentPreview)
              .slice(0, 8)
              .map(([key, value]) => (
                <Chip
                  key={key}
                  label={`${key}: ${Array.isArray(value) ? value.length : typeof value === "object" ? "…" : String(value).slice(0, 40)}`}
                  size="small"
                />
              ))}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
