"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import EditCalendarRounded from "@mui/icons-material/EditCalendarRounded";
import PreviewRounded from "@mui/icons-material/PreviewRounded";
import PublishRounded from "@mui/icons-material/PublishRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import UnpublishedRounded from "@mui/icons-material/UnpublishedRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MediaPicker } from "@/components/media";
import { RemoteRelationSelector, type RemoteRelationOption } from "@/components/relations";
import { ErrorState, RichContent } from "@/components/ui";
import { useFeedback } from "@/hooks";
import type { RichTextDocument, RichTextNode, StoredRichText } from "@/lib/rich-text";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { useRouter } from "@/locales/navigation";
import {
  BLOG_FORM_MAX_READ_TIME_MINUTES,
  sharedBlogCreateSchema,
} from "@/validations/blog-mutation";

import { BlogRichEditor } from "./blog-rich-editor";

type Language = "en" | "pt-PT" | "fa";
type BlogStatus = "draft" | "scheduled" | "published" | "archived";
type LocalFields = Readonly<{
  title: string;
  excerpt: string;
  content: StoredRichText;
}>;
type FormValues = Readonly<{
  translations: Readonly<Record<Language, LocalFields>>;
  slugOverride: string;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  readTimeOverride: string;
  tags: string;
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  scheduleAt: string;
}>;
type BlogDetail = Readonly<{
  id: string;
  translations: readonly Readonly<{
    locale: Language;
    title: string;
    excerpt: string;
    content: StoredRichText;
  }>[];
  slug: string;
  imageMediaId: string | null;
  bannerMediaId: string | null;
  readTimeMinutes: number;
  authorSnapshot: Readonly<{ displayName: string }>;
  status: BlogStatus;
  publishAt: string | null;
  publishedAt: string | null;
  tags: readonly string[];
  relatedDishIds: readonly string[];
  relatedBlogIds: readonly string[];
  viewCount: number;
}>;
type Envelope<T> = Readonly<{ data?: T }>;
type PreviewToken = Readonly<{ token: string; expiresAt: string }>;

const LANGUAGES: readonly Language[] = ["en", "pt-PT", "fa"];
const EMPTY_CONTENT: StoredRichText = {
  schemaVersion: 1,
  document: { type: "doc", content: [] },
};
const EMPTY_LOCAL: LocalFields = { title: "", excerpt: "", content: EMPTY_CONTENT };
const EMPTY: FormValues = {
  translations: { en: EMPTY_LOCAL, "pt-PT": EMPTY_LOCAL, fa: EMPTY_LOCAL },
  slugOverride: "",
  imageMediaId: null,
  bannerMediaId: null,
  readTimeOverride: "",
  tags: "",
  relatedDishIds: [],
  relatedBlogIds: [],
  scheduleAt: "",
};

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

function dateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function textFromNode(node: RichTextNode): string {
  if (node.type === "text") return node.text;
  if ("content" in node && node.content) return node.content.map(textFromNode).join(" ");
  return "";
}

function contentText(document: RichTextDocument): string {
  return (document.content ?? []).map(textFromNode).join(" ").trim();
}

function estimatedReadTime(value: LocalFields): number {
  const words = `${value.title} ${value.excerpt} ${contentText(value.content.document)}`.match(
    /[\p{L}\p{N}]+/gu,
  )?.length;
  return Math.max(1, Math.ceil((words ?? 0) / 220));
}

function hasTranslation(value: LocalFields): boolean {
  return Boolean(value.title.trim() || value.excerpt.trim() || contentText(value.content.document));
}

function completeTranslation(value: LocalFields): boolean {
  return Boolean(value.title.trim() && value.excerpt.trim());
}

