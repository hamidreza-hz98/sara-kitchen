"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import CategoryRounded from "@mui/icons-material/CategoryRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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

import { AppPagination, EmptyState, ErrorState } from "@/components/ui";
import { usePathname, useRouter } from "@/locales/navigation";

type Translation = Readonly<{ locale: string; name: string; description: string }>;
type Category = Readonly<{
  id: string;
  translations: readonly Translation[];
  slug: string;
  status: "draft" | "published" | "archived";
  imageMediaId: string | null;
  sortOrder: number;
  dishCount?: number;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type CategoryResponse = Readonly<{
  data?: readonly Category[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type MediaResponse = Readonly<{ data?: Readonly<{ preview?: Readonly<{ url: string }> | null }> }>;

const PAGE_SIZES = [10, 20, 50] as const;
const SORTS = [
  "sortOrder:asc",
  "sortOrder:desc",
  "createdAt:desc",
  "createdAt:asc",
  "slug:asc",
  "slug:desc",
  "status:asc",
] as const;

function CategoryImage({ id, alt }: { id: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/media/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? ((await response.json()) as MediaResponse) : null))
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
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "action.hover",
        display: "grid",
        placeItems: "center",
        color: "text.secondary",
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

export function CategoryList({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("dashboard.categories");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(raw), [raw]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as (typeof PAGE_SIZES)[number])
    ? Number(query.get("pageSize"))
    : 10;
  const status = ["draft", "published", "archived"].includes(query.get("status") ?? "")
    ? (query.get("status") ?? "")
    : "";
  const sort = SORTS.includes(query.get("sort") as (typeof SORTS)[number])
    ? (query.get("sort") ?? SORTS[0])
    : SORTS[0];
  const search = query.get("search") ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Category | null>(null);

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
    params.set("sortBy", sortBy ?? "sortOrder");
    params.set("sortDirection", sortDirection ?? "asc");
    fetch(`/api/categories?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("categories_list_failed");
        return (await response.json()) as CategoryResponse;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_category_list");
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
  }, [page, pageSize, refreshKey, search, sort, status]);

  const translation = (item: Category) =>
    item.translations.find((value) => value.locale === locale) ??
    item.translations.find((value) => value.locale === "en") ??
    item.translations[0];
  const statusChip = (item: Category) => (
    <Chip
      size="small"
      variant="outlined"
      color={
        item.status === "published" ? "success" : item.status === "archived" ? "default" : "warning"
      }
      label={t(`statuses.${item.status}`)}
    />
  );
  const viewButton = (item: Category) => (
    <Tooltip title={t("view")}>
      <IconButton
        aria-label={t("viewCategory", { name: translation(item)?.name ?? item.slug })}
        onClick={() => setSelected(item)}
      >
        <VisibilityRounded />
      </IconButton>
    </Tooltip>
  );

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
          <Button
            variant="outlined"
            startIcon={<RefreshRounded />}
            onClick={() => {
              setLoading(true);
              setRefreshKey((value) => value + 1);
            }}
          >
            {t("refresh")}
          </Button>
          {canCreate ? (
            <Tooltip title={t("createPending")}>
              <span>
                <Button variant="contained" startIcon={<AddRounded />} disabled>
                  {t("add")}
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </Stack>
      </Stack>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
          <TextField
            label={t("search")}
            value={draft ?? search}
            onChange={(event) => setDraft(event.target.value)}
            size="small"
            sx={{ flex: 1 }}
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
            <InputLabel id="category-status-label">{t("status")}</InputLabel>
            <Select
              labelId="category-status-label"
              label={t("status")}
              value={status}
              onChange={(event) => updateQuery({ status: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allStatuses")}</MenuItem>
              <MenuItem value="draft">{t("statuses.draft")}</MenuItem>
              <MenuItem value="published">{t("statuses.published")}</MenuItem>
              <MenuItem value="archived">{t("statuses.archived")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 185 }}>
            <InputLabel id="category-sort-label">{t("sort")}</InputLabel>
            <Select
              labelId="category-sort-label"
              label={t("sort")}
              value={sort}
              onChange={(event) => updateQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`sorts.${value.replace(":", "_")}` as "sorts.sortOrder_asc")}
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
              <Skeleton key={index} height={64} variant="rounded" />
            ))}
          </Stack>
        </Paper>
      ) : error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Button
              onClick={() => {
                setLoading(true);
                setRefreshKey((value) => value + 1);
              }}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CategoryRounded fontSize="inherit" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <TableContainer component={Paper} sx={{ display: { xs: "none", md: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("category")}</TableCell>
                  <TableCell>{t("slug")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("dishCount")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
                        <CategoryImage
                          id={item.imageMediaId}
                          alt={translation(item)?.name ?? item.slug}
                        />
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {translation(item)?.name ?? item.slug}
                          </Typography>
                          <Typography
                            color="text.secondary"
                            variant="body2"
                            sx={{
                              maxWidth: 340,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {translation(item)?.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ direction: "ltr", unicodeBidi: "plaintext" }}
                      >
                        {item.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>{statusChip(item)}</TableCell>
                    <TableCell>
                      <Tooltip title={item.dishCount === undefined ? t("dishCountPending") : ""}>
                        <span>{item.dishCount ?? "—"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">{viewButton(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", md: "none" }, gap: 2 }}>
            {items.map((item) => (
              <Paper key={item.id} sx={{ p: 2 }}>
                <Stack direction="row" sx={{ gap: 2, alignItems: "flex-start" }}>
                  <CategoryImage
                    id={item.imageMediaId}
                    alt={translation(item)?.name ?? item.slug}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {translation(item)?.name ?? item.slug}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {item.slug}
                    </Typography>
                    <Stack direction="row" sx={{ gap: 1, alignItems: "center", mt: 1 }}>
                      {statusChip(item)}
                      <Typography variant="caption" color="text.secondary">
                        {t("dishCount")}: {item.dishCount ?? "—"}
                      </Typography>
                    </Stack>
                  </Box>
                  {viewButton(item)}
                </Stack>
              </Paper>
            ))}
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
                <InputLabel id="category-page-size">{t("perPage")}</InputLabel>
                <Select
                  labelId="category-page-size"
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
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selected ? (translation(selected)?.name ?? selected.slug) : ""}</DialogTitle>
        <DialogContent>
          <Stack sx={{ pt: 1, gap: 2 }}>
            {selected ? (
              <>
                <CategoryImage
                  id={selected.imageMediaId}
                  alt={translation(selected)?.name ?? selected.slug}
                />
                <Typography>{translation(selected)?.description}</Typography>
                <Typography variant="body2" color="text.secondary">
                  /{selected.slug}
                </Typography>
                {statusChip(selected)}
                <Typography variant="body2" color="text.secondary">
                  {t("mutationsPending")}
                </Typography>
              </>
            ) : (
              <CircularProgress />
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
