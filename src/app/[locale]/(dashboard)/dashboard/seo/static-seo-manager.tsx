"use client";

import SaveRounded from "@mui/icons-material/SaveRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MediaPicker } from "@/components/media";
import {
  SEO_LOCALES,
  SeoFields,
  type SeoEditorValues,
  type SeoLocaleModes,
  type SeoLocaleValues,
} from "@/components/seo";
import type { SupportedLocale } from "@/constants";
import { csrfJsonHeaders } from "@/lib/csrf-client";

const PAGE_KEYS = ["home", "menu", "about", "contact", "blog", "faq", "terms"] as const;
type PageKey = (typeof PAGE_KEYS)[number];
type Translation = Readonly<{
  locale: SupportedLocale;
  title: string;
  description: string;
  keywords: readonly string[];
  openGraph: Readonly<{ title: string | null; description: string | null }>;
  twitter: Readonly<{ title: string | null; description: string | null }>;
}>;
type Snapshot = Readonly<{
  key: PageKey;
  path: string;
  translations: readonly Translation[];
  canonicalUrl: string | null;
  robots: Readonly<{ index: boolean; follow: boolean }>;
  shareImageMediaId: string | null;
  active: boolean;
}>;
type Form = Readonly<{
  seo: SeoEditorValues;
  shareImageMediaId: string | null;
  index: boolean;
  follow: boolean;
  active: boolean;
}>;

const MANUAL_MODES: SeoLocaleModes = {
  title: "manual",
  description: "manual",
  keywords: "manual",
  openGraphTitle: "manual",
  openGraphDescription: "manual",
  twitterTitle: "manual",
  twitterDescription: "manual",
};
const EMPTY_LOCALE: SeoLocaleValues = {
  title: "",
  description: "",
  keywords: "",
  openGraphTitle: "",
  openGraphDescription: "",
  twitterTitle: "",
  twitterDescription: "",
};

function emptyForm(): Form {
  return {
    seo: {
      locales: Object.fromEntries(
        SEO_LOCALES.map((locale) => [locale, { ...EMPTY_LOCALE }]),
      ) as Record<SupportedLocale, SeoLocaleValues>,
      modes: Object.fromEntries(
        SEO_LOCALES.map((locale) => [locale, { ...MANUAL_MODES }]),
      ) as Record<SupportedLocale, SeoLocaleModes>,
      canonicalUrl: "",
      canonicalMode: "manual",
    },
    shareImageMediaId: null,
    index: true,
    follow: true,
    active: true,
  };
}

function fromSnapshot(snapshot: Snapshot): Form {
  const form = emptyForm();
  const locales = structuredClone(form.seo.locales);
  for (const item of snapshot.translations) {
    locales[item.locale] = {
      title: item.title,
      description: item.description,
      keywords: item.keywords.join(", "),
      openGraphTitle: item.openGraph.title ?? "",
      openGraphDescription: item.openGraph.description ?? "",
      twitterTitle: item.twitter.title ?? "",
      twitterDescription: item.twitter.description ?? "",
    };
  }
  return {
    seo: { ...form.seo, locales, canonicalUrl: snapshot.canonicalUrl ?? "" },
    shareImageMediaId: snapshot.shareImageMediaId,
    index: snapshot.robots.index,
    follow: snapshot.robots.follow,
    active: snapshot.active,
  };
}

export function StaticSeoManager({
  canCreate,
  canUpdate,
  canUploadMedia,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canUploadMedia: boolean;
}) {
  const t = useTranslations("dashboard.seoControls");
  const [records, setRecords] = useState<readonly Snapshot[]>([]);
  const [key, setKey] = useState<PageKey>("home");
  const [form, setForm] = useState<Form>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const record = useMemo(() => records.find((item) => item.key === key), [key, records]);
  const permitted = record ? canUpdate : canCreate;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/seo/static", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { data: readonly Snapshot[] };
      setRecords(body.data);
      const selected = body.data.find((item) => item.key === key);
      setForm(selected ? fromSnapshot(selected) : emptyForm());
      setMessage("");
    } catch {
      setMessage(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [key, t]);

  useEffect(() => {
    queueMicrotask(() => {
      load().catch(() => undefined);
    });
  }, [load]);

  const choose = (next: PageKey) => {
    setKey(next);
    const selected = records.find((item) => item.key === next);
    setForm(selected ? fromSnapshot(selected) : emptyForm());
    setMessage("");
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const translations = SEO_LOCALES.filter(
        (locale) => locale === "en" || form.seo.locales[locale].title.trim(),
      ).map((locale) => {
        const item = form.seo.locales[locale];
        return {
          locale,
          title: item.title,
          description: item.description,
          keywords: item.keywords
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          openGraph: {
            title: item.openGraphTitle || null,
            description: item.openGraphDescription || null,
          },
          twitter: {
            title: item.twitterTitle || null,
            description: item.twitterDescription || null,
          },
        };
      });
      const payload = {
        ...(!record ? { key } : {}),
        translations,
        canonicalUrl: form.seo.canonicalUrl || null,
        robots: { index: form.index, follow: form.follow },
        shareImageMediaId: form.shareImageMediaId,
        active: form.active,
      };
      const response = await fetch(record ? `/api/seo/static/${key}` : "/api/seo/static", {
        method: record ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      setMessage(t("saved"));
      await load();
    } catch {
      setMessage(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">{t("staticTitle")}</Typography>
        <Typography color="text.secondary">{t("staticIntro")}</Typography>
      </Box>
      <FormControl sx={{ maxWidth: 360 }}>
        <InputLabel id="seo-page-key">{t("staticPage")}</InputLabel>
        <Select
          labelId="seo-page-key"
          label={t("staticPage")}
          value={key}
          onChange={(event) => choose(event.target.value as PageKey)}
        >
          {PAGE_KEYS.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`pages.${item}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Alert severity={record ? "info" : "warning"}>
            {record ? t("manualRecord") : t("missingRecord")}
          </Alert>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <SeoFields
              disabled={!permitted || saving}
              ownershipEditable={false}
              values={form.seo}
              onChange={(seo) => setForm((current) => ({ ...current, seo }))}
            />
          </Paper>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h6">{t("discovery")}</Typography>
              <MediaPicker
                allowedKinds={["image"]}
                canUpload={canUploadMedia}
                disabled={!permitted || saving}
                label={t("shareImage")}
                value={form.shareImageMediaId}
                onChange={(shareImageMediaId) =>
                  setForm((current) => ({ ...current, shareImageMediaId }))
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.index}
                    disabled={!permitted || saving}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, index: event.target.checked }))
                    }
                  />
                }
                label={t("allowIndexing")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.follow}
                    disabled={!permitted || saving}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, follow: event.target.checked }))
                    }
                  />
                }
                label={t("followLinks")}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.active}
                    disabled={!permitted || saving}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                  />
                }
                label={t("active")}
              />
            </Stack>
          </Paper>
          {message ? (
            <Alert severity={message === t("saved") ? "success" : "error"}>{message}</Alert>
          ) : null}
          <Button
            variant="contained"
            startIcon={<SaveRounded />}
            disabled={!permitted || saving}
            onClick={() => {
              save().catch(() => undefined);
            }}
            sx={{ alignSelf: "flex-start" }}
          >
            {saving ? t("saving") : record ? t("saveSeo") : t("createSeo")}
          </Button>
        </>
      )}
    </Stack>
  );
}
