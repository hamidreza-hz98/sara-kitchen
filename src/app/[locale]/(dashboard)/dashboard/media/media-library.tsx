"use client";

import AddPhotoAlternateRounded from "@mui/icons-material/AddPhotoAlternateRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import GridViewRounded from "@mui/icons-material/GridViewRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import InsertDriveFileRounded from "@mui/icons-material/InsertDriveFileRounded";
import ListRounded from "@mui/icons-material/ListRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { ActionButton, AppDialog, AppPagination, EmptyState, ErrorState } from "@/components/ui";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import {
  MEDIA_LIST_KINDS,
  MEDIA_LIST_PAGE_SIZES,
  MEDIA_LIST_STATES,
  MEDIA_LIST_USAGE,
  mediaListApiSearchParams,
  parseMediaListUiQuery,
  patchMediaListSearchParams,
} from "@/lib/media-list-query";
import { Link, usePathname, useRouter } from "@/locales/navigation";

type MediaTranslation = Readonly<{ alt: string; locale: "en" | "fa" | "pt-PT" }>;
type MediaItem = Readonly<{
  bytes: number | null;
  createdAt: string;
  dimensions: Readonly<{ height: number; width: number }> | null;
  id: string;
  kind: "image" | "pdf" | "video";
  mimeType: string;
  originalName: string;
  preview: Readonly<{ expiresAt: string | null; url: string }> | null;
  processingState: "failed" | "pending" | "processing" | "ready";
  translations: readonly MediaTranslation[];
  updatedAt: string;
  uploaderId: string;
  usageCount: number;
}>;

type PaginationMeta = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

type MediaEnvelope = Readonly<{
  data?: readonly MediaItem[];
  meta?: Readonly<{ pagination?: PaginationMeta }>;
}>;

type Capabilities = Readonly<{ create: boolean; delete: boolean; update: boolean }>;

function mediaAlt(item: MediaItem, locale: string): string {
  return (
    item.translations.find((translation) => translation.locale === locale)?.alt ??
    item.translations.find((translation) => translation.locale === "en")?.alt ??
    item.originalName
  );
}

