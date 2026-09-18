"use client";

import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadMediaBatch } from "@/lib/media-bulk-upload";
import { mediaUploadAdmission } from "@/lib/media-upload-admission";

export type MediaKind = "image" | "video" | "pdf";
export type MediaPickerItem = Readonly<{
  id: string;
  originalName: string;
  kind: MediaKind;
  processingState: "pending" | "processing" | "ready" | "failed";
  preview: Readonly<{ url: string }> | null;
  translations: readonly Readonly<{ locale: string; alt: string }>[];
}>;

type CommonProps = Readonly<{
  label: string;
  allowedKinds?: readonly MediaKind[];
  canUpload?: boolean;
  disabled?: boolean;
  maxItems?: number;
}>;

export type MediaPickerProps = CommonProps &
  (
    | Readonly<{ multiple?: false; value: string | null; onChange: (value: string | null) => void }>
    | Readonly<{
        multiple: true;
        value: readonly string[];
        onChange: (value: readonly string[]) => void;
      }>
  );

type MediaListEnvelope = Readonly<{
  data?: readonly MediaPickerItem[];
  meta?: Readonly<{ pagination?: Readonly<{ totalPages: number }> }>;
}>;

const PAGE_SIZE = 12;
const ALL_KINDS: readonly MediaKind[] = ["image", "video", "pdf"];

function itemAlt(item: MediaPickerItem, locale: string): string {
  return (
    item.translations.find((translation) => translation.locale === locale)?.alt ??
    item.translations.find((translation) => translation.locale === "en")?.alt ??
    item.originalName
  );
}

