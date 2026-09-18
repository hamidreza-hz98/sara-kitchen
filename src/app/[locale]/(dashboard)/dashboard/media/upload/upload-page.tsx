"use client";

import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useFeedback } from "@/hooks";
import {
  uploadMediaBatch,
  type MediaBulkUploadItem,
  type MediaBulkUploadResult,
  type MediaBulkUploadStage,
} from "@/lib/media-bulk-upload";
import {
  MEDIA_UPLOAD_MAX_BYTES,
  MEDIA_UPLOAD_MAX_FILES,
  mediaUploadAdmission,
  mediaUploadFingerprint,
  type MediaUploadAdmissionError,
} from "@/lib/media-upload-admission";
import { Link } from "@/locales/navigation";

type TranslationLocale = "en" | "pt-PT" | "fa";
type UploadPageError =
  | MediaUploadAdmissionError
  | "too_many_files"
  | "duplicate_selection"
  | "duplicate_server"
  | "missing_alt"
  | "rate_limited"
  | "service_unavailable"
  | "network_error"
  | "aborted"
  | "upload_failed";
type UploadRow = {
  id: string;
  file: File;
  alt: Record<TranslationLocale, string>;
  stage: MediaBulkUploadStage;
  progress: number;
  attempts: number;
  error: UploadPageError | null;
  result: MediaBulkUploadResult | null;
};

const accept = ".jpg,.jpeg,.png,.webp,.avif";
const locales = ["en", "pt-PT", "fa"] as const;

function initialAlt(file: File): string {
  return file.name.slice(0, file.name.lastIndexOf(".")).replaceAll(/[_-]+/gu, " ").trim();
}

function errorCode(error: string): UploadPageError {
  if (error === "CONFLICT") return "duplicate_server";
  if (error === "RATE_LIMITED") return "rate_limited";
  if (error === "SERVICE_UNAVAILABLE") return "service_unavailable";
  if (error === "NETWORK_ERROR") return "network_error";
  if (error === "aborted") return "aborted";
  return "upload_failed";
}

