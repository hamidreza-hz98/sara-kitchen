"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArchiveRounded from "@mui/icons-material/ArchiveRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import RestoreRounded from "@mui/icons-material/RestoreRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StarRounded from "@mui/icons-material/StarRounded";
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
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { usePathname, useRouter } from "@/locales/navigation";

type Locale = "en" | "pt-PT" | "fa";
type Status = "draft" | "published" | "archived";
type Availability = "available" | "unavailable" | "scheduled";
type Translation = Readonly<{ locale: Locale; name: string; excerpt?: string }>;
type Dish = Readonly<{
  id: string;
  translations: readonly Translation[];
  slug: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  basePriceCents: number;
  discount: Readonly<{
    type: "none" | "fixed" | "percentage";
    amountCents: number | null;
    basisPoints: number | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  availability: Readonly<{
    mode: Availability;
    availableFrom: string | null;
    availableUntil: string | null;
  }>;
  leadTimeMinutes: number;
  isFeatured: boolean;
  featuredOrder: number;
  soldCount: number;
  viewCount: number;
  status: Status;
}>;
type Category = Readonly<{
  id: string;
  translations: readonly Readonly<{ locale: Locale; name: string }>[];
  slug: string;
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

const PAGE_SIZES = [10, 20, 50] as const;
const STATUSES = ["draft", "published", "archived"] as const;
const AVAILABILITIES = ["available", "unavailable", "scheduled"] as const;
const SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "name:asc",
  "name:desc",
  "basePriceCents:asc",
  "basePriceCents:desc",
  "soldCount:desc",
  "viewCount:desc",
  "featuredOrder:asc",
  "status:asc",
] as const;

function localizedName(item: Dish | Category, locale: string): string {
  return (
    item.translations.find((value) => value.locale === locale)?.name ??
    item.translations.find((value) => value.locale === "en")?.name ??
    item.translations[0]?.name ??
    item.slug
  );
}

function effectivePrice(item: Dish, now = Date.now()): number {
  const starts = item.discount.startsAt ? Date.parse(item.discount.startsAt) : null;
  const ends = item.discount.endsAt ? Date.parse(item.discount.endsAt) : null;
  if (
    item.discount.type === "none" ||
    (starts !== null && now < starts) ||
    (ends !== null && now >= ends)
  ) {
    return item.basePriceCents;
  }
  if (item.discount.type === "fixed") {
    return Math.max(0, item.basePriceCents - (item.discount.amountCents ?? 0));
  }
  return Math.max(
    0,
    item.basePriceCents -
      Math.floor((item.basePriceCents * (item.discount.basisPoints ?? 0) + 5_000) / 10_000),
  );
}

function DishImage({ id, alt }: { id: string | undefined; alt: string }) {
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
        width: 64,
        height: 64,
        flexShrink: 0,
        borderRadius: 2.5,
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

export type DishListProps = Readonly<{
  canCreate: boolean;
  canReadCategories: boolean;
  canRestore: boolean;
  canUpdate: boolean;
}>;

export function DishList({ canCreate, canReadCategories, canRestore, canUpdate }: DishListProps) {
  const t = useTranslations("dashboard.dishes");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const raw = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(raw), [raw]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as (typeof PAGE_SIZES)[number])
    ? Number(query.get("pageSize"))
    : 10;
  const status = STATUSES.includes(query.get("status") as Status) ? query.get("status")! : "";
  const availability = AVAILABILITIES.includes(query.get("availability") as Availability)
    ? query.get("availability")!
    : "";
  const featured = ["true", "false"].includes(query.get("featured") ?? "")
    ? query.get("featured")!
    : "";
  const categoryId = /^[a-f\d]{24}$/iu.test(query.get("category") ?? "")
    ? query.get("category")!
    : "";
  const sort = SORTS.includes(query.get("sort") as (typeof SORTS)[number])
    ? query.get("sort")!
    : SORTS[0];
  const search = query.get("search") ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Dish[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Dish | null>(null);
  const [confirmAction, setConfirmAction] = useState<Readonly<{
    action: "archive" | "restore";
    item: Dish;
  }> | null>(null);
  const [mutating, setMutating] = useState(false);
  const currency = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }),
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
    if (!canReadCategories) return;
    const controller = new AbortController();
    fetch("/api/categories?page=1&pageSize=100&sortBy=sortOrder&sortDirection=asc", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) =>
        response.ok ? ((await response.json()) as ListEnvelope<Category>) : null,
      )
      .then((body) => {
        if (!controller.signal.aborted && Array.isArray(body?.data)) setCategories(body.data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [canReadCategories, reload]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    if (availability) params.set("availability", availability);
    if (featured) params.set("featured", featured);
    if (categoryId) params.set("categoryId", categoryId);
    if (search.length >= 2) params.set("search", search);
    const [sortBy, sortDirection] = sort.split(":");
    params.set("sortBy", sortBy ?? "createdAt");
    params.set("sortDirection", sortDirection ?? "desc");
    fetch(`/api/dishes/manage?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("dish_list_failed");
        return (await response.json()) as ListEnvelope<Dish>;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_dish_list");
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
  }, [availability, categoryId, featured, page, pageSize, reload, search, sort, status]);

  const refresh = () => {
    setLoading(true);
    setError(false);
    setReload((value) => value + 1);
  };
  const categoryName = (id: string) => {
    const found = categories.find((category) => category.id === id);
    return found ? localizedName(found, locale) : t("unknownCategory");
  };
  const statusChip = (item: Dish) => (
    <Chip
      size="small"
      variant="outlined"
      color={
        item.status === "published" ? "success" : item.status === "archived" ? "default" : "warning"
      }
      label={t(`statuses.${item.status}`)}
    />
  );
  const availabilityChip = (item: Dish) => (
    <Chip
      size="small"
      color={
        item.availability.mode === "available"
          ? "success"
          : item.availability.mode === "unavailable"
            ? "error"
            : "info"
      }
      label={t(`availabilityValues.${item.availability.mode}`)}
    />
  );
  const price = (item: Dish) => {
    const current = effectivePrice(item);
    const discounted = current !== item.basePriceCents;
    return (
      <Stack spacing={0}>
        <Typography sx={{ fontWeight: 700 }}>{currency.format(current / 100)}</Typography>
        {discounted ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textDecoration: "line-through" }}
          >
            {currency.format(item.basePriceCents / 100)}
          </Typography>
        ) : null}
      </Stack>
    );
  };
  const actionButtons = (item: Dish) => (
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      <Tooltip title={t("view")}>
        <IconButton
          aria-label={t("viewDish", { name: localizedName(item, locale) })}
          onClick={() => setSelected(item)}
        >
          <VisibilityRounded />
        </IconButton>
      </Tooltip>
      {canUpdate ? (
        <Tooltip title={t("edit")}>
          <IconButton
            aria-label={t("editDish", { name: localizedName(item, locale) })}
            onClick={() => router.push(`/dashboard/dishes/modify?id=${item.id}`)}
          >
            <EditRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {item.status !== "archived" && canUpdate ? (
        <Tooltip title={t("archive")}>
          <IconButton
            aria-label={t("archiveDish", { name: localizedName(item, locale) })}
            onClick={() => setConfirmAction({ action: "archive", item })}
          >
            <ArchiveRounded />
          </IconButton>
        </Tooltip>
      ) : item.status === "archived" && canRestore ? (
        <Tooltip title={t("restore")}>
          <IconButton
            aria-label={t("restoreDish", { name: localizedName(item, locale) })}
            onClick={() => setConfirmAction({ action: "restore", item })}
          >
            <RestoreRounded />
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
        `/api/dishes/manage/${confirmAction.item.id}/${confirmAction.action}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("admin"),
          body: "{}",
        },
      );
      if (!response.ok) {
        feedback.notify({ message: t("actionError"), severity: "error" });
        return;
      }
      feedback.notify({
        message: t(confirmAction.action === "archive" ? "archiveSuccess" : "restoreSuccess"),
        severity: "success",
      });
      setConfirmAction(null);
      refresh();
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

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
              onClick={() => router.push("/dashboard/dishes/modify")}
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
            sx={{ flex: "1 1 240px" }}
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
          <FormControl size="small" sx={{ minWidth: 145 }}>
            <InputLabel id="dish-status-label">{t("status")}</InputLabel>
            <Select
              labelId="dish-status-label"
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
          <FormControl size="small" sx={{ minWidth: 155 }}>
            <InputLabel id="dish-availability-label">{t("availability")}</InputLabel>
            <Select
              labelId="dish-availability-label"
              label={t("availability")}
              value={availability}
              onChange={(event) =>
                updateQuery({ availability: event.target.value || null, page: 1 })
              }
            >
              <MenuItem value="">{t("allAvailability")}</MenuItem>
              {AVAILABILITIES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`availabilityValues.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 145 }}>
            <InputLabel id="dish-featured-label">{t("featured")}</InputLabel>
            <Select
              labelId="dish-featured-label"
              label={t("featured")}
              value={featured}
              onChange={(event) => updateQuery({ featured: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allFeatured")}</MenuItem>
              <MenuItem value="true">{t("featuredOnly")}</MenuItem>
              <MenuItem value="false">{t("notFeatured")}</MenuItem>
            </Select>
          </FormControl>
          {canReadCategories ? (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="dish-category-label">{t("category")}</InputLabel>
              <Select
                labelId="dish-category-label"
                label={t("category")}
                value={categoryId}
                onChange={(event) => updateQuery({ category: event.target.value || null, page: 1 })}
              >
                <MenuItem value="">{t("allCategories")}</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {localizedName(category, locale)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="dish-sort-label">{t("sort")}</InputLabel>
            <Select
              labelId="dish-sort-label"
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
          icon={<LocalDiningRounded fontSize="inherit" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <TableContainer component={Paper} sx={{ display: { xs: "none", lg: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("dish")}</TableCell>
                  <TableCell>{t("category")}</TableCell>
                  <TableCell>{t("price")}</TableCell>
                  <TableCell>{t("availability")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("metrics")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
                        <DishImage id={item.mediaIds[0]} alt={localizedName(item, locale)} />
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                            <Typography sx={{ fontWeight: 700 }}>
                              {localizedName(item, locale)}
                            </Typography>
                            {item.isFeatured ? (
                              <Tooltip title={t("featured")}>
                                <StarRounded color="warning" fontSize="small" />
                              </Tooltip>
                            ) : null}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {t("translationCount", { count: item.translations.length })} · /
                            {item.slug}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                        {item.categoryIds.slice(0, 2).map((id) => (
                          <Chip key={id} size="small" variant="outlined" label={categoryName(id)} />
                        ))}
                        {item.categoryIds.length > 2 ? (
                          <Chip size="small" label={`+${item.categoryIds.length - 2}`} />
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>{price(item)}</TableCell>
                    <TableCell>{availabilityChip(item)}</TableCell>
                    <TableCell>{statusChip(item)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {t("sold", { count: item.soldCount })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("views", { count: item.viewCount })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{actionButtons(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", lg: "none" }, gap: 2 }}>
            {items.map((item) => (
              <Paper key={item.id} sx={{ p: 2 }}>
                <Stack direction="row" sx={{ gap: 2, alignItems: "flex-start" }}>
                  <DishImage id={item.mediaIds[0]} alt={localizedName(item, locale)} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {localizedName(item, locale)}
                      </Typography>
                      {item.isFeatured ? <StarRounded color="warning" fontSize="small" /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {item.categoryIds.map(categoryName).join(", ") || t("uncategorized")}
                    </Typography>
                    <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", my: 1 }}>
                      {statusChip(item)}
                      {availabilityChip(item)}
                    </Stack>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "end" }}
                    >
                      {price(item)}
                      <Typography variant="caption" color="text.secondary">
                        {t("sold", { count: item.soldCount })} ·{" "}
                        {t("views", { count: item.viewCount })}
                      </Typography>
                    </Stack>
                  </Box>
                  {actionButtons(item)}
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
                <InputLabel id="dish-page-size">{t("perPage")}</InputLabel>
                <Select
                  labelId="dish-page-size"
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
        <DialogTitle>{selected ? localizedName(selected, locale) : ""}</DialogTitle>
        <DialogContent>
          {selected ? (
            <Stack sx={{ gap: 2, pt: 1 }}>
              <Stack direction="row" sx={{ gap: 2 }}>
                <DishImage id={selected.mediaIds[0]} alt={localizedName(selected, locale)} />
                <Box>
                  {price(selected)}
                  <Typography variant="body2" color="text.secondary">
                    /{selected.slug}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" sx={{ gap: 1 }}>
                {statusChip(selected)}
                {availabilityChip(selected)}
                {selected.isFeatured ? (
                  <Chip color="warning" icon={<StarRounded />} label={t("featured")} />
                ) : null}
              </Stack>
              <Divider />
              <Typography>
                {selected.translations.find((value) => value.locale === locale)?.excerpt ??
                  selected.translations.find((value) => value.locale === "en")?.excerpt ??
                  t("noExcerpt")}
              </Typography>
              <Typography variant="body2">
                {t("categoriesValue", {
                  value: selected.categoryIds.map(categoryName).join(", ") || t("uncategorized"),
                })}
              </Typography>
              <Typography variant="body2">
                {t("leadTime", { minutes: selected.leadTimeMinutes })}
              </Typography>
              <Typography variant="body2">
                {t("sold", { count: selected.soldCount })} ·{" "}
                {t("views", { count: selected.viewCount })}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>{t("close")}</Button>
          {selected && canUpdate ? (
            <Button
              variant="contained"
              startIcon={<EditRounded />}
              onClick={() => router.push(`/dashboard/dishes/modify?id=${selected.id}`)}
            >
              {t("edit")}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={confirmAction !== null}
        title={t(confirmAction?.action === "restore" ? "restoreTitle" : "archiveTitle")}
        description={t(
          confirmAction?.action === "restore" ? "restoreDescription" : "archiveDescription",
          { name: confirmAction ? localizedName(confirmAction.item, locale) : "" },
        )}
        confirmLabel={t(confirmAction?.action === "restore" ? "restore" : "archive")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        loading={mutating}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          void runConfirmedAction().catch(() => undefined);
        }}
      />
    </Stack>
  );
}