function fromDetail(item: BlogDetail): FormValues {
  const translations = { ...EMPTY.translations };
  for (const entry of item.translations) {
    translations[entry.locale] = {
      title: entry.title,
      excerpt: entry.excerpt,
      content: entry.content,
    };
  }
  return {
    translations,
    slugOverride: "",
    imageMediaId: item.imageMediaId,
    bannerMediaId: item.bannerMediaId,
    readTimeOverride: String(item.readTimeMinutes),
    tags: item.tags.join(", "),
    relatedDishIds: item.relatedDishIds,
    relatedBlogIds: item.relatedBlogIds,
    scheduleAt: dateTimeLocal(item.publishAt),
  };
}

function mapDishRelation(value: unknown): RemoteRelationOption | null {
  if (!value || typeof value !== "object") return null;
  const source = value as {
    id?: unknown;
    slug?: unknown;
    status?: RemoteRelationOption["status"];
    availability?: Readonly<{ mode?: RemoteRelationOption["availability"] }>;
    translations?: readonly Readonly<{ locale?: unknown; name?: unknown }>[];
  };
  if (typeof source.id !== "string" || !Array.isArray(source.translations)) return null;
  const title = source.translations.find(
    (translation) => translation.locale === "en" && typeof translation.name === "string",
  )?.name;
  return {
    id: source.id,
    label: typeof title === "string" ? title : String(source.slug ?? source.id),
    ...(typeof source.slug === "string" ? { secondary: source.slug } : {}),
    ...(source.status ? { status: source.status } : {}),
    ...(source.availability?.mode ? { availability: source.availability.mode } : {}),
  };
}

function mapBlogRelation(value: unknown): RemoteRelationOption | null {
  if (!value || typeof value !== "object") return null;
  const source = value as {
    id?: unknown;
    slug?: unknown;
    status?: RemoteRelationOption["status"];
    translations?: readonly Readonly<{ locale?: unknown; title?: unknown }>[];
  };
  if (typeof source.id !== "string" || !Array.isArray(source.translations)) return null;
  const title = source.translations.find(
    (translation) => translation.locale === "en" && typeof translation.title === "string",
  )?.title;
  return {
    id: source.id,
    label: typeof title === "string" ? title : String(source.slug ?? source.id),
    ...(typeof source.slug === "string" ? { secondary: source.slug } : {}),
    ...(source.status ? { status: source.status } : {}),
  };
}

export type BlogEditorProps = Readonly<{
  canCreate: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  canUploadMedia: boolean;
}>;