export function MediaUploadPage() {
  const t = useTranslations("dashboard.mediaUpload");
  const feedback = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState<UploadPageError | null>(null);
  const [lastSummary, setLastSummary] = useState<{
    total: number;
    succeeded: number;
    failed: number;
    retried: number;
  } | null>(null);

  const hasPending = busy || rows.some((row) => row.stage !== "succeeded");
  const completed = rows.filter((row) => row.stage === "succeeded").length;
  const totalProgress = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length)
    : 0;

  useEffect(() => {
    if (!hasPending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onLinkClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname && anchor.search === window.location.search)
        return;
      if (!window.confirm(t("leaveWarning"))) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [hasPending, t]);

  const addFiles = useCallback(
    (files: FileList | readonly File[]) => {
      if (busy) return;
      const candidates = Array.from(files);
      if (candidates.length === 0) return;
      setSelectionError(null);
      setLastSummary(null);
      const known = new Set(rows.map((row) => mediaUploadFingerprint(row.file)));
      const next = [...rows];
      let rejected: UploadPageError | null = null;
      for (const file of candidates) {
        if (next.length >= MEDIA_UPLOAD_MAX_FILES) {
          rejected = "too_many_files";
          break;
        }
        const fingerprint = mediaUploadFingerprint(file);
        if (known.has(fingerprint)) {
          rejected = "duplicate_selection";
          continue;
        }
        known.add(fingerprint);
        const issue = mediaUploadAdmission(file);
        next.push({
          id: crypto.randomUUID(),
          file,
          alt: { en: initialAlt(file), "pt-PT": "", fa: "" },
          stage: issue ? "failed" : "queued",
          progress: issue ? 100 : 0,
          attempts: 0,
          error: issue,
          result: null,
        });
      }
      setRows(next);
      setSelectionError(rejected);
      if (inputRef.current) inputRef.current.value = "";
    },
    [busy, rows],
  );

  const patchRow = (id: string, patch: Partial<UploadRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const upload = async (selected: readonly UploadRow[]) => {
    if (selected.length === 0 || busy) return;
    const missingAlt = selected.some((row) => row.alt.en.trim().length === 0);
    if (missingAlt) {
      setSelectionError("missing_alt");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setSelectionError(null);
    setLastSummary(null);
    const items: MediaBulkUploadItem[] = selected.map((row) => ({
      clientId: row.id,
      file: row.file,
      translations: locales
        .map((locale) => ({ locale, alt: row.alt[locale].trim() }))
        .filter((translation) => translation.alt.length > 0),
    }));
    try {
      const report = await uploadMediaBatch(items, {
        signal: controller.signal,
        onProgress: (event) =>
          patchRow(event.clientId, {
            stage: event.stage,
            progress: event.progress,
            attempts: event.attempt,
          }),
      });
      setRows((current) =>
        current.map((row) => {
          const result = report.items.find((item) => item.clientId === row.id);
          if (!result) return row;
          return {
            ...row,
            result,
            stage: result.status,
            progress: 100,
            attempts: result.attempts,
            error: result.error ? errorCode(result.error.code) : null,
          };
        }),
      );
      setLastSummary(report.summary);
      feedback.notify({
        message: t("summary", report.summary),
        severity: report.summary.failed ? "warning" : "success",
      });
    } catch {
      setSelectionError("upload_failed");
      setRows((current) =>
        current.map((row) =>
          selected.some((item) => item.id === row.id)
            ? { ...row, stage: "failed", progress: 100, error: "upload_failed" }
            : row,
        ),
      );
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const retryOne = (row: UploadRow) => {
    if (busy) return;
    patchRow(row.id, { stage: "queued", progress: 0, error: null, result: null });
    upload([row]).catch(() => setSelectionError("upload_failed"));
  };

  const eligible = rows.filter(
    (row) => row.stage === "queued" || (row.stage === "failed" && !row.error),
  );
  const canUpload = eligible.length > 0 && !busy;

  return (
    <Stack spacing={4} sx={{ maxWidth: 1040, mx: "auto" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" } }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography component="h1" variant="h2">
            {t("title")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t("description")}
          </Typography>
        </Box>
        <Button component={Link} href="/dashboard/media" startIcon={<ArrowBackRounded />}>
          {t("back")}
        </Button>
      </Stack>

      <Paper
        aria-label={t("dropLabel")}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? "none" : "copy";
          if (!busy) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        sx={{
          p: { xs: 5, sm: 8 },
          textAlign: "center",
          border: "2px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          bgcolor: dragging ? "action.hover" : "background.paper",
        }}
      >
        <CloudUploadRounded color="primary" sx={{ fontSize: 56 }} />
        <Typography component="h2" variant="h4" sx={{ mt: 2 }}>
          {t("dropTitle")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("dropHint")}
        </Typography>
        <input
          accept={accept}
          aria-label={t("pickerLabel")}
          hidden
          multiple
          onChange={(event) => event.target.files && addFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
        <Button
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          sx={{ mt: 3 }}
          variant="contained"
        >
          {t("browse")}
        </Button>
        <Typography color="text.secondary" sx={{ mt: 2, fontSize: 13 }}>
          {t("limits", {
            maxFiles: MEDIA_UPLOAD_MAX_FILES,
            maxMb: MEDIA_UPLOAD_MAX_BYTES / 1024 / 1024,
          })}
        </Typography>
      </Paper>

      {selectionError && (
        <Typography role="alert" color="error">
          {t(`errors.${selectionError}`)}
        </Typography>
      )}

      {rows.length > 0 && (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" } }}
          >
            <Typography component="h2" variant="h4" sx={{ flexGrow: 1 }}>
              {t("queueTitle", { count: rows.length })}
            </Typography>
            <Typography color="text.secondary">
              {t("completed", { done: completed, total: rows.length })}
            </Typography>
          </Stack>
          <LinearProgress
            aria-label={t("overallProgress")}
            value={totalProgress}
            variant="determinate"
          />
          {rows.map((row) => (
            <Paper
              key={row.id}
              sx={{
                p: { xs: 3, sm: 4 },
                border: "1px solid",
                borderColor: row.error ? "error.light" : "divider",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                sx={{ alignItems: { sm: "flex-start" } }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: "action.hover",
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <ImageRounded color="primary" />
                </Box>
                <Stack spacing={2} sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere", flexGrow: 1 }}>
                      {row.file.name}
                    </Typography>
                    <Chip
                      color={
                        row.stage === "succeeded"
                          ? "success"
                          : row.stage === "failed"
                            ? "error"
                            : "default"
                      }
                      label={t(`stages.${row.stage}`)}
                      size="small"
                    />
                  </Stack>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {(row.file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {row.file.type || t("unknownType")}
                  </Typography>
                  <LinearProgress
                    aria-label={t("fileProgress", { name: row.file.name })}
                    value={row.progress}
                    variant="determinate"
                  />
                  {row.error && (
                    <Typography role="alert" color="error" sx={{ fontSize: 13 }}>
                      {t(`errors.${row.error}`)}
                    </Typography>
                  )}
                  {row.attempts > 1 && (
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      {t("attempts", { count: row.attempts })}
                    </Typography>
                  )}
                  {row.stage !== "succeeded" && !busy && (
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        slotProps={{ htmlInput: { maxLength: 500 } }}
                        label={t("altEnglish")}
                        onChange={(event) =>
                          patchRow(row.id, { alt: { ...row.alt, en: event.target.value } })
                        }
                        required
                        value={row.alt.en}
                      />
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                          fullWidth
                          slotProps={{ htmlInput: { maxLength: 500 } }}
                          label={t("altPortuguese")}
                          onChange={(event) =>
                            patchRow(row.id, { alt: { ...row.alt, "pt-PT": event.target.value } })
                          }
                          value={row.alt["pt-PT"]}
                        />
                        <TextField
                          fullWidth
                          slotProps={{ htmlInput: { maxLength: 500 } }}
                          label={t("altPersian")}
                          onChange={(event) =>
                            patchRow(row.id, { alt: { ...row.alt, fa: event.target.value } })
                          }
                          value={row.alt.fa}
                        />
                      </Stack>
                    </Stack>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  {row.stage === "failed" &&
                    row.error !== "duplicate_server" &&
                    mediaUploadAdmission(row.file) === null &&
                    !busy && (
                      <IconButton
                        aria-label={t("retryFile", { name: row.file.name })}
                        onClick={() => retryOne(row)}
                      >
                        <RestartAltRounded />
                      </IconButton>
                    )}
                  {row.stage !== "succeeded" && !busy && (
                    <IconButton
                      aria-label={t("removeFile", { name: row.file.name })}
                      onClick={() =>
                        setRows((current) => current.filter((item) => item.id !== row.id))
                      }
                    >
                      <CloseRounded />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {lastSummary && (
        <Paper role="status" sx={{ p: 4, border: "1px solid", borderColor: "divider" }}>
          <Typography component="h2" variant="h4">
            {t("resultTitle")}
          </Typography>
          <Typography sx={{ mt: 1 }}>{t("summary", lastSummary)}</Typography>
        </Paper>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "flex-end" }}
      >
        {rows.length > 0 && !busy && (
          <Button
            color="error"
            startIcon={<DeleteOutlineRounded />}
            onClick={() => {
              setRows([]);
              setLastSummary(null);
            }}
          >
            {t("clear")}
          </Button>
        )}
        {busy && (
          <Button color="error" onClick={() => abortRef.current?.abort()}>
            {t("cancelUpload")}
          </Button>
        )}
        <Button
          disabled={!canUpload}
          onClick={() => {
            void upload(eligible).catch(() => setSelectionError("upload_failed"));
          }}
          startIcon={<CloudUploadRounded />}
          variant="contained"
        >
          {busy ? t("uploading") : t("start", { count: eligible.length })}
        </Button>
      </Stack>
    </Stack>
  );
}
