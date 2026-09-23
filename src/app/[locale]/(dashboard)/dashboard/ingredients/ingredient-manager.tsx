"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArchiveRounded from "@mui/icons-material/ArchiveRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
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
import { MediaPicker } from "@/components/media";
import { AppPagination, EmptyState, ErrorState } from "@/components/ui";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { usePathname, useRouter } from "@/locales/navigation";

type Locale = "en" | "pt-PT" | "fa";
type Status = "draft" | "published" | "archived";
type Allergen =
  | "celery"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "gluten"
  | "lupin"
  | "milk"
  | "molluscs"
  | "mustard"
  | "peanuts"
  | "sesame"
  | "soybeans"
  | "sulphites"
  | "tree_nuts";
type Translation = Readonly<{ locale: Locale; name: string }>;
type Ingredient = Readonly<{
  id: string;
  translations: readonly Translation[];
  imageMediaId: string | null;
  allergenTags: readonly Allergen[];
  status: Status;
  createdAt: string;
  updatedAt: string;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type Envelope = Readonly<{
  data?: readonly Ingredient[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type MediaEnvelope = Readonly<{ data?: Readonly<{ preview?: Readonly<{ url: string }> | null }> }>;
type Capabilities = Readonly<{
  create: boolean;
  update: boolean;
  delete: boolean;
  uploadMedia: boolean;
}>;
type EditorValues = Readonly<{
  names: Readonly<Record<Locale, string>>;
  imageMediaId: string | null;
  allergenTags: readonly Allergen[];
  status: "draft" | "published";
}>;

const LOCALES: readonly Locale[] = ["en", "pt-PT", "fa"];
const ALLERGENS: readonly Allergen[] = [
  "celery",
  "crustaceans",
  "eggs",
  "fish",
  "gluten",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "peanuts",
  "sesame",
  "soybeans",
  "sulphites",
  "tree_nuts",
];
const PAGE_SIZES = [10, 20, 50] as const;
const SORTS = ["name:asc", "name:desc", "createdAt:desc", "createdAt:asc", "status:asc"] as const;
const EMPTY_VALUES: EditorValues = {
  names: { en: "", "pt-PT": "", fa: "" },
  imageMediaId: null,
  allergenTags: [],
  status: "draft",
};

function localizedName(item: Ingredient, locale: string): string {
  return (
    item.translations.find((entry) => entry.locale === locale)?.name ??
    item.translations.find((entry) => entry.locale === "en")?.name ??
    "—"
  );
}

function IngredientImage({ id, alt }: { id: string | null; alt: string }) {
  const [preview, setPreview] = useState<{ id: string; url: string | null } | null>(null);
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
        if (!controller.signal.aborted) {
          setPreview({ id, url: body?.data?.preview?.url ?? null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview({ id, url: null });
      });
    return () => controller.abort();
  }, [id]);
  const url = id && preview?.id === id ? preview.url : null;
  return (
    <Box
      sx={{
        width: 56,
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
          alt={alt}
          src={url}
          loading="lazy"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <ImageNotSupportedRounded aria-label={alt} />
      )}
    </Box>
  );
}

function valuesFor(item: Ingredient | null): EditorValues {
  if (!item) return EMPTY_VALUES;
  const names = { ...EMPTY_VALUES.names };
  for (const translation of item.translations) names[translation.locale] = translation.name;
  return {
    names,
    imageMediaId: item.imageMediaId,
    allergenTags: item.allergenTags,
    status: item.status === "archived" ? "draft" : item.status,
  };
}

export function IngredientManager({ capabilities }: { capabilities: Capabilities }) {
  const t = useTranslations("dashboard.ingredients");
  const locale = useLocale();
  const feedback = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(rawQuery), [rawQuery]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as (typeof PAGE_SIZES)[number])
    ? Number(query.get("pageSize"))
    : 10;
  const status = ["draft", "published", "archived"].includes(query.get("status") ?? "")
    ? (query.get("status") ?? "")
    : "";
  const allergen = ALLERGENS.includes(query.get("allergen") as Allergen)
    ? (query.get("allergen") ?? "")
    : "";
  const sort = SORTS.includes(query.get("sort") as (typeof SORTS)[number])
    ? (query.get("sort") ?? SORTS[0])
    : SORTS[0];
  const search = query.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Ingredient[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const [values, setValues] = useState<EditorValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] = useState<EditorValues>(EMPTY_VALUES);
  const [tab, setTab] = useState<Locale>("en");
  const [attempted, setAttempted] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<Readonly<{
    action: "archive" | "delete";
    item: Ingredient;
  }> | null>(null);
  const draftSearch = searchDraft ?? search;
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      setLoading(true);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, rawQuery, router],
  );

  useEffect(() => {
    const value = draftSearch.trim();
    if (value === search || (value.length > 0 && value.length < 2)) return;
    const timer = window.setTimeout(() => {
      setSearchDraft(null);
      replaceQuery({ search: value || null, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch, replaceQuery, search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set("status", status);
    if (allergen) params.set("allergen", allergen);
    if (search.length >= 2) params.set("search", search);
    const [sortBy, sortDirection] = sort.split(":");
    params.set("sortBy", sortBy ?? "name");
    params.set("sortDirection", sortDirection ?? "asc");
    fetch(`/api/ingredients?${params}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("ingredient_list_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_ingredient_list");
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
  }, [allergen, page, pageSize, reload, search, sort, status]);

  const refresh = () => {
    setLoading(true);
    setError(false);
    setReload((value) => value + 1);
  };
  const openEditor = (item: Ingredient | "new") => {
    const next = valuesFor(item === "new" ? null : item);
    setEditing(item);
    setValues(next);
    setInitialValues(next);
    setAttempted(false);
    setTab("en");
  };
  const closeEditor = () => {
    if (!dirty || window.confirm(t("discardChanges"))) setEditing(null);
  };
  const updateName = (language: Locale, name: string) =>
    setValues((current) => ({ ...current, names: { ...current.names, [language]: name } }));
  const toggleAllergen = (tag: Allergen) =>
    setValues((current) => ({
      ...current,
      allergenTags: current.allergenTags.includes(tag)
        ? current.allergenTags.filter((value) => value !== tag)
        : [...current.allergenTags, tag],
    }));

  const save = async () => {
    setAttempted(true);
    const invalid =
      values.names.en.trim().length < 1 ||
      LOCALES.some((language) => values.names[language].trim().length > 160);
    if (invalid || !editing) return;
    const translations = LOCALES.flatMap((language) =>
      values.names[language].trim()
        ? [{ locale: language, name: values.names[language].trim() }]
        : [],
    );
    setMutating(true);
    try {
      const response = await fetch(
        editing === "new" ? "/api/ingredients" : `/api/ingredients/${editing.id}`,
        {
          method: editing === "new" ? "POST" : "PATCH",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("admin"),
          body: JSON.stringify({
            translations,
            imageMediaId: values.imageMediaId,
            allergenTags: values.allergenTags,
            status: values.status,
          }),
        },
      );
      if (!response.ok) {
        feedback.notify({
          message: response.status === 409 ? t("duplicateError") : t("saveError"),
          severity: "error",
        });
        return;
      }
      setInitialValues(values);
      setEditing(null);
      refresh();
      feedback.notify({
        message: t(editing === "new" ? "createSuccess" : "updateSuccess"),
        severity: "success",
      });
    } catch {
      feedback.notify({ message: t("saveError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setMutating(true);
    try {
      const { item, action } = confirmAction;
      const response = await fetch(
        action === "archive"
          ? `/api/ingredients/${item.id}/archive`
          : `/api/ingredients/${item.id}`,
        {
          method: action === "archive" ? "POST" : "DELETE",
          credentials: "same-origin",
          headers: await csrfJsonHeaders("admin"),
          ...(action === "archive" ? { body: "{}" } : {}),
        },
      );
      if (!response.ok) {
        feedback.notify({
          message:
            response.status === 409
              ? t(action === "delete" ? "deleteConflict" : "archiveConflict")
              : t("actionError"),
          severity: "error",
        });
        return;
      }
      setConfirmAction(null);
      refresh();
      feedback.notify({
        message: t(action === "archive" ? "archiveSuccess" : "deleteSuccess"),
        severity: "success",
      });
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const statusChip = (item: Ingredient) => (
    <Chip
      size="small"
      variant="outlined"
      color={
        item.status === "published" ? "success" : item.status === "archived" ? "default" : "warning"
      }
      label={t(`statuses.${item.status}`)}
    />
  );
  const allergens = (item: Ingredient) =>
    item.allergenTags.length ? (
      <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
        {item.allergenTags.map((tag) => (
          <Chip key={tag} size="small" label={t(`allergens.${tag}`)} />
        ))}
      </Stack>
    ) : (
      <Typography variant="body2" color="text.secondary">
        {t("none")}
      </Typography>
    );
  const actions = (item: Ingredient) => (
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      {capabilities.update && item.status !== "archived" ? (
        <Tooltip title={t("edit")}>
          <IconButton
            aria-label={t("editIngredient", { name: localizedName(item, locale) })}
            onClick={() => openEditor(item)}
          >
            <EditRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {capabilities.update && item.status !== "archived" ? (
        <Tooltip title={t("archive")}>
          <IconButton
            aria-label={t("archiveIngredient", { name: localizedName(item, locale) })}
            onClick={() => setConfirmAction({ action: "archive", item })}
          >
            <ArchiveRounded />
          </IconButton>
        </Tooltip>
      ) : null}
      {capabilities.delete && item.status === "archived" ? (
        <Tooltip title={t("delete")}>
          <IconButton
            color="error"
            aria-label={t("deleteIngredient", { name: localizedName(item, locale) })}
            onClick={() => setConfirmAction({ action: "delete", item })}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
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
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={refresh}>
            {t("refresh")}
          </Button>
          {capabilities.create ? (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => openEditor("new")}
            >
              {t("add")}
            </Button>
          ) : null}
        </Stack>
      </Stack>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: "column", lg: "row" }} sx={{ gap: 2 }}>
          <TextField
            label={t("search")}
            value={searchDraft ?? search}
            onChange={(event) => setSearchDraft(event.target.value)}
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="ingredient-status-filter">{t("status")}</InputLabel>
            <Select
              labelId="ingredient-status-filter"
              label={t("status")}
              value={status}
              onChange={(event) => replaceQuery({ status: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allStatuses")}</MenuItem>
              <MenuItem value="draft">{t("statuses.draft")}</MenuItem>
              <MenuItem value="published">{t("statuses.published")}</MenuItem>
              <MenuItem value="archived">{t("statuses.archived")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="ingredient-allergen-filter">{t("allergen")}</InputLabel>
            <Select
              labelId="ingredient-allergen-filter"
              label={t("allergen")}
              value={allergen}
              onChange={(event) => replaceQuery({ allergen: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allAllergens")}</MenuItem>
              {ALLERGENS.map((tag) => (
                <MenuItem key={tag} value={tag}>
                  {t(`allergens.${tag}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="ingredient-sort">{t("sort")}</InputLabel>
            <Select
              labelId="ingredient-sort"
              label={t("sort")}
              value={sort}
              onChange={(event) => replaceQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`sorts.${value.replace(":", "_")}` as "sorts.name_asc")}
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
          action={<Button onClick={refresh}>{t("retry")}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<LocalDiningRounded fontSize="inherit" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            capabilities.create ? (
              <Button variant="contained" onClick={() => openEditor("new")}>
                {t("add")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableContainer component={Paper} sx={{ display: { xs: "none", md: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("ingredient")}</TableCell>
                  <TableCell>{t("allergen")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
                        <IngredientImage id={item.imageMediaId} alt={localizedName(item, locale)} />
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {localizedName(item, locale)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.translations.length}/{LOCALES.length} {t("translations")}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{allergens(item)}</TableCell>
                    <TableCell>{statusChip(item)}</TableCell>
                    <TableCell align="right">{actions(item)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ display: { xs: "flex", md: "none" }, gap: 2 }}>
            {items.map((item) => (
              <Paper key={item.id} sx={{ p: 2 }}>
                <Stack direction="row" sx={{ gap: 2, alignItems: "flex-start" }}>
                  <IngredientImage id={item.imageMediaId} alt={localizedName(item, locale)} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{localizedName(item, locale)}</Typography>
                    <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap" }}>
                      {statusChip(item)}
                      {allergens(item)}
                    </Stack>
                  </Box>
                  {actions(item)}
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("results", { count: pagination.totalItems })}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
              <FormControl size="small">
                <InputLabel id="ingredient-page-size">{t("perPage")}</InputLabel>
                <Select
                  labelId="ingredient-page-size"
                  label={t("perPage")}
                  value={pageSize}
                  onChange={(event) =>
                    replaceQuery({ pageSize: Number(event.target.value), page: 1 })
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
                onChange={(_, value) => replaceQuery({ page: value })}
                color="primary"
              />
            </Stack>
          </Stack>
        </>
      )}
      <Dialog open={editing !== null} onClose={closeEditor} fullWidth maxWidth="md">
        <DialogTitle>{editing === "new" ? t("createTitle") : t("editTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Tabs
              value={tab}
              onChange={(_, value: Locale) => setTab(value)}
              aria-label={t("translationTabs")}
              variant="scrollable"
              scrollButtons="auto"
            >
              {LOCALES.map((language) => (
                <Tab key={language} value={language} label={t(`locales.${language}`)} />
              ))}
            </Tabs>
            <TextField
              autoFocus
              label={t("name")}
              value={values.names[tab]}
              onChange={(event) => updateName(tab, event.target.value)}
              required={tab === "en"}
              error={attempted && tab === "en" && !values.names.en.trim()}
              helperText={tab === "en" ? t("englishRequired") : t("translationOptional")}
              slotProps={{ htmlInput: { maxLength: 160, dir: tab === "fa" ? "rtl" : "ltr" } }}
            />
            <MediaPicker
              label={t("image")}
              allowedKinds={["image"]}
              canUpload={capabilities.uploadMedia}
              value={values.imageMediaId}
              onChange={(imageMediaId) => setValues((current) => ({ ...current, imageMediaId }))}
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t("allergensLabel")}
              </Typography>
              <FormGroup row>
                {ALLERGENS.map((tag) => (
                  <FormControlLabel
                    key={tag}
                    control={
                      <Checkbox
                        size="small"
                        checked={values.allergenTags.includes(tag)}
                        onChange={() => toggleAllergen(tag)}
                      />
                    }
                    label={t(`allergens.${tag}`)}
                  />
                ))}
              </FormGroup>
            </Box>
            <FormControl>
              <InputLabel id="ingredient-editor-status">{t("status")}</InputLabel>
              <Select
                labelId="ingredient-editor-status"
                label={t("status")}
                value={values.status}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    status: event.target.value as EditorValues["status"],
                  }))
                }
              >
                <MenuItem value="draft">{t("statuses.draft")}</MenuItem>
                <MenuItem value="published">{t("statuses.published")}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={mutating} onClick={closeEditor}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={mutating}
            onClick={() => {
              void save().catch(() => undefined);
            }}
          >
            {mutating ? t("saving") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={confirmAction !== null}
        title={t(confirmAction?.action === "delete" ? "deleteTitle" : "archiveTitle")}
        description={t(
          confirmAction?.action === "delete" ? "deleteDescription" : "archiveDescription",
          { name: confirmAction ? localizedName(confirmAction.item, locale) : "" },
        )}
        confirmLabel={t(confirmAction?.action === "delete" ? "delete" : "archive")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        danger={confirmAction?.action === "delete"}
        loading={mutating}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          void runConfirmedAction().catch(() => undefined);
        }}
      />
    </Stack>
  );
}