export function BlogEditor({ canCreate, canPublish, canUpdate, canUploadMedia }: BlogEditorProps) {
  const t = useTranslations("dashboard.blogEditor");
  const locale = useLocale() as Language;
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const queryId = searchParams.get("id");
  const validId = queryId === null || /^[a-f\d]{24}$/iu.test(queryId);
  const [itemId, setItemId] = useState<string | null>(queryId);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initial, setInitial] = useState<FormValues>(EMPTY);
  const [detail, setDetail] = useState<BlogDetail | null>(null);
  const [originalSlug, setOriginalSlug] = useState("");
  const [status, setStatus] = useState<BlogStatus>("draft");
  const [tab, setTab] = useState<Language>("en");
  const [loading, setLoading] = useState(queryId !== null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [preview, setPreview] = useState<BlogDetail | null>(null);
  const editable = itemId ? canUpdate : canCreate;
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [initial, values],
  );
  const autoReadTime = estimatedReadTime(values.translations.en);
  const readTime = values.readTimeOverride ? Number(values.readTimeOverride) : autoReadTime;
  const slug = values.slugOverride.trim()
    ? previewSlug(values.slugOverride)
    : itemId
      ? originalSlug
      : previewSlug(values.translations.en.title);

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
    if (!queryId || !validId) return;
    const controller = new AbortController();
    fetch(`/api/blogs/manage/${queryId}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("blog_load_failed");
        return (await response.json()) as Envelope<BlogDetail>;
      })
      .then((body) => {
        if (!body.data) throw new Error("blog_missing");
        const next = fromDetail(body.data);
        setValues(next);
        setInitial(next);
        setDetail(body.data);
        setOriginalSlug(body.data.slug);
        setStatus(body.data.status);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryId, validId]);

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
        anchor.target === "_blank" ||
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
    if (!dirty || window.confirm(t("leaveWarning"))) router.push("/dashboard/blog");
  };

  const tags = () =>
    values.tags
      .split(",")
      .map((value) => previewSlug(value.trim()))
      .filter(Boolean);

  const buildPayload = () => ({
    translations: LANGUAGES.flatMap((language) => {
      const entry = values.translations[language];
      return hasTranslation(entry)
        ? [
            {
              locale: language,
              title: entry.title.trim(),
              excerpt: entry.excerpt.trim(),
              content: entry.content,
            },
          ]
        : [];
    }),
    ...(values.slugOverride.trim() ? { slugOverride: values.slugOverride.trim() } : {}),
    imageMediaId: values.imageMediaId,
    bannerMediaId: values.bannerMediaId,
    readTimeMinutes: readTime,
    tags: tags(),
    relatedDishIds: values.relatedDishIds,
    relatedBlogIds: values.relatedBlogIds,
  });

  const persist = async (silent = false): Promise<BlogDetail | null> => {
    setAttempted(true);
    setServerError("");
    if (!editable && dirty) {
      setServerError(t("readOnlyError"));
      return null;
    }
    if (!dirty && detail) return detail;
    const payload = buildPayload();
    const parsed = sharedBlogCreateSchema.safeParse(payload);
    const invalidSlug =
      Boolean(values.slugOverride) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride);
    if (!parsed.success || invalidSlug || !slug) {
      setServerError(t("validationError"));
      return null;
    }
    setSaving(true);
    try {
      const response = await fetch(itemId ? `/api/blogs/manage/${itemId}` : "/api/blogs", {
        method: itemId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setServerError(response.status === 409 ? t("conflict") : t("saveError"));
        return null;
      }
      const body = (await response.json()) as Envelope<BlogDetail>;
      if (!body.data) throw new Error("missing_blog");
      const persistedValues = fromDetail(body.data);
      const nextValues = values.readTimeOverride
        ? persistedValues
        : { ...persistedValues, readTimeOverride: "" };
      setItemId(body.data.id);
      setDetail(body.data);
      setOriginalSlug(body.data.slug);
      setStatus(body.data.status);
      setValues(nextValues);
      setInitial(nextValues);
      if (!itemId) router.replace(`/dashboard/blog/modify?id=${body.data.id}`, { scroll: false });
      if (!silent) feedback.notify({ message: t("saveSuccess"), severity: "success" });
      return body.data;
    } catch {
      setServerError(t("saveError"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const lifecycle = async (action: "publish" | "schedule" | "unpublish") => {
    setServerError("");
    if (!canPublish) return;
    if (
      action !== "unpublish" &&
      LANGUAGES.some((language) => !completeTranslation(values.translations[language]))
    ) {
      setAttempted(true);
      setServerError(t("publishRequirements"));
      return;
    }
    const saved = dirty || !detail ? await persist(true) : detail;
    if (!saved) return;
    if (action === "schedule") {
      const schedule = new Date(values.scheduleAt);
      if (
        !values.scheduleAt ||
        Number.isNaN(schedule.getTime()) ||
        schedule.getTime() <= Date.now()
      ) {
        setServerError(t("scheduleError"));
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/blogs/manage/${saved.id}/${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body:
          action === "schedule"
            ? JSON.stringify({ publishAt: new Date(values.scheduleAt).toISOString() })
            : "{}",
      });
      if (!response.ok) {
        setServerError(t("lifecycleError"));
        return;
      }
      const body = (await response.json()) as Envelope<BlogDetail>;
      if (!body.data) throw new Error("missing_blog");
      const persistedValues = fromDetail(body.data);
      const nextValues = values.readTimeOverride
        ? persistedValues
        : { ...persistedValues, readTimeOverride: "" };
      setDetail(body.data);
      setStatus(body.data.status);
      setValues(nextValues);
      setInitial(nextValues);
      feedback.notify({ message: t(`lifecycleSuccess.${action}`), severity: "success" });
      router.refresh();
    } catch {
      setServerError(t("lifecycleError"));
    } finally {
      setSaving(false);
    }
  };

  const showPreview = async () => {
    const saved = dirty || !detail ? await persist(true) : detail;
    if (!saved) return;
    setSaving(true);
    setServerError("");
    try {
      const tokenResponse = await fetch(`/api/blogs/manage/${saved.id}/preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: "{}",
      });
      if (!tokenResponse.ok) throw new Error("preview_token_failed");
      const tokenBody = (await tokenResponse.json()) as Envelope<PreviewToken>;
      if (!tokenBody.data) throw new Error("preview_token_missing");
      const response = await fetch(
        `/api/blogs/${encodeURIComponent(saved.slug)}/preview?token=${encodeURIComponent(tokenBody.data.token)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("preview_failed");
      const body = (await response.json()) as Envelope<BlogDetail>;
      if (!body.data) throw new Error("preview_missing");
      setPreview(body.data);
    } catch {
      setServerError(t("previewError"));
    } finally {
      setSaving(false);
    }
  };

  if (!validId)
    return (
      <ErrorState
        title={t("invalidId")}
        description={t("invalidIdHelp")}
        action={<Button onClick={() => router.push("/dashboard/blog")}>{t("back")}</Button>}
      />
    );
  if (!itemId && !canCreate)
    return (
      <ErrorState
        title={t("denied")}
        description={t("deniedHelp")}
        action={<Button onClick={() => router.push("/dashboard/blog")}>{t("back")}</Button>}
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
  const fieldError = attempted && hasTranslation(current) && !completeTranslation(current);
  const previewTranslation = preview
    ? (preview.translations.find((entry) => entry.locale === locale) ??
      preview.translations.find((entry) => entry.locale === "en") ??
      preview.translations[0])
    : null;
  const relationLabels = {
    add: t("relationBrowse"),
    close: t("relationClose"),
    empty: t("relationEmpty"),
    error: t("relationError"),
    loading: t("relationLoading"),
    remove: t("relationRemove"),
    retry: t("relationRetry"),
    search: t("relationSearch"),
    self: t("relationSelf"),
    statuses: {
      draft: t("statuses.draft"),
      scheduled: t("statuses.scheduled"),
      published: t("statuses.published"),
      archived: t("statuses.archived"),
    },
    availability: {
      available: t("availability.available"),
      unavailable: t("availability.unavailable"),
      scheduled: t("availability.scheduled"),
    },
  } as const;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Button startIcon={<ArrowBackRounded />} onClick={leave}>
            {t("back")}
          </Button>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Typography component="h1" variant="h4">
              {itemId ? t("editTitle") : t("createTitle")}
            </Typography>
            <Chip
              size="small"
              color={
                status === "published" ? "success" : status === "scheduled" ? "info" : "default"
              }
              label={t(`statuses.${status}`)}
            />
          </Stack>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<PreviewRounded />}
            disabled={saving || (!itemId && !canCreate) || (dirty && !editable)}
            onClick={() => void showPreview().catch(() => undefined)}
          >
            {t("preview")}
          </Button>
          {editable ? (
            <Button
              variant="outlined"
              startIcon={<SaveRounded />}
              disabled={saving || status === "archived"}
              onClick={() => void persist().catch(() => undefined)}
            >
              {saving ? t("saving") : t("saveDraft")}
            </Button>
          ) : null}
          {canPublish && status !== "published" && status !== "archived" ? (
            <Button
              variant="contained"
              startIcon={<PublishRounded />}
              disabled={saving}
              onClick={() => void lifecycle("publish").catch(() => undefined)}
            >
              {t("publishNow")}
            </Button>
          ) : null}
          {canPublish && (status === "published" || status === "scheduled") ? (
            <Button
              color="warning"
              variant="outlined"
              startIcon={<UnpublishedRounded />}
              disabled={saving}
              onClick={() => void lifecycle("unpublish").catch(() => undefined)}
            >
              {status === "scheduled" ? t("cancelSchedule") : t("unpublish")}
            </Button>
          ) : null}
        </Stack>
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
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t("content")}
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, value: Language) => setTab(value)}
          aria-label={t("languages")}
          variant="scrollable"
          scrollButtons="auto"
        >
          {LANGUAGES.map((language) => (
            <Tab
              key={language}
              value={language}
              label={`${t(`language.${language}`)}${completeTranslation(values.translations[language]) ? " ✓" : ""}`}
            />
          ))}
        </Tabs>
        <Stack spacing={2} sx={{ mt: 3 }}>
          <TextField
            label={t("articleTitle")}
            value={current.title}
            required={tab === "en"}
            disabled={!editable || status === "archived"}
            error={fieldError}
            onChange={(event) => updateTranslation(tab, { title: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 180 } }}
          />
          <TextField
            label={t("excerpt")}
            value={current.excerpt}
            required={tab === "en"}
            disabled={!editable || status === "archived"}
            error={fieldError}
            multiline
            minRows={3}
            onChange={(event) => updateTranslation(tab, { excerpt: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={`${current.excerpt.length}/500`}
          />
          <Box
            sx={
              !editable || status === "archived"
                ? { pointerEvents: "none", opacity: 0.7 }
                : undefined
            }
          >
            <Typography
              component="label"
              id={`blog-content-${tab}`}
              sx={{ display: "block", mb: 1, fontWeight: 700 }}
            >
              {t("richContent")}
            </Typography>
            <BlogRichEditor
              value={current.content}
              onChange={(content) => updateTranslation(tab, { content })}
              labelledBy={`blog-content-${tab}`}
              labels={{
                bold: t("bold"),
                italic: t("italic"),
                heading: t("heading"),
                blockquote: t("blockquote"),
                bulletList: t("bulletList"),
                numberedList: t("numberedList"),
              }}
            />
          </Box>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Stack spacing={3} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("metadata")}
            </Typography>
            <Stack spacing={2}>
              <TextField
                label={t("slugOverride")}
                value={values.slugOverride}
                disabled={!editable || status === "archived"}
                onChange={(event) => update({ slugOverride: event.target.value })}
                error={
                  attempted &&
                  Boolean(values.slugOverride) &&
                  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride)
                }
                helperText={`${t("slugPreview")}: /blog/${slug || "…"}`}
                slotProps={{ htmlInput: { dir: "ltr" } }}
              />
              <TextField
                label={t("tags")}
                value={values.tags}
                disabled={!editable || status === "archived"}
                onChange={(event) => update({ tags: event.target.value })}
                helperText={t("tagsHelp")}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t("readTime")}
                  value={values.readTimeOverride}
                  disabled={!editable || status === "archived"}
                  onChange={(event) => update({ readTimeOverride: event.target.value })}
                  helperText={
                    values.readTimeOverride
                      ? t("readTimeManual", { count: readTime })
                      : t("readTimeAutomatic", { count: autoReadTime })
                  }
                  slotProps={{
                    htmlInput: { min: 1, max: BLOG_FORM_MAX_READ_TIME_MINUTES, step: 1 },
                  }}
                />
                {values.readTimeOverride ? (
                  <Button onClick={() => update({ readTimeOverride: "" })}>
                    {t("useAutomatic")}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("relations")}
            </Typography>
            {editable && status !== "archived" ? (
              <Stack spacing={3}>
                <RemoteRelationSelector
                  endpoint="/api/dishes/manage"
                  labels={{
                    ...relationLabels,
                    selectedCount: t("relationSelectedCount", {
                      count: values.relatedDishIds.length,
                    }),
                  }}
                  mapOption={mapDishRelation}
                  title={t("relatedDishes")}
                  value={values.relatedDishIds}
                  onChange={(relatedDishIds) => update({ relatedDishIds })}
                />
                <RemoteRelationSelector
                  endpoint="/api/blogs/manage"
                  excludedIds={itemId ? [itemId] : []}
                  labels={{
                    ...relationLabels,
                    selectedCount: t("relationSelectedCount", {
                      count: values.relatedBlogIds.length,
                    }),
                  }}
                  mapOption={mapBlogRelation}
                  sortBy="title"
                  title={t("relatedBlogs")}
                  value={values.relatedBlogIds}
                  onChange={(relatedBlogIds) => update({ relatedBlogIds })}
                />
              </Stack>
            ) : (
              <Typography color="text.secondary">
                {t("relationsReadOnly", {
                  dishes: values.relatedDishIds.length,
                  blogs: values.relatedBlogIds.length,
                })}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("seoPreview")}
            </Typography>
            <Box sx={{ maxWidth: 680 }}>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                https://sarakitchen.pt/blog/{slug || "article"}
              </Typography>
              <Typography variant="h6" color="primary.main" sx={{ mt: 0.5 }}>
                {current.title || values.translations.en.title || t("seoTitleFallback")}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {(
                  current.excerpt ||
                  values.translations.en.excerpt ||
                  t("seoDescriptionFallback")
                ).slice(0, 160)}
              </Typography>
            </Box>
          </Paper>
        </Stack>

        <Stack spacing={3} sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("media")}
            </Typography>
            <Stack spacing={3}>
              <MediaPicker
                allowedKinds={["image"]}
                canUpload={canUploadMedia}
                disabled={!editable || status === "archived"}
                label={t("cardImage")}
                value={values.imageMediaId}
                onChange={(imageMediaId) => update({ imageMediaId })}
              />
              <MediaPicker
                allowedKinds={["image"]}
                canUpload={canUploadMedia}
                disabled={!editable || status === "archived"}
                label={t("bannerImage")}
                value={values.bannerMediaId}
                onChange={(bannerMediaId) => update({ bannerMediaId })}
              />
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("publishing")}
            </Typography>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                <Typography color="text.secondary">{t("currentStatus")}</Typography>
                <Chip size="small" label={t(`statuses.${status}`)} />
              </Stack>
              {detail?.publishedAt ? (
                <Typography variant="body2" color="text.secondary">
                  {t("firstPublished", {
                    value: new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(detail.publishedAt)),
                  })}
                </Typography>
              ) : null}
              {canPublish && status !== "published" && status !== "archived" ? (
                <>
                  <TextField
                    type="datetime-local"
                    label={t("scheduleAt")}
                    value={values.scheduleAt}
                    onChange={(event) => update({ scheduleAt: event.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<EditCalendarRounded />}
                    disabled={saving || !values.scheduleAt}
                    onClick={() => void lifecycle("schedule").catch(() => undefined)}
                  >
                    {status === "scheduled" ? t("reschedule") : t("schedule")}
                  </Button>
                </>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                {t("publishHelp")}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} fullWidth maxWidth="md">
        <DialogTitle>{previewTranslation?.title ?? t("preview")}</DialogTitle>
        <DialogContent>
          {preview && previewTranslation ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Chip size="small" label={t(`statuses.${preview.status}`)} />
                <Typography variant="body2" color="text.secondary">
                  {t("previewMeta", {
                    author: preview.authorSnapshot.displayName,
                    minutes: preview.readTimeMinutes,
                  })}
                </Typography>
              </Stack>
              <Typography variant="h4">{previewTranslation.title}</Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {previewTranslation.excerpt}
              </Typography>
              <Divider />
              <RichContent content={previewTranslation.content} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
