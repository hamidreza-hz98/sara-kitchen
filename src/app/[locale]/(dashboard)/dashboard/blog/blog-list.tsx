"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArchiveRounded from "@mui/icons-material/ArchiveRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import PublishRounded from "@mui/icons-material/PublishRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import UnpublishedRounded from "@mui/icons-material/UnpublishedRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { AppPagination, EmptyState, ErrorState } from "@/components/ui";
import { PROJECT_TIME_ZONE } from "@/constants";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { usePathname, useRouter } from "@/locales/navigation";

type Locale = "en" | "pt-PT" | "fa";
type BlogStatus = "draft" | "scheduled" | "published" | "archived";
type BlogTranslation = Readonly<{ locale: Locale; title: string; excerpt?: string }>;
type Blog = Readonly<{
  id: string;
  translations: readonly BlogTranslation[];
  slug: string;
  imageMediaId: string | null;
  readTimeMinutes: number;
  authorSnapshot: Readonly<{ displayName: string }>;
  status: BlogStatus;
  publishAt: string | null;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type ListEnvelope<T> = Readonly<{
  data?: readonly T[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type MediaEnvelope = Readonly<{
  data?: Readonly<{ preview?: Readonly<{ url: string }> | null }>;
}>;
type LifecycleAction = "publish" | "unpublish" | "archive";

const PAGE_SIZES = [10, 20, 50] as const;
const STATUSES = ["draft", "scheduled", "published", "archived"] as const;
const SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "publishedAt:desc",
  "publishedAt:asc",
  "publishAt:asc",
  "publishAt:desc",
  "title:asc",
  "title:desc",
  "viewCount:desc",
  "viewCount:asc",
  "status:asc",
] as const;

const STATUS_COLORS: Record<BlogStatus, "default" | "info" | "success" | "warning"> = {
  draft: "warning",
  scheduled: "info",
  published: "success",
  archived: "default",
};

const STATUS_BORDERS: Record<BlogStatus, string> = {
  draft: "warning.main",
  scheduled: "info.main",
  published: "success.main",
  archived: "text.disabled",
};

function localizedTitle(item: Blog, locale: string): string {
  return (
    item.translations.find((value) => value.locale === locale)?.title ??
    item.translations.find((value) => value.locale === "en")?.title ??
    item.translations[0]?.title ??
    item.slug
  );
}

function BlogImage({ id, alt }: { id: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/media/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? ((await response.json()) as MediaEnvelope) : null))
      .then((body) => {
        if (!controller.signal.aborted) setUrl(body?.data?.preview?.url ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUrl(null);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <Box
      sx={{
        width: 72,
        height: 56,
        flexShrink: 0,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "action.hover",
        color: "text.secondary",
        display: "grid",
        placeItems: "center",
      }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={alt}
          loading="lazy"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <ImageNotSupportedRounded aria-label={alt} />
      )}
    </Box>
  );
}

export type BlogListProps = Readonly<{
  canArchive: boolean;
  canCreate: boolean;
  canPublish: boolean;
  canUpdate: boolean;
}>;

export function BlogList({ canArchive, canCreate, canPublish, canUpdate }: BlogListProps) {
  const t = useTranslations("dashboard.blogs");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const raw = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(raw), [raw]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const requestedPageSize = Number(query.get("pageSize"));
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const requestedStatus = query.get("status");
  const status = STATUSES.includes(requestedStatus as BlogStatus) ? requestedStatus! : "";
  const requestedSort = query.get("sort");
  const sort = SORTS.includes(requestedSort as (typeof SORTS)[number]) ? requestedSort! : SORTS[0];
  const search = query.get("search") ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Blog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Blog | null>(null);
  const [confirmAction, setConfirmAction] = useState<Readonly<{
    action: LifecycleAction;
    item: Blog;
  }> | null>(null);
  const [mutating, setMutating] = useState(false);
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: PROJECT_TIME_ZONE,
      }),
    [locale],
  );

  const updateQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(raw);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      setLoading(true);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, raw, router],
  );

  useEffect(() => {
    const value = draft?.trim();
    if (value === undefined || value === search || (value.length > 0 && value.length < 2)) return;
    const timer = window.setTimeout(() => {
      setDraft(null);
      updateQuery({ search: value || null, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, search, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    if (search.length >= 2) params.set("search", search);
    const [sortBy, sortDirection] = sort.split(":");
    params.set("sortBy", sortBy ?? "createdAt");
    params.set("sortDirection", sortDirection ?? "desc");
    fetch(`/api/blogs/manage?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("blog_list_failed");
        return (await response.json()) as ListEnvelope<Blog>;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_blog_list");
        setItems(body.data);
        setPagination(body.meta.pagination);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, reload, search, sort, status]);

  const refresh = () => {
    setLoading(true);
    setError(false);
    setReload((value) => value + 1);
  };

  const statusChip = (item: Blog) => (
    <Chip
      size="small"
      color={STATUS_COLORS[item.status]}
      variant={item.status === "archived" ? "outlined" : "filled"}
      label={t(`statuses.${item.status}`)}
    />
  );

  const publication = (item: Blog) => {
    if (item.status === "scheduled" && item.publishAt) {
      return {
        label: t("scheduledFor"),
        value: dateTime.format(new Date(item.publishAt)),
      };
    }
    if (item.publishedAt) {
      return {
        label: item.status === "archived" ? t("lastPublished") : t("publishedOn"),
        value: dateTime.format(new Date(item.publishedAt)),
      };
    }
    return { label: t("publication"), value: t("notPublished") };
  };

  const actionButtons = (item: Blog) => (
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      <Tooltip title={t("view")}>
        <IconButton
          aria-label={t("viewBlog", { title: localizedTitle(item, locale) })}
          onClick={() => setSelected(item)}
        >
          <VisibilityRounded />
        </IconButton>
      </Tooltip>
      {canUpdate && item.status !== "archived" ? (
        <Tooltip title={t("edit")}>
          <IconButton
            aria-label={t("editBlog", { title: localizedTitle(item, locale) })}
            onClick={() => router.push(`/dashboard/blog/modify?id=${item.id}`)}
          >
            <EditRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {canPublish && (item.status === "draft" || item.status === "scheduled") ? (
        <Tooltip title={t("publish")}>
          <IconButton
            color="success"
            aria-label={t("publishBlog", { title: localizedTitle(item, locale) })}
            onClick={() => setConfirmAction({ action: "publish", item })}
          >
            <PublishRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {canPublish && (item.status === "published" || item.status === "scheduled") ? (
        <Tooltip title={t(item.status === "scheduled" ? "cancelSchedule" : "unpublish")}>
          <IconButton
            aria-label={t(item.status === "scheduled" ? "cancelScheduleBlog" : "unpublishBlog", {
              title: localizedTitle(item, locale),
            })}
            onClick={() => setConfirmAction({ action: "unpublish", item })}
          >
            <UnpublishedRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {canArchive && item.status !== "archived" ? (
        <Tooltip title={t("archive")}>
          <IconButton
            color="error"
            aria-label={t("archiveBlog", { title: localizedTitle(item, locale) })}
            onClick={() => setConfirmAction({ action: "archive", item })}
          >
            <ArchiveRounded />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setMutating(true);
    try {
      const response = await fetch(
        `/api/blogs/manage/${confirmAction.item.id}/${confirmAction.action}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("admin"),
          body: "{}",
        },
      );
      if (!response.ok) throw new Error("blog_action_failed");
      feedback.notify({
        message: t(`actionSuccess.${confirmAction.action}`),
        severity: "success",
      });
      setConfirmAction(null);
      setSelected(null);
      refresh();
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const confirmTitle = confirmAction ? t(`confirm.${confirmAction.action}.title`) : "";
  const confirmDescription = confirmAction
    ? t(`confirm.${confirmAction.action}.description`, {
        title: localizedTitle(confirmAction.item, locale),
      })
    : "";

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2 }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={refresh}>
            {t("refresh")}
          </Button>
          {canCreate ? (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => router.push("/dashboard/blog/modify")}
            >
              {t("add")}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, flexWrap: "wrap" }}>
          <TextField
            label={t("search")}
            value={draft ?? search}
            onChange={(event) => setDraft(event.target.value)}
            size="small"
            sx={{ flex: "1 1 260px" }}
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
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="blog-status-label">{t("status")}</InputLabel>
            <Select
              labelId="blog-status-label"
              label={t("status")}
              value={status}
              onChange={(event) => updateQuery({ status: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allStatuses")}</MenuItem>
              {STATUSES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`statuses.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel id="blog-sort-label">{t("sort")}</InputLabel>
            <Select
              labelId="blog-sort-label"
              label={t("sort")}
              value={sort}
              onChange={(event) => updateQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`sorts.${value.replace(":", "_")}` as "sorts.createdAt_desc")}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {loading ? (
        <Paper aria-label={t("loading")} sx={{ p: 3 }}>
          <Stack spacing={2}>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} height={76} variant="rounded" />
            ))}
          </Stack>
        </Paper>
      ) : error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={<Button onClick={refresh}>{t("retry")}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ArticleRounded fontSize="inherit" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <TableContainer component={Paper} sx={{ display: { xs: "none", lg: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("article")}</TableCell>
                  <TableCell>{t("author")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("publication")}</TableCell>
                  <TableCell>{t("readTime")}</TableCell>
                  <TableCell>{t("viewsHeading")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const publicationValue = publication(item);
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        "& > td:first-of-type": {
                          borderInlineStart: 4,
                          borderInlineStartColor: STATUS_BORDERS[item.status],
                        },
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
                          <BlogImage id={item.imageMediaId} alt={localizedTitle(item, locale)} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700 }}>
                              {localizedTitle(item, locale)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t("translationCount", { count: item.translations.length })} · /
                              {item.slug}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{item.authorSnapshot.displayName}</TableCell>
                      <TableCell>{statusChip(item)}</TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {publicationValue.label}
                        </Typography>
                        <Typography variant="body2">{publicationValue.value}</Typography>
                      </TableCell>
                      <TableCell>{t("minutes", { count: item.readTimeMinutes })}</TableCell>
                      <TableCell>{t("views", { count: item.viewCount })}</TableCell>
                      <TableCell align="right">{actionButtons(item)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack sx={{ display: { xs: "flex", lg: "none" }, gap: 2 }}>
            {items.map((item) => {
              const publicationValue = publication(item);
              return (
                <Paper
                  key={item.id}
                  sx={{
                    p: 2,
                    borderInlineStart: 4,
                    borderInlineStartColor: STATUS_BORDERS[item.status],
                  }}
                >
                  <Stack direction="row" sx={{ gap: 2, alignItems: "flex-start" }}>
                    <BlogImage id={item.imageMediaId} alt={localizedTitle(item, locale)} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {localizedTitle(item, locale)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.authorSnapshot.displayName}
                      </Typography>
                      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", my: 1 }}>
                        {statusChip(item)}
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t("minutes", { count: item.readTimeMinutes })}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {publicationValue.label}: {publicationValue.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("views", { count: item.viewCount })}
                      </Typography>
                    </Box>
                    {actionButtons(item)}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}
          >
            <Typography color="text.secondary" variant="body2">
              {t("results", { count: pagination.totalItems })}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
              <FormControl size="small">
                <InputLabel id="blog-page-size">{t("perPage")}</InputLabel>
                <Select
                  labelId="blog-page-size"
                  label={t("perPage")}
                  value={pageSize}
                  onChange={(event) =>
                    updateQuery({ pageSize: Number(event.target.value), page: 1 })
                  }
                >
                  {PAGE_SIZES.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <AppPagination
                label={t("pagination")}
                page={pagination.page}
                count={pagination.totalPages}
                onChange={(_, value) => updateQuery({ page: value })}
                color="primary"
              />
            </Stack>
          </Stack>
        </>
      )}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selected ? localizedTitle(selected, locale) : ""}</DialogTitle>
        <DialogContent>
          {selected ? (
            <Stack sx={{ gap: 2, pt: 1 }}>
              <Stack direction="row" sx={{ gap: 2, alignItems: "center" }}>
                <BlogImage id={selected.imageMediaId} alt={localizedTitle(selected, locale)} />
                <Box>
                  {statusChip(selected)}
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    /{selected.slug}
                  </Typography>
                </Box>
              </Stack>
              <Divider />
              <Typography>
                {selected.translations.find((value) => value.locale === locale)?.excerpt ??
                  selected.translations.find((value) => value.locale === "en")?.excerpt ??
                  t("noExcerpt")}
              </Typography>
              <Typography variant="body2">
                {t("authorValue", { value: selected.authorSnapshot.displayName })}
              </Typography>
              <Typography variant="body2">
                {publication(selected).label}: {publication(selected).value}
              </Typography>
              <Typography variant="body2">
                {t("minutes", { count: selected.readTimeMinutes })} ·{" "}
                {t("views", { count: selected.viewCount })}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>{t("close")}</Button>
          {selected && canUpdate && selected.status !== "archived" ? (
            <Button
              variant="contained"
              startIcon={<EditRounded />}
              onClick={() => router.push(`/dashboard/blog/modify?id=${selected.id}`)}
            >
              {t("edit")}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={confirmAction !== null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmAction ? t(confirmAction.action) : t("confirmAction")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        danger={confirmAction?.action === "archive"}
        loading={mutating}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          void runConfirmedAction().catch(() => undefined);
        }}
      />
    </Stack>
  );
}
