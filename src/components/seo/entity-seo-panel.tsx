"use client";

import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SupportedLocale } from "@/constants";
import { csrfJsonHeaders } from "@/lib/csrf-client";

import {
  SEO_LOCALES,
  SeoFields,
  type SeoEditableField,
  type SeoEditorValues,
  type SeoLocaleModes,
  type SeoLocaleValues,
} from "./seo-fields";

type Translation = Readonly<{ locale: SupportedLocale; title: string; description: string }>;
type SnapshotTranslation = Readonly<{
  locale: SupportedLocale;
  title: string;
  description: string;
  keywords: readonly string[];
  openGraph: Readonly<{ title: string | null; description: string | null }>;
  twitter: Readonly<{ title: string | null; description: string | null }>;
}>;
type Snapshot = Readonly<{
  canonicalUrl: string | null;
  manualOverrides: Readonly<{
    root: readonly string[];
    translations: readonly Readonly<{ locale: string; fields: readonly string[] }>[];
  }>;
  translations: readonly SnapshotTranslation[];
}>;

const EMPTY_MODES: SeoLocaleModes = {
  title: "automatic",
  description: "automatic",
  keywords: "automatic",
  openGraphTitle: "automatic",
  openGraphDescription: "automatic",
  twitterTitle: "automatic",
  twitterDescription: "automatic",
};

function fallbackValues(source: readonly Translation[], canonicalUrl: string): SeoEditorValues {
  const english = source.find((item) => item.locale === "en");
  const locales = Object.fromEntries(
    SEO_LOCALES.map((locale) => {
      const item = source.find((entry) => entry.locale === locale) ?? english;
      const values: SeoLocaleValues = {
        title: item?.title ?? "",
        description: item?.description ?? item?.title ?? "",
        keywords: item?.title ?? "",
        openGraphTitle: item?.title ?? "",
        openGraphDescription: item?.description ?? item?.title ?? "",
        twitterTitle: item?.title ?? "",
        twitterDescription: item?.description ?? item?.title ?? "",
      };
      return [locale, values];
    }),
  ) as Record<SupportedLocale, SeoLocaleValues>;
  return {
    locales,
    modes: Object.fromEntries(SEO_LOCALES.map((locale) => [locale, { ...EMPTY_MODES }])) as Record<
      SupportedLocale,
      SeoLocaleModes
    >,
    canonicalUrl,
    canonicalMode: "automatic",
  };
}

function fromSnapshot(snapshot: Snapshot, fallback: SeoEditorValues): SeoEditorValues {
  const locales = structuredClone(fallback.locales);
  const modes = structuredClone(fallback.modes);
  for (const translation of snapshot.translations) {
    locales[translation.locale] = {
      title: translation.title,
      description: translation.description,
      keywords: translation.keywords.join(", "),
      openGraphTitle: translation.openGraph.title ?? translation.title,
      openGraphDescription: translation.openGraph.description ?? translation.description,
      twitterTitle: translation.twitter.title ?? translation.title,
      twitterDescription: translation.twitter.description ?? translation.description,
    };
    const manual = new Set(
      snapshot.manualOverrides.translations.find((item) => item.locale === translation.locale)
        ?.fields ?? [],
    );
    for (const field of Object.keys(modes[translation.locale]) as SeoEditableField[]) {
      modes[translation.locale][field] = manual.has(field) ? "manual" : "automatic";
    }
  }
  return {
    locales,
    modes,
    canonicalUrl: snapshot.canonicalUrl ?? fallback.canonicalUrl,
    canonicalMode: snapshot.manualOverrides.root.includes("canonicalUrl") ? "manual" : "automatic",
  };
}

function withAutomaticFallbacks(
  values: SeoEditorValues,
  fallback: SeoEditorValues,
): SeoEditorValues {
  const locales = structuredClone(values.locales);
  for (const locale of SEO_LOCALES) {
    for (const field of Object.keys(values.modes[locale]) as SeoEditableField[]) {
      if (values.modes[locale][field] === "automatic") {
        locales[locale][field] = fallback.locales[locale][field];
      }
    }
  }
  return {
    ...values,
    locales,
    canonicalUrl:
      values.canonicalMode === "automatic" ? fallback.canonicalUrl : values.canonicalUrl,
  };
}

export function EntitySeoPanel({
  canUpdate,
  entityId,
  entityKind,
  path,
  translations,
}: {
  canUpdate: boolean;
  entityId: string | null;
  entityKind: "category" | "dish" | "blog";
  path: string;
  translations: readonly Translation[];
}) {
  const t = useTranslations("dashboard.seoControls");
  const fallback = useMemo(
    () => fallbackValues(translations, `https://sarakitchen.pt${path}`),
    [path, translations],
  );
  const [values, setValues] = useState(fallback);
  const [loading, setLoading] = useState(Boolean(entityId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fallbackRef = useRef(fallback);
  const displayValues = useMemo(
    () => (entityId ? withAutomaticFallbacks(values, fallback) : fallback),
    [entityId, fallback, values],
  );

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);
  useEffect(() => {
    if (!entityId) return;
    const controller = new AbortController();
    fetch(`/api/seo/entities/${entityKind}/${entityId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("load_failed");
        return (await response.json()) as { data: Snapshot };
      })
      .then((body) => setValues(fromSnapshot(body.data, fallbackRef.current)))
      .catch(() => {
        if (!controller.signal.aborted) setMessage(t("loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entityId, entityKind, t]);

  const save = async () => {
    if (!entityId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/seo/entities/${entityKind}/${entityId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify({
          translations: SEO_LOCALES.map((locale) => ({
            locale,
            ...Object.fromEntries(
              (Object.keys(values.modes[locale]) as SeoEditableField[]).map((field) => [
                field,
                {
                  mode: values.modes[locale][field],
                  ...(values.modes[locale][field] === "manual"
                    ? {
                        value:
                          field === "keywords"
                            ? values.locales[locale][field]
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean)
                            : values.locales[locale][field],
                      }
                    : {}),
                },
              ]),
            ),
          })),
          canonicalUrl: {
            mode: values.canonicalMode,
            ...(values.canonicalMode === "manual" ? { value: values.canonicalUrl } : {}),
          },
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      const body = (await response.json()) as { data: Snapshot };
      setValues(fromSnapshot(body.data, fallback));
      setMessage(t("saved"));
    } catch {
      setMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!entityId) {
    const preview = fallback.locales.en;
    return (
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="h6">{t("title")}</Typography>
            <Chip size="small" icon={<AutoAwesomeRounded />} label={t("automaticStatus")} />
          </Stack>
          <Typography color="text.secondary">{t("createAutomaticNote")}</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t("socialPreview")}
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>
            {preview.title || t("previewTitleFallback")}
          </Typography>
          <Typography color="text.secondary">
            {preview.description || t("previewDescriptionFallback")}
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      {loading ? (
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>{t("loading")}</Typography>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <SeoFields disabled={!canUpdate || saving} values={displayValues} onChange={setValues} />
          {message ? (
            <Typography
              role="status"
              color={message === t("saved") ? "success.main" : "error.main"}
            >
              {message}
            </Typography>
          ) : null}
          {canUpdate ? (
            <Button
              variant="contained"
              disabled={saving}
              onClick={() => {
                save().catch(() => undefined);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              {saving ? t("saving") : t("saveSeo")}
            </Button>
          ) : null}
        </Stack>
      )}
    </Paper>
  );
}