export function MediaPicker(props: MediaPickerProps) {
  const t = useTranslations("dashboard.mediaPicker");
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const allowedKinds = props.allowedKinds ?? ALL_KINDS;
  const allowedKey = allowedKinds.join(",");
  const selectedValue = props.multiple === true ? props.value : props.value ? [props.value] : [];
  const selectedKey = selectedValue.join(",");
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [items, setItems] = useState<readonly MediaPickerItem[]>([]);
  const [knownItems, setKnownItems] = useState<Record<string, MediaPickerItem>>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) return;
      setLoading(true);
      setError(null);
      const selectableKinds = allowedKey.split(",") as MediaKind[];
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        processingState: "ready",
        sortBy: "createdAt",
        sortDirection: "desc",
      });
      if (search) query.set("search", search);
      if (kind !== "all") query.set("kind", kind);
      else if (selectableKinds.length === 1) query.set("kind", selectableKinds[0]!);
      const response = await fetch(`/api/media?${query.toString()}`, { signal });
      if (!response.ok) throw new Error("media_read_failed");
      const body = (await response.json()) as MediaListEnvelope;
      if (!Array.isArray(body.data) || !body.meta?.pagination)
        throw new Error("media_read_invalid");
      const compatible = body.data.filter((item) => selectableKinds.includes(item.kind));
      setItems(compatible);
      setTotalPages(body.meta.pagination.totalPages);
      setKnownItems((current) => ({
        ...current,
        ...Object.fromEntries(compatible.map((item) => [item.id, item])),
      }));
    },
    [allowedKey, kind, page, search],
  );

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => load(controller.signal))
      .catch((failure: unknown) => {
        if (failure instanceof Error && failure.name === "AbortError") return;
        setError(t("readError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, open, reload, t]);

  useEffect(() => {
    if (!open) return;
    const missing = selectedKey
      .split(",")
      .filter((id) => /^[a-f\d]{24}$/iu.test(id) && !knownItems[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    void Promise.all(
      missing.map(async (id) => {
        const response = await fetch(`/api/media/${id}`, { signal: controller.signal });
        if (!response.ok) return null;
        const result = (await response.json()) as Readonly<{ data?: MediaPickerItem }>;
        return result.data ?? null;
      }),
    )
      .then((resolved) => {
        if (controller.signal.aborted) return;
        const valid = resolved.filter((item): item is MediaPickerItem => item !== null);
        setKnownItems((current) => ({
          ...current,
          ...Object.fromEntries(valid.map((item) => [item.id, item])),
        }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [knownItems, open, selectedKey]);

  const openPicker = () => {
    setSelection(selectedValue);
    setError(null);
    setOpen(true);
  };

  const closePicker = () => {
    if (uploading) return;
    setOpen(false);
  };

  const toggle = (id: string) => {
    if (props.multiple !== true) {
      setSelection([id]);
      return;
    }
    if (selection.includes(id)) {
      setSelection(selection.filter((selected) => selected !== id));
      return;
    }
    if (props.maxItems && selection.length >= props.maxItems) {
      setError(t("maxItems", { count: props.maxItems }));
      return;
    }
    setError(null);
    setSelection([...selection, id]);
  };

  const confirm = () => {
    if (props.multiple === true) props.onChange(selection);
    else props.onChange(selection[0] ?? null);
    setOpen(false);
  };

  const upload = async (file: File) => {
    if (props.multiple === true && props.maxItems && selection.length >= props.maxItems) {
      setError(t("maxItems", { count: props.maxItems }));
      return;
    }
    const issue = mediaUploadAdmission(file);
    if (issue) {
      setError(t(`uploadErrors.${issue}`));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const report = await uploadMediaBatch(
        [
          {
            clientId: crypto.randomUUID(),
            file,
            translations: [
              { locale: "en", alt: file.name.replace(/\.[^.]+$/u, "").replaceAll(/[_-]+/gu, " ") },
            ],
          },
        ],
        { signal: controller.signal, onProgress: (event) => setUploadProgress(event.progress) },
      );
      const result = report.items[0];
      if (result?.status !== "succeeded" || !result.media) {
        setError(t(result?.error?.code === "CONFLICT" ? "duplicateUpload" : "uploadError"));
        return;
      }
      const response = await fetch(`/api/media/${result.media.id}`);
      if (!response.ok) throw new Error("media_detail_failed");
      const detail = (await response.json()) as Readonly<{ data?: MediaPickerItem }>;
      if (!detail.data || !allowedKinds.includes(detail.data.kind))
        throw new Error("media_detail_invalid");
      setKnownItems((current) => ({ ...current, [detail.data!.id]: detail.data! }));
      setSelection((current) =>
        props.multiple === true ? [...new Set([...current, detail.data!.id])] : [detail.data!.id],
      );
      setPage(1);
      setReload((current) => current + 1);
    } catch {
      setError(controller.signal.aborted ? t("uploadCanceled") : t("uploadError"));
    } finally {
      abortRef.current = null;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const applySearch = () => {
    const normalized = searchDraft.trim();
    if (normalized && normalized.length < 2) {
      setError(t("searchLength"));
      return;
    }
    setError(null);
    setPage(1);
    setSearch(normalized);
  };

  return (
    <Stack spacing={1}>
      <Typography component="label" sx={{ fontWeight: 700 }}>
        {props.label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
        {selectedValue.map((id) => {
          const item = knownItems[id];
          return (
            <Chip
              key={id}
              label={item?.originalName ?? id}
              onDelete={
                props.disabled
                  ? undefined
                  : () => {
                      if (props.multiple === true)
                        props.onChange(props.value.filter((selected) => selected !== id));
                      else props.onChange(null);
                    }
              }
            />
          );
        })}
        <Button disabled={props.disabled} onClick={openPicker} variant="outlined">
          {t("browse")}
        </Button>
      </Stack>
      <Dialog
        fullWidth
        maxWidth="md"
        onClose={closePicker}
        open={open}
        aria-labelledby="media-picker-title"
      >
        <DialogTitle id="media-picker-title">{t("title", { field: props.label })}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth
                label={t("search")}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
                value={searchDraft}
              />
              <Button onClick={applySearch} startIcon={<SearchRounded />}>
                {t("find")}
              </Button>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel id="media-picker-kind-label">{t("type")}</InputLabel>
                <Select
                  label={t("type")}
                  labelId="media-picker-kind-label"
                  onChange={(event) => {
                    setKind(event.target.value as MediaKind | "all");
                    setPage(1);
                  }}
                  value={kind}
                >
                  <MenuItem value="all">{t("allTypes")}</MenuItem>
                  {allowedKinds.map((allowed) => (
                    <MenuItem key={allowed} value={allowed}>
                      {t(`kinds.${allowed}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {props.canUpload && allowedKinds.includes("image") && (
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <input
                  accept=".jpg,.jpeg,.png,.webp,.avif"
                  aria-label={t("uploadPicker")}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file).catch(() => setError(t("uploadError")));
                  }}
                  ref={inputRef}
                  type="file"
                />
                <Button
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  startIcon={<CloudUploadRounded />}
                  variant="outlined"
                >
                  {t("upload")}
                </Button>
                {uploading && (
                  <Typography role="status">
                    {t("uploadProgress", { progress: uploadProgress })}
                  </Typography>
                )}
                {uploading && (
                  <Button color="error" onClick={() => abortRef.current?.abort()}>
                    {t("cancelUpload")}
                  </Button>
                )}
              </Stack>
            )}
            {error && (
              <Typography color="error" role="alert">
                {error}
              </Typography>
            )}
            {loading ? (
              <Typography role="status">{t("loading")}</Typography>
            ) : items.length === 0 ? (
              <Typography>{t("empty")}</Typography>
            ) : (
              <Box
                role="group"
                aria-label={t("results")}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: 2,
                }}
              >
                {items.map((item) => (
                  <Button
                    key={item.id}
                    aria-label={t("selectItem", { name: item.originalName })}
                    aria-pressed={selection.includes(item.id)}
                    disabled={uploading}
                    onClick={() => toggle(item.id)}
                    sx={{
                      display: "block",
                      p: 1,
                      textAlign: "start",
                      border: "1px solid",
                      borderColor: selection.includes(item.id) ? "primary.main" : "divider",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: 112,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "action.hover",
                      }}
                    >
                      {item.kind === "image" && item.preview ? (
                        <Box
                          alt={itemAlt(item, locale)}
                          component="img"
                          src={item.preview.url}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <InsertDriveFileRounded />
                      )}
                    </Box>
                    <Stack direction="row" sx={{ alignItems: "center" }}>
                      {selection.includes(item.id) ? (
                        <CheckCircleRounded color="primary" />
                      ) : (
                        <RadioButtonUncheckedRounded color="disabled" />
                      )}
                      <Typography noWrap title={item.originalName} variant="body2">
                        {item.originalName}
                      </Typography>
                    </Stack>
                  </Button>
                ))}
              </Box>
            )}
            {totalPages > 1 && (
              <Pagination
                aria-label={t("pages")}
                count={totalPages}
                onChange={(_event, next) => setPage(next)}
                page={page}
              />
            )}
            <Typography color="text.secondary" variant="body2">
              {t("selected", { count: selection.length })}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={uploading} onClick={closePicker}>
            {t("cancel")}
          </Button>
          <Button disabled={uploading} onClick={confirm} variant="contained">
            {t("useSelection")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