function formatBytes(bytes: number | null, formatNumber: (value: number) => string): string {
  if (bytes === null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${formatNumber(value)} ${units[unit]}`;
}

function MediaVisual({ item, large = false }: { item: MediaItem; large?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("dashboard.media");
  const height = large ? { xs: 260, sm: 460 } : 210;

  if (item.kind === "image" && item.preview) {
    return (
      <Box
        alt={mediaAlt(item, locale)}
        component="img"
        src={item.preview.url}
        sx={{ display: "block", width: "100%", height, objectFit: "cover" }}
      />
    );
  }
  if (large && item.kind === "video" && item.preview) {
    return (
      <Box
        component="video"
        controls
        preload="metadata"
        src={item.preview.url}
        sx={{ display: "block", width: "100%", maxHeight: 460, bgcolor: "common.black" }}
      >
        {t("previewUnavailable")}
      </Box>
    );
  }
  return (
    <Box
      aria-label={t("previewUnavailable")}
      role="img"
      sx={{
        height,
        display: "grid",
        placeItems: "center",
        color: "text.secondary",
        bgcolor: "action.hover",
      }}
    >
      {item.kind === "pdf" ? (
        <InsertDriveFileRounded sx={{ fontSize: large ? 88 : 56 }} />
      ) : (
        <ImageNotSupportedRounded sx={{ fontSize: large ? 88 : 56 }} />
      )}
    </Box>
  );
}

function StateChip({ state }: { state: MediaItem["processingState"] }) {
  const t = useTranslations("dashboard.media");
  const color = state === "ready" ? "success" : state === "failed" ? "error" : "warning";
  return <Chip color={color} label={t(`states.${state}`)} size="small" variant="outlined" />;
}

export function MediaLibrary({ capabilities }: { capabilities: Capabilities }) {
  const t = useTranslations("dashboard.media");
  const locale = useLocale();
  const formatter = useFormatter();
  const feedback = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => parseMediaListUiQuery(new URLSearchParams(rawQuery)), [rawQuery]);
  const apiQuery = useMemo(() => mediaListApiSearchParams(query).toString(), [query]);
  const [items, setItems] = useState<readonly MediaItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: query.pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<readonly MediaItem[]>([]);
  const [mutating, setMutating] = useState(false);
  const search = searchDraft ?? query.search ?? "";

  const replaceQuery = useCallback(
    (patch: Readonly<Record<string, number | string | undefined>>) => {
      setLoading(true);
      setError(false);
      const next = patchMediaListSearchParams(new URLSearchParams(rawQuery), patch);
      const suffix = next.size ? `?${next.toString()}` : "";
      router.replace(`${pathname}${suffix}`, { scroll: false });
    },
    [pathname, rawQuery, router],
  );

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === (query.search ?? "") || (trimmed.length > 0 && trimmed.length < 2)) return;
    const timer = window.setTimeout(() => {
      setSearchDraft(null);
      replaceQuery({ page: 1, search: trimmed || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query.search, replaceQuery, search]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/media?${apiQuery}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("media_list_failed");
        return (await response.json()) as MediaEnvelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_media_list");
        setError(false);
        setItems(body.data);
        setPagination(body.meta.pagination);
        setSelected(
          (current) =>
            new Set([...current].filter((id) => body.data?.some((item) => item.id === id))),
        );
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiQuery, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setError(false);
    setReloadKey((value) => value + 1);
  };

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const selectedItems = items.filter((item) => selected.has(item.id));
  const selectedReferenced = selectedItems.some((item) => item.usageCount > 0);

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const deleteTargets = async () => {
    setMutating(true);
    try {
      const headers = await csrfJsonHeaders("admin");
      const results = await Promise.all(
        deleting.map(async (item) => ({
          id: item.id,
          response: await fetch(`/api/media/${item.id}`, {
            method: "DELETE",
            headers,
            credentials: "same-origin",
          }),
        })),
      );
      const removed = results.filter(({ response }) => response.ok).map(({ id }) => id);
      if (removed.length !== results.length) throw new Error("media_delete_failed");
      setSelected((current) => new Set([...current].filter((id) => !removed.includes(id))));
      setDeleting([]);
      refresh();
      feedback.notify({
        message: t("deleteSuccess", { count: removed.length }),
        severity: "success",
      });
    } catch {
      feedback.notify({ message: t("deleteError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const saveEdit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const translations = (["en", "pt-PT", "fa"] as const)
      .map((translationLocale) => ({
        locale: translationLocale,
        alt: String(data.get(`alt-${translationLocale}`) ?? "").trim(),
      }))
      .filter((translation) => translation.alt.length > 0);
    if (!editing || !translations.some((translation) => translation.locale === "en")) return;
    setMutating(true);
    try {
      const response = await fetch(`/api/media/${editing.id}`, {
        method: "PATCH",
        headers: await csrfJsonHeaders("admin"),
        credentials: "same-origin",
        body: JSON.stringify({
          originalName: String(data.get("originalName") ?? ""),
          translations,
        }),
      });
      if (!response.ok) throw new Error("media_update_failed");
      setEditing(null);
      refresh();
      feedback.notify({ message: t("editSuccess"), severity: "success" });
    } catch {
      feedback.notify({ message: t("editError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const referenceLabel = (item: MediaItem) =>
    item.usageCount > 0 ? t("referenced", { count: item.usageCount }) : t("unreferenced");

  const actions = (item: MediaItem) => (
    <Stack direction="row" spacing={0.5}>
      <Tooltip title={t("preview")}>
        <IconButton
          aria-label={t("previewItem", { name: item.originalName })}
          onClick={() => setPreview(item)}
        >
          <VisibilityRounded />
        </IconButton>
      </Tooltip>
      {capabilities.update && (
        <Tooltip title={t("edit")}>
          <IconButton
            aria-label={t("editItem", { name: item.originalName })}
            onClick={() => setEditing(item)}
          >
            <EditRounded />
          </IconButton>
        </Tooltip>
      )}
      {capabilities.delete && (
        <Tooltip title={item.usageCount > 0 ? t("deleteReferencedHelp") : t("delete")}>
          <span>
            <IconButton
              aria-label={t("deleteItem", { name: item.originalName })}
              color="error"
              disabled={item.usageCount > 0}
              onClick={() => setDeleting([item])}
            >
              <DeleteOutlineRounded />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Stack>
  );

  return (
    <Stack spacing={5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={3}
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
        {capabilities.create && (
          <Button
            component={Link}
            href="/dashboard/media/upload"
            startIcon={<AddPhotoAlternateRounded />}
            variant="contained"
          >
            {t("upload")}
          </Button>
        )}
      </Stack>

      <Paper sx={{ p: { xs: 3, md: 4 }, border: "1px solid", borderColor: "divider" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "minmax(240px, 2fr) 1fr",
              lg: "minmax(260px, 2fr) repeat(4, minmax(130px, 1fr)) auto",
            },
            gap: 2,
          }}
        >
          <TextField
            aria-label={t("search")}
            label={t("search")}
            value={search}
            onChange={(event) => setSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (search.trim().length === 0 || search.trim().length >= 2)
              ) {
                setSearchDraft(null);
                replaceQuery({ page: 1, search: search.trim() || undefined });
              }
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControl>
            <InputLabel id="media-kind-label">{t("kind")}</InputLabel>
            <Select
              label={t("kind")}
              labelId="media-kind-label"
              value={query.kind ?? ""}
              onChange={(event) => replaceQuery({ kind: event.target.value || undefined, page: 1 })}
            >
              <MenuItem value="">{t("allKinds")}</MenuItem>
              {MEDIA_LIST_KINDS.map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {t(`kinds.${kind}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="media-usage-label">{t("referenceStatus")}</InputLabel>
            <Select
              label={t("referenceStatus")}
              labelId="media-usage-label"
              value={query.usage ?? ""}
              onChange={(event) =>
                replaceQuery({ page: 1, usage: event.target.value || undefined })
              }
            >
              <MenuItem value="">{t("allReferences")}</MenuItem>
              {MEDIA_LIST_USAGE.map((usage) => (
                <MenuItem key={usage} value={usage}>
                  {t(`usage.${usage}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="media-state-label">{t("processingState")}</InputLabel>
            <Select
              label={t("processingState")}
              labelId="media-state-label"
              value={query.processingState ?? ""}
              onChange={(event) =>
                replaceQuery({ page: 1, processingState: event.target.value || undefined })
              }
            >
              <MenuItem value="">{t("allStates")}</MenuItem>
              {MEDIA_LIST_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {t(`states.${state}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel id="media-sort-label">{t("sort")}</InputLabel>
            <Select
              label={t("sort")}
              labelId="media-sort-label"
              value={`${query.sortBy}:${query.sortDirection}`}
              onChange={(event) => replaceQuery({ page: 1, sort: event.target.value })}
            >
              <MenuItem value="createdAt:desc">{t("sorts.newest")}</MenuItem>
              <MenuItem value="createdAt:asc">{t("sorts.oldest")}</MenuItem>
              <MenuItem value="originalName:asc">{t("sorts.nameAsc")}</MenuItem>
              <MenuItem value="originalName:desc">{t("sorts.nameDesc")}</MenuItem>
              <MenuItem value="bytes:desc">{t("sorts.largest")}</MenuItem>
              <MenuItem value="bytes:asc">{t("sorts.smallest")}</MenuItem>
              <MenuItem value="usageCount:desc">{t("sorts.mostUsed")}</MenuItem>
              <MenuItem value="usageCount:asc">{t("sorts.leastUsed")}</MenuItem>
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip title={t("refresh")}>
              <IconButton aria-label={t("refresh")} onClick={refresh}>
                <RefreshRounded />
              </IconButton>
            </Tooltip>
            <ToggleButtonGroup
              exclusive
              aria-label={t("viewMode")}
              size="small"
              value={query.view}
              onChange={(_event, value: "grid" | "list" | null) =>
                value && replaceQuery({ view: value })
              }
            >
              <ToggleButton aria-label={t("gridView")} value="grid">
                <GridViewRounded />
              </ToggleButton>
              <ToggleButton aria-label={t("listView")} value="list">
                <ListRounded />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Box>
      </Paper>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" }, minHeight: 40 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexGrow: 1 }}>
          <Checkbox
            checked={allSelected}
            indeterminate={selected.size > 0 && !allSelected}
            slotProps={{ input: { "aria-label": t("selectPage") } }}
            onChange={togglePage}
          />
          <Typography>
            {selected.size
              ? t("selected", { count: selected.size })
              : t("results", { count: pagination.totalItems })}
          </Typography>
        </Stack>
        {selected.size > 0 && (
          <Button onClick={() => setSelected(new Set())}>{t("clearSelection")}</Button>
        )}
        {capabilities.delete && selected.size > 0 && (
          <Tooltip title={selectedReferenced ? t("deleteReferencedHelp") : ""}>
            <span>
              <Button
                color="error"
                disabled={selectedReferenced}
                startIcon={<DeleteOutlineRounded />}
                onClick={() => setDeleting(selectedItems)}
              >
                {t("deleteSelected")}
              </Button>
            </span>
          </Tooltip>
        )}
      </Stack>

      {loading ? (
        <Box
          aria-label={t("loading")}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
            gap: 4,
          }}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} height={330} sx={{ borderRadius: 3 }} variant="rectangular" />
          ))}
        </Box>
      ) : error ? (
        <ErrorState
          action={<ActionButton onClick={refresh}>{t("retry")}</ActionButton>}
          description={t("loadErrorDescription")}
          title={t("loadErrorTitle")}
        />
      ) : items.length === 0 ? (
        <EmptyState
          action={
            capabilities.create ? (
              <ActionButton component={Link} href="/dashboard/media/upload" variant="contained">
                {t("upload")}
              </ActionButton>
            ) : undefined
          }
          description={t("emptyDescription")}
          title={t("emptyTitle")}
        />
      ) : query.view === "grid" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            gap: 4,
          }}
        >
          {items.map((item) => (
            <Card
              key={item.id}
              sx={{
                position: "relative",
                border: "2px solid",
                borderColor: selected.has(item.id) ? "primary.main" : "transparent",
                overflow: "hidden",
              }}
            >
              <Checkbox
                checked={selected.has(item.id)}
                slotProps={{
                  input: { "aria-label": t("selectItem", { name: item.originalName }) },
                }}
                onChange={() => toggleSelected(item.id)}
                sx={{
                  position: "absolute",
                  zIndex: 2,
                  insetBlockStart: 8,
                  insetInlineStart: 8,
                  bgcolor: "background.paper",
                  "&:hover": { bgcolor: "background.paper" },
                }}
              />
              <CardActionArea
                aria-label={t("previewItem", { name: item.originalName })}
                onClick={() => setPreview(item)}
              >
                <MediaVisual item={item} />
              </CardActionArea>
              <CardContent>
                <Typography noWrap title={item.originalName} sx={{ fontWeight: 800 }}>
                  {item.originalName}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
                  <Chip
                    color={item.usageCount > 0 ? "info" : "default"}
                    icon={item.usageCount > 0 ? <CheckCircleRounded /> : undefined}
                    label={referenceLabel(item)}
                    size="small"
                  />
                  <StateChip state={item.processingState} />
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 2, fontSize: 13 }}>
                  {formatBytes(item.bytes, (value) =>
                    formatter.number(value, { maximumFractionDigits: 1 }),
                  )}{" "}
                  · {formatter.dateTime(new Date(item.createdAt), { dateStyle: "medium" })}
                </Typography>
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: "flex-end" }}>{actions(item)}</CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ border: "1px solid", borderColor: "divider" }}>
          <Table aria-label={t("listLabel")}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected}
                    slotProps={{ input: { "aria-label": t("selectPage") } }}
                    onChange={togglePage}
                  />
                </TableCell>
                <TableCell>{t("file")}</TableCell>
                <TableCell>{t("kind")}</TableCell>
                <TableCell>{t("size")}</TableCell>
                <TableCell>{t("referenceStatus")}</TableCell>
                <TableCell>{t("processingState")}</TableCell>
                <TableCell>{t("created")}</TableCell>
                <TableCell align="right">{t("actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow hover key={item.id} selected={selected.has(item.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.has(item.id)}
                      slotProps={{
                        input: { "aria-label": t("selectItem", { name: item.originalName }) },
                      }}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      color="inherit"
                      onClick={() => setPreview(item)}
                      sx={{ fontWeight: 700, textTransform: "none" }}
                    >
                      {item.originalName}
                    </Button>
                  </TableCell>
                  <TableCell>{t(`kinds.${item.kind}`)}</TableCell>
                  <TableCell>
                    {formatBytes(item.bytes, (value) =>
                      formatter.number(value, { maximumFractionDigits: 1 }),
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={item.usageCount > 0 ? "info" : "default"}
                      label={referenceLabel(item)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <StateChip state={item.processingState} />
                  </TableCell>
                  <TableCell>
                    {formatter.dateTime(new Date(item.createdAt), { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell align="right">{actions(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !error && pagination.totalPages > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <FormControl size="small">
            <InputLabel id="media-page-size-label">{t("perPage")}</InputLabel>
            <Select
              label={t("perPage")}
              labelId="media-page-size-label"
              value={query.pageSize}
              onChange={(event) => replaceQuery({ page: 1, pageSize: Number(event.target.value) })}
            >
              {MEDIA_LIST_PAGE_SIZES.map((size) => (
                <MenuItem key={size} value={size}>
                  {size}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <AppPagination
            count={pagination.totalPages}
            label={t("pagination")}
            page={pagination.page}
            onChange={(_event, page) => replaceQuery({ page })}
          />
        </Stack>
      )}

      <AppDialog
        closeLabel={t("close")}
        description={preview ? referenceLabel(preview) : undefined}
        fullWidth
        maxWidth="md"
        open={Boolean(preview)}
        title={preview?.originalName ?? ""}
        onClose={() => setPreview(null)}
      >
        {preview && (
          <Stack spacing={3}>
            <MediaVisual item={preview} large />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Chip label={preview.mimeType} />
              <Chip
                label={formatBytes(preview.bytes, (value) =>
                  formatter.number(value, { maximumFractionDigits: 1 }),
                )}
              />
              {preview.dimensions && (
                <Chip label={`${preview.dimensions.width} × ${preview.dimensions.height}`} />
              )}
            </Stack>
            <Typography color="text.secondary">{mediaAlt(preview, locale)}</Typography>
          </Stack>
        )}
      </AppDialog>

      <AppDialog
        actions={
          editing ? (
            <>
              <Button disabled={mutating} onClick={() => setEditing(null)}>
                {t("cancel")}
              </Button>
              <ActionButton
                form="media-edit-form"
                loading={mutating}
                type="submit"
                variant="contained"
              >
                {t("save")}
              </ActionButton>
            </>
          ) : undefined
        }
        closeLabel={t("close")}
        fullWidth
        maxWidth="sm"
        open={Boolean(editing)}
        title={t("editTitle")}
        onClose={() => !mutating && setEditing(null)}
      >
        {editing && (
          <Box
            component="form"
            id="media-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveEdit(event.currentTarget).catch(() =>
                feedback.notify({ message: t("editError"), severity: "error" }),
              );
            }}
          >
            <Stack spacing={3}>
              <TextField
                defaultValue={editing.originalName}
                fullWidth
                label={t("fileName")}
                name="originalName"
                required
              />
              <TextField
                defaultValue={
                  editing.translations.find((value) => value.locale === "en")?.alt ?? ""
                }
                fullWidth
                label={t("altEnglish")}
                name="alt-en"
                required
              />
              <TextField
                defaultValue={
                  editing.translations.find((value) => value.locale === "pt-PT")?.alt ?? ""
                }
                fullWidth
                label={t("altPortuguese")}
                name="alt-pt-PT"
              />
              <TextField
                defaultValue={
                  editing.translations.find((value) => value.locale === "fa")?.alt ?? ""
                }
                fullWidth
                label={t("altPersian")}
                name="alt-fa"
              />
            </Stack>
          </Box>
        )}
      </AppDialog>

      <ConfirmationDialog
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        confirmLabel={t("confirmDelete")}
        danger
        description={
          deleting.length === 1
            ? t("deleteDescription", { name: deleting[0]?.originalName ?? "" })
            : t("deleteManyDescription", { count: deleting.length })
        }
        loading={mutating}
        open={deleting.length > 0}
        title={t("deleteTitle")}
        onCancel={() => !mutating && setDeleting([])}
        onConfirm={() => {
          deleteTargets().catch(() =>
            feedback.notify({ message: t("deleteError"), severity: "error" }),
          );
        }}
      />
    </Stack>
  );
}
