"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
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
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/ui";
import { MediaPicker } from "@/components/media";
import { EntitySeoPanel } from "@/components/seo";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { useRouter } from "@/locales/navigation";

import { CategoryRichEditor } from "./category-rich-editor";

type Language = "en" | "pt-PT" | "fa";
type LocalFields = Readonly<{ name: string; description: string }>;
type FormValues = Readonly<{
  translations: Readonly<Record<Language, LocalFields>>;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  slugOverride: string;
  status: "draft" | "published";
  sortOrder: string;
}>;
type CategoryDetail = Readonly<{
  id: string;
  translations: readonly Readonly<LocalFields & { locale: Language }>[];
  imageMediaId: string | null;
  bannerMediaId: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  sortOrder: number;
}>;
type Envelope = Readonly<{ data?: CategoryDetail; error?: Readonly<{ message?: string }> }>;

const LANGUAGES: readonly Language[] = ["en", "pt-PT", "fa"];
const EMPTY: FormValues = {
  translations: {
    en: { name: "", description: "" },
    "pt-PT": { name: "", description: "" },
    fa: { name: "", description: "" },
  },
  imageMediaId: null,
  bannerMediaId: null,
  slugOverride: "",
  status: "draft",
  sortOrder: "0",
};

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .trim();
}

function previewSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\p{Mark}+/gu, "")
    .replace(/['’ʻ`]+/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96)
    .replace(/-+$/gu, "");
}

function fromDetail(item: CategoryDetail): FormValues {
  const translations = { ...EMPTY.translations };
  for (const entry of item.translations)
    translations[entry.locale] = { name: entry.name, description: entry.description };
  return {
    translations,
    imageMediaId: item.imageMediaId,
    bannerMediaId: item.bannerMediaId,
    slugOverride: "",
    status: item.status === "archived" ? "draft" : item.status,
    sortOrder: String(item.sortOrder),
  };
}

export function CategoryEditor({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const t = useTranslations("dashboard.categoryEditor");
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const validId = id === null || /^[a-f\d]{24}$/iu.test(id);
  const editing = id !== null;
  const permitted = editing ? canUpdate : canCreate;
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initial, setInitial] = useState<FormValues>(EMPTY);
  const [originalSlug, setOriginalSlug] = useState("");
  const [tab, setTab] = useState<Language>("en");
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );
  const slug = values.slugOverride.trim()
    ? previewSlug(values.slugOverride)
    : editing
      ? originalSlug
      : previewSlug(values.translations.en.name);
  const seoTranslations = useMemo(
    () =>
      LANGUAGES.filter((language) => values.translations[language].name.trim()).map((language) => ({
        locale: language,
        title: values.translations[language].name,
        description: plainText(values.translations[language].description),
      })),
    [values.translations],
  );
  const update = useCallback(
    (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch })),
    [],
  );
  const updateTranslation = useCallback(
    (language: Language, patch: Partial<LocalFields>) =>
      setValues((current) => ({
        ...current,
        translations: {
          ...current.translations,
          [language]: { ...current.translations[language], ...patch },
        },
      })),
    [],
  );

  useEffect(() => {
    if (!id || !validId) return;
    const controller = new AbortController();
    fetch(`/api/categories/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (!body.data) throw new Error("missing_category");
        const next = fromDetail(body.data);
        setValues(next);
        setInitial(next);
        setOriginalSlug(body.data.slug);
        setLoadError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, validId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.getAttribute("target") === "_blank" ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      )
        return;
      if (!window.confirm(t("leaveWarning"))) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, t]);

  const leave = () => {
    if (!dirty || window.confirm(t("leaveWarning"))) void router.push("/dashboard/categories");
  };
  const save = async () => {
    setAttempted(true);
    setServerError("");
    const english = values.translations.en;
    const invalidEnglish =
      english.name.trim().length < 2 || plainText(english.description).length < 1;
    const invalidOptional = LANGUAGES.some((language) => {
      const entry = values.translations[language];
      return (
        Boolean(entry.name || plainText(entry.description)) &&
        (entry.name.trim().length < 2 || !plainText(entry.description))
      );
    });
    const order = Number(values.sortOrder);
    if (
      invalidEnglish ||
      invalidOptional ||
      !slug ||
      !Number.isSafeInteger(order) ||
      order < 0 ||
      (values.slugOverride && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride))
    )
      return;
    const translations = LANGUAGES.filter(
      (language) =>
        values.translations[language].name.trim() ||
        plainText(values.translations[language].description),
    ).map((language) => ({
      locale: language,
      name: values.translations[language].name.trim(),
      description: values.translations[language].description.trim(),
    }));
    const payload = {
      translations,
      imageMediaId: values.imageMediaId,
      bannerMediaId: values.bannerMediaId,
      ...(values.slugOverride.trim() ? { slugOverride: values.slugOverride.trim() } : {}),
      status: values.status,
      sortOrder: order,
    };
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/categories/${id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setServerError(
          response.status === 503
            ? t("saveUnavailable")
            : response.status === 409
              ? t("conflict")
              : t("saveError"),
        );
        return;
      }
      setInitial(values);
      router.push("/dashboard/categories");
      router.refresh();
    } catch {
      setServerError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!validId)
    return (
      <ErrorState
        title={t("invalidId")}
        description={t("invalidIdHelp")}
        action={<Button onClick={() => router.push("/dashboard/categories")}>{t("back")}</Button>}
      />
    );
  if (!permitted)
    return (
      <ErrorState
        title={t("denied")}
        description={t("deniedHelp")}
        action={<Button onClick={() => router.push("/dashboard/categories")}>{t("back")}</Button>}
      />
    );
  if (loading)
    return (
      <Stack sx={{ alignItems: "center", p: 8 }}>
        <CircularProgress aria-label={t("loading")} />
      </Stack>
    );
  if (loadError)
    return (
      <ErrorState
        title={t("loadError")}
        description={t("loadErrorHelp")}
        action={<Button onClick={() => window.location.reload()}>{t("retry")}</Button>}
      />
    );

  const current = values.translations[tab];
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Button startIcon={<ArrowBackRounded />} onClick={leave}>
            {t("back")}
          </Button>
          <Typography component="h1" variant="h4">
            {editing ? t("editTitle") : t("createTitle")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />}
          disabled={saving}
          onClick={() => {
            void save().catch(() => undefined);
          }}
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </Stack>
      {serverError ? (
        <Paper
          role="alert"
          sx={{ p: 2, color: "error.main", border: "1px solid", borderColor: "error.main" }}
        >
          {serverError}
        </Paper>
      ) : null}
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Tabs
            value={tab}
            onChange={(_, value: Language) => setTab(value)}
            aria-label={t("languages")}
            variant="scrollable"
            scrollButtons="auto"
          >
            {LANGUAGES.map((language) => (
              <Tab key={language} value={language} label={t(`language.${language}`)} />
            ))}
          </Tabs>
          <TextField
            label={t("name")}
            value={current.name}
            onChange={(event) => updateTranslation(tab, { name: event.target.value })}
            required={tab === "en"}
            error={
              attempted && (tab === "en" || current.name !== "") && current.name.trim().length < 2
            }
            helperText={tab === "en" ? t("englishRequired") : t("optionalTogether")}
            fullWidth
          />
          <Box>
            <Typography
              component="label"
              id="category-description-label"
              sx={{ display: "block", mb: 1, fontWeight: 600 }}
            >
              {t("richDescription")}
            </Typography>
            <CategoryRichEditor
              value={current.description}
              onChange={(description) => updateTranslation(tab, { description })}
              labelledBy="category-description-label"
            />
            <FormHelperText
              error={
                attempted &&
                (tab === "en" || current.name !== "") &&
                !plainText(current.description)
              }
            >
              {t("descriptionHelp")}
            </FormHelperText>
          </Box>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Typography variant="h6">{t("media")}</Typography>
          <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <MediaPicker
                label={t("image")}
                allowedKinds={["image"]}
                value={values.imageMediaId}
                onChange={(imageMediaId) => update({ imageMediaId })}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <MediaPicker
                label={t("banner")}
                allowedKinds={["image"]}
                value={values.bannerMediaId}
                onChange={(bannerMediaId) => update({ bannerMediaId })}
              />
            </Box>
          </Stack>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Typography variant="h6">{t("publishing")}</Typography>
          <TextField
            label={t("slugOverride")}
            value={values.slugOverride}
            onChange={(event) => update({ slugOverride: event.target.value })}
            error={
              attempted &&
              Boolean(values.slugOverride) &&
              !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride)
            }
            helperText={t("slugHelp")}
            fullWidth
            slotProps={{ htmlInput: { dir: "ltr" } }}
          />
          <Typography variant="body2" color="text.secondary">
            {t("slugPreview")}: /menu/{slug || "…"}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 2 }}>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="category-edit-status">{t("status")}</InputLabel>
              <Select
                labelId="category-edit-status"
                label={t("status")}
                value={values.status}
                onChange={(event) => update({ status: event.target.value as FormValues["status"] })}
              >
                <MenuItem value="draft">{t("draft")}</MenuItem>
                <MenuItem value="published">{t("published")}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="number"
              label={t("sortOrder")}
              value={values.sortOrder}
              onChange={(event) => update({ sortOrder: event.target.value })}
              error={
                attempted &&
                (!Number.isSafeInteger(Number(values.sortOrder)) || Number(values.sortOrder) < 0)
              }
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
            />
          </Stack>
        </Stack>
      </Paper>
      <Typography variant="body2" color="text.secondary">
        {t("availabilityNote")}
      </Typography>
      <EntitySeoPanel
        canUpdate={canUpdate}
        entityId={validId ? id : null}
        entityKind="category"
        path={`/menu/category/${slug || "category"}`}
        translations={seoTranslations}
      />
    </Stack>
  );
}
