"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MediaPicker } from "@/components/media";
import { ErrorState } from "@/components/ui";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { useRouter } from "@/locales/navigation";
import {
  DISH_FORM_ALLERGEN_TAGS,
  DISH_FORM_DIETARY_TAGS,
  DISH_FORM_INGREDIENT_UNITS,
  DISH_FORM_PORTION_UNITS,
  sharedDishCreateSchema,
} from "@/validations/dish-mutation";

import { DishRichEditor, type RichDocument } from "./dish-rich-editor";

type Language = "en" | "pt-PT" | "fa";
type Option = Readonly<{
  id: string;
  slug?: string;
  translations: readonly Readonly<{ locale: Language; name: string }>[];
}>;
type Specification = Readonly<{ label: string; value: string }>;
type LocalFields = Readonly<{
  name: string;
  excerpt: string;
  description: RichDocument | null;
  specifications: readonly Specification[];
}>;
type IngredientRow = Readonly<{
  ingredientId: string;
  quantityAmount: string;
  quantityUnit: (typeof DISH_FORM_INGREDIENT_UNITS)[number] | "";
  note: string;
}>;
type FormValues = Readonly<{
  translations: Readonly<Record<Language, LocalFields>>;
  slugOverride: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredients: readonly IngredientRow[];
  basePrice: string;
  discountType: "none" | "fixed" | "percentage";
  discountValue: string;
  discountStartsAt: string;
  discountEndsAt: string;
  portionAmount: string;
  portionUnit: (typeof DISH_FORM_PORTION_UNITS)[number];
  leadTimeMinutes: string;
  maxQuantityPerOrder: string;
  availabilityMode: "available" | "unavailable" | "scheduled";
  availableFrom: string;
  availableUntil: string;
  isFeatured: boolean;
  featuredOrder: string;
  dietaryTags: readonly (typeof DISH_FORM_DIETARY_TAGS)[number][];
  allergenTags: readonly (typeof DISH_FORM_ALLERGEN_TAGS)[number][];
  relatedDishIds: readonly string[];
  status: "draft" | "published";
}>;
type DishDetail = Readonly<{
  id: string;
  translations: readonly Readonly<{
    locale: Language;
    name: string;
    excerpt?: string;
    description?: RichDocument | null;
    specifications: readonly Specification[];
  }>[];
  slug: string;
  mediaIds: readonly string[];
  categoryIds: readonly string[];
  ingredients: readonly Readonly<{
    ingredientId: string;
    quantityAmount: number | null;
    quantityUnit: IngredientRow["quantityUnit"] | null;
    notes: readonly Readonly<{ locale: Language; note: string }>[];
  }>[];
  basePriceCents: number;
  discount: Readonly<{
    type: FormValues["discountType"];
    amountCents: number | null;
    basisPoints: number | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  portionAmount: number;
  portionUnit: FormValues["portionUnit"];
  availability: Readonly<{
    mode: FormValues["availabilityMode"];
    availableFrom: string | null;
    availableUntil: string | null;
  }>;
  leadTimeMinutes: number;
  maxQuantityPerOrder: number;
  mayContainAllergenTags: FormValues["allergenTags"];
  dietaryTags: FormValues["dietaryTags"];
  isFeatured: boolean;
  featuredOrder: number;
  relatedDishIds: readonly string[];
  status: "draft" | "published" | "archived";
}>;
type Envelope<T> = Readonly<{ data?: T }>;
type ListEnvelope<T> = Readonly<{ data?: readonly T[] }>;

const LANGUAGES: readonly Language[] = ["en", "pt-PT", "fa"];
const EMPTY_LOCAL: LocalFields = {
  name: "",
  excerpt: "",
  description: null,
  specifications: [],
};
const EMPTY: FormValues = {
  translations: { en: EMPTY_LOCAL, "pt-PT": EMPTY_LOCAL, fa: EMPTY_LOCAL },
  slugOverride: "",
  mediaIds: [],
  categoryIds: [],
  ingredients: [],
  basePrice: "",
  discountType: "none",
  discountValue: "",
  discountStartsAt: "",
  discountEndsAt: "",
  portionAmount: "1",
  portionUnit: "serving",
  leadTimeMinutes: "0",
  maxQuantityPerOrder: "10",
  availabilityMode: "available",
  availableFrom: "",
  availableUntil: "",
  isFeatured: false,
  featuredOrder: "0",
  dietaryTags: [],
  allergenTags: [],
  relatedDishIds: [],
  status: "draft",
};

function dateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function instant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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

function localName(option: Option): string {
  return (
    option.translations.find((value) => value.locale === "en")?.name ?? option.slug ?? option.id
  );
}

function fromDetail(item: DishDetail): FormValues {
  const translations = { ...EMPTY.translations };
  for (const entry of item.translations) {
    translations[entry.locale] = {
      name: entry.name,
      excerpt: entry.excerpt ?? "",
      description: entry.description ?? null,
      specifications: entry.specifications,
    };
  }
  const discountValue =
    item.discount.type === "fixed"
      ? String((item.discount.amountCents ?? 0) / 100)
      : item.discount.type === "percentage"
        ? String((item.discount.basisPoints ?? 0) / 100)
        : "";
  return {
    translations,
    slugOverride: "",
    mediaIds: item.mediaIds,
    categoryIds: item.categoryIds,
    ingredients: item.ingredients.map((ingredient) => ({
      ingredientId: ingredient.ingredientId,
      quantityAmount: ingredient.quantityAmount === null ? "" : String(ingredient.quantityAmount),
      quantityUnit: ingredient.quantityUnit ?? "",
      note: ingredient.notes.find((note) => note.locale === "en")?.note ?? "",
    })),
    basePrice: String(item.basePriceCents / 100),
    discountType: item.discount.type,
    discountValue,
    discountStartsAt: dateTimeLocal(item.discount.startsAt),
    discountEndsAt: dateTimeLocal(item.discount.endsAt),
    portionAmount: String(item.portionAmount),
    portionUnit: item.portionUnit,
    leadTimeMinutes: String(item.leadTimeMinutes),
    maxQuantityPerOrder: String(item.maxQuantityPerOrder),
    availabilityMode: item.availability.mode,
    availableFrom: dateTimeLocal(item.availability.availableFrom),
    availableUntil: dateTimeLocal(item.availability.availableUntil),
    isFeatured: item.isFeatured,
    featuredOrder: String(item.featuredOrder),
    dietaryTags: item.dietaryTags,
    allergenTags: item.mayContainAllergenTags,
    relatedDishIds: item.relatedDishIds,
    status: item.status === "archived" ? "draft" : item.status,
  };
}

export function DishEditor({
  canCreate,
  canUpdate,
  canUploadMedia,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canUploadMedia: boolean;
}) {
  const t = useTranslations("dashboard.dishEditor");
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const editing = id !== null;
  const validId = id === null || /^[a-f\d]{24}$/iu.test(id);
  const permitted = editing ? canUpdate : canCreate;
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [initial, setInitial] = useState<FormValues>(EMPTY);
  const [originalSlug, setOriginalSlug] = useState("");
  const [tab, setTab] = useState<Language>("en");
  const [categories, setCategories] = useState<readonly Option[]>([]);
  const [ingredientOptions, setIngredientOptions] = useState<readonly Option[]>([]);
  const [dishOptions, setDishOptions] = useState<readonly Option[]>([]);
  const [ingredientToAdd, setIngredientToAdd] = useState("");
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState("");
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );
  const slug = values.slugOverride.trim()
    ? previewSlug(values.slugOverride)
    : editing
      ? originalSlug
      : previewSlug(values.translations.en.name);
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
    const controller = new AbortController();
    const list = async <T,>(url: string): Promise<readonly T[]> => {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("reference_load_failed");
      return ((await response.json()) as ListEnvelope<T>).data ?? [];
    };
    void Promise.all([
      list<Option>("/api/categories?page=1&pageSize=100&sortBy=sortOrder&sortDirection=asc"),
      list<Option>("/api/ingredients?page=1&pageSize=100&sortBy=name&sortDirection=asc"),
      list<Option>("/api/dishes/manage?page=1&pageSize=100&sortBy=name&sortDirection=asc"),
    ])
      .then(([nextCategories, nextIngredients, nextDishes]) => {
        if (controller.signal.aborted) return;
        setCategories(nextCategories);
        setIngredientOptions(nextIngredients);
        setDishOptions(nextDishes.filter((dish) => dish.id !== id));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id || !validId) return;
    const controller = new AbortController();
    fetch(`/api/dishes/manage/${id}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("dish_load_failed");
        return (await response.json()) as Envelope<DishDetail>;
      })
      .then((body) => {
        if (!body.data) throw new Error("dish_missing");
        const next = fromDetail(body.data);
        setValues(next);
        setInitial(next);
        setOriginalSlug(body.data.slug);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, validId]);

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
      ) {
        return;
      }
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
    if (!dirty || window.confirm(t("leaveWarning"))) router.push("/dashboard/dishes");
  };
  const addIngredient = () => {
    if (!ingredientToAdd || values.ingredients.some((row) => row.ingredientId === ingredientToAdd))
      return;
    update({
      ingredients: [
        ...values.ingredients,
        { ingredientId: ingredientToAdd, quantityAmount: "", quantityUnit: "", note: "" },
      ],
    });
    setIngredientToAdd("");
  };
  const updateIngredient = (index: number, patch: Partial<IngredientRow>) =>
    update({
      ingredients: values.ingredients.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    });
  const moveMedia = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= values.mediaIds.length) return;
    const next = [...values.mediaIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    update({ mediaIds: next });
  };

  const buildPayload = (status: FormValues["status"] = values.status) => {
    const translations = LANGUAGES.flatMap((language) => {
      const entry = values.translations[language];
      if (
        !entry.name.trim() &&
        !entry.excerpt.trim() &&
        !entry.description &&
        entry.specifications.length === 0
      )
        return [];
      return [
        {
          locale: language,
          name: entry.name.trim(),
          ...(entry.excerpt.trim() ? { excerpt: entry.excerpt.trim() } : {}),
          description: entry.description,
          specifications: entry.specifications.map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
          })),
        },
      ];
    });
    const basePriceCents = Math.round(Number(values.basePrice) * 100);
    const discountNumber = Number(values.discountValue);
    return {
      translations,
      ...(values.slugOverride.trim() ? { slugOverride: values.slugOverride.trim() } : {}),
      mediaIds: values.mediaIds,
      categoryIds: values.categoryIds,
      ingredients: values.ingredients.map((row) => ({
        ingredientId: row.ingredientId,
        notes: row.note.trim() ? [{ locale: "en" as const, note: row.note.trim() }] : [],
        quantityAmount: row.quantityAmount ? Number(row.quantityAmount) : null,
        quantityUnit: row.quantityAmount ? row.quantityUnit || null : null,
      })),
      basePriceCents,
      discount: {
        type: values.discountType,
        amountCents: values.discountType === "fixed" ? Math.round(discountNumber * 100) : null,
        basisPoints: values.discountType === "percentage" ? Math.round(discountNumber * 100) : null,
        startsAt: instant(values.discountStartsAt),
        endsAt: instant(values.discountEndsAt),
      },
      portionAmount: Number(values.portionAmount),
      portionUnit: values.portionUnit,
      availability: {
        mode: values.availabilityMode,
        availableFrom:
          values.availabilityMode === "scheduled" ? instant(values.availableFrom) : null,
        availableUntil:
          values.availabilityMode === "scheduled" ? instant(values.availableUntil) : null,
      },
      leadTimeMinutes: Number(values.leadTimeMinutes),
      maxQuantityPerOrder: Number(values.maxQuantityPerOrder),
      mayContainAllergenTags: values.allergenTags,
      dietaryTags: values.dietaryTags,
      isFeatured: values.isFeatured,
      featuredOrder: Number(values.featuredOrder),
      relatedDishIds: values.relatedDishIds,
      relatedBlogIds: [],
      status,
    };
  };

  const save = async (statusOverride?: FormValues["status"]) => {
    setAttempted(true);
    setServerError("");
    const status = statusOverride ?? values.status;
    const payload = buildPayload(status);
    const parsed = sharedDishCreateSchema.safeParse(payload);
    const invalidSlug =
      Boolean(values.slugOverride) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride);
    const incompletePublished =
      status === "published" &&
      (LANGUAGES.some((language) => !values.translations[language].name.trim()) ||
        values.mediaIds.length === 0 ||
        values.categoryIds.length === 0 ||
        values.ingredients.length === 0);
    const invalidSchedule =
      values.availabilityMode === "scheduled" && !values.availableFrom && !values.availableUntil;
    if (!parsed.success || invalidSlug || incompletePublished || invalidSchedule || !slug) {
      setServerError(incompletePublished ? t("publishRequirements") : t("validationError"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/dishes/manage/${id}` : "/api/dishes", {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: await csrfJsonHeaders("admin"),
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setServerError(response.status === 409 ? t("conflict") : t("saveError"));
        return;
      }
      const savedValues = statusOverride ? { ...values, status: statusOverride } : values;
      setValues(savedValues);
      setInitial(savedValues);
      router.push("/dashboard/dishes");
      router.refresh();
    } catch {
      setServerError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!validId)
    return (
      <ErrorState
        title={t("invalidId")}
        description={t("invalidIdHelp")}
        action={<Button onClick={() => router.push("/dashboard/dishes")}>{t("back")}</Button>}
      />
    );
  if (!permitted)
    return (
      <ErrorState
        title={t("denied")}
        description={t("deniedHelp")}
        action={<Button onClick={() => router.push("/dashboard/dishes")}>{t("back")}</Button>}
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
  const fieldError = attempted && !values.translations.en.name.trim();
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Button startIcon={<ArrowBackRounded />} onClick={leave}>
            {t("back")}
          </Button>
          <Typography component="h1" variant="h4">
            {editing ? t("editTitle") : t("createTitle")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            disabled={saving}
            onClick={() => {
              void save("draft").catch(() => undefined);
            }}
          >
            {t("saveDraft")}
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveRounded />}
            disabled={saving}
            onClick={() => {
              void save().catch(() => undefined);
            }}
          >
            {saving ? t("saving") : t("save")}
          </Button>
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
            <Tab key={language} value={language} label={t(`language.${language}`)} />
          ))}
        </Tabs>
        <Stack spacing={2} sx={{ mt: 3 }}>
          <TextField
            label={t("name")}
            value={current.name}
            required={tab === "en"}
            error={fieldError && tab === "en"}
            onChange={(event) => updateTranslation(tab, { name: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 160 } }}
          />
          <TextField
            label={t("excerpt")}
            value={current.excerpt}
            multiline
            minRows={2}
            onChange={(event) => updateTranslation(tab, { excerpt: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={`${current.excerpt.length}/500`}
          />
          <Box>
            <Typography
              component="label"
              id={`dish-description-${tab}`}
              sx={{ display: "block", mb: 1, fontWeight: 700 }}
            >
              {t("richDescription")}
            </Typography>
            <DishRichEditor
              value={current.description}
              onChange={(description) => updateTranslation(tab, { description })}
              labelledBy={`dish-description-${tab}`}
              labels={{
                bold: t("bold"),
                italic: t("italic"),
                bulletList: t("bulletList"),
                numberedList: t("numberedList"),
              }}
            />
          </Box>
          <Box>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
            >
              <Typography sx={{ fontWeight: 700 }}>{t("specifications")}</Typography>
              <Button
                size="small"
                startIcon={<AddRounded />}
                onClick={() =>
                  updateTranslation(tab, {
                    specifications: [...current.specifications, { label: "", value: "" }],
                  })
                }
              >
                {t("addSpecification")}
              </Button>
            </Stack>
            <Stack spacing={1}>
              {current.specifications.map((specification, index) => (
                <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t("specificationLabel")}
                    value={specification.label}
                    onChange={(event) =>
                      updateTranslation(tab, {
                        specifications: current.specifications.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t("specificationValue")}
                    value={specification.value}
                    onChange={(event) =>
                      updateTranslation(tab, {
                        specifications: current.specifications.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      })
                    }
                  />
                  <IconButton
                    aria-label={t("removeSpecification")}
                    onClick={() =>
                      updateTranslation(tab, {
                        specifications: current.specifications.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
        <Stack spacing={3} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("catalog")}
            </Typography>
            <Stack spacing={2}>
              <TextField
                label={t("slugOverride")}
                value={values.slugOverride}
                onChange={(event) => update({ slugOverride: event.target.value })}
                error={
                  attempted &&
                  Boolean(values.slugOverride) &&
                  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(values.slugOverride)
                }
                helperText={`${t("slugPreview")}: /menu/${slug || "…"}`}
                slotProps={{ htmlInput: { dir: "ltr" } }}
              />
              <FormControl>
                <InputLabel id="dish-categories">{t("categories")}</InputLabel>
                <Select
                  multiple
                  labelId="dish-categories"
                  label={t("categories")}
                  value={values.categoryIds}
                  onChange={(event) =>
                    update({
                      categoryIds:
                        typeof event.target.value === "string"
                          ? event.target.value.split(",")
                          : event.target.value,
                    })
                  }
                  renderValue={(selected) =>
                    selected
                      .map((selectedId) =>
                        localName(
                          categories.find((option) => option.id === selectedId) ?? {
                            id: selectedId,
                            translations: [],
                          },
                        ),
                      )
                      .join(", ")
                  }
                >
                  {categories.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      <Checkbox checked={values.categoryIds.includes(option.id)} />
                      <ListItemText primary={localName(option)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t("basePrice")}
                  value={values.basePrice}
                  onChange={(event) => update({ basePrice: event.target.value })}
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label={t("waitingTime")}
                  value={values.leadTimeMinutes}
                  onChange={(event) => update({ leadTimeMinutes: event.target.value })}
                  slotProps={{ htmlInput: { min: 0, max: 10080, step: 1 } }}
                />
                <TextField
                  fullWidth
                  type="number"
                  label={t("maxQuantity")}
                  value={values.maxQuantityPerOrder}
                  onChange={(event) => update({ maxQuantityPerOrder: event.target.value })}
                  slotProps={{ htmlInput: { min: 1, max: 99, step: 1 } }}
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  type="number"
                  label={t("portionAmount")}
                  value={values.portionAmount}
                  onChange={(event) => update({ portionAmount: event.target.value })}
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
                <FormControl fullWidth>
                  <InputLabel id="portion-unit">{t("portionUnit")}</InputLabel>
                  <Select
                    labelId="portion-unit"
                    label={t("portionUnit")}
                    value={values.portionUnit}
                    onChange={(event) =>
                      update({ portionUnit: event.target.value as FormValues["portionUnit"] })
                    }
                  >
                    {DISH_FORM_PORTION_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {t(`units.${unit}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("ingredients")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl fullWidth>
                <InputLabel id="ingredient-add">{t("addIngredient")}</InputLabel>
                <Select
                  labelId="ingredient-add"
                  label={t("addIngredient")}
                  value={ingredientToAdd}
                  onChange={(event) => setIngredientToAdd(event.target.value)}
                >
                  {ingredientOptions
                    .filter(
                      (option) => !values.ingredients.some((row) => row.ingredientId === option.id),
                    )
                    .map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {localName(option)}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<AddRounded />}
                disabled={!ingredientToAdd}
                onClick={addIngredient}
              >
                {t("add")}
              </Button>
            </Stack>
            <Stack spacing={2} sx={{ mt: 2 }}>
              {values.ingredients.map((row, index) => (
                <Paper variant="outlined" key={row.ingredientId} sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>
                        {localName(
                          ingredientOptions.find((option) => option.id === row.ingredientId) ?? {
                            id: row.ingredientId,
                            translations: [],
                          },
                        )}
                      </Typography>
                      <IconButton
                        aria-label={t("removeIngredient")}
                        onClick={() =>
                          update({
                            ingredients: values.ingredients.filter(
                              (_, rowIndex) => rowIndex !== index,
                            ),
                          })
                        }
                      >
                        <DeleteOutlineRounded />
                      </IconButton>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        type="number"
                        label={t("quantity")}
                        value={row.quantityAmount}
                        onChange={(event) =>
                          updateIngredient(index, { quantityAmount: event.target.value })
                        }
                        slotProps={{ htmlInput: { min: 0, step: "any" } }}
                      />
                      <FormControl sx={{ minWidth: 170 }}>
                        <InputLabel id={`ingredient-unit-${index}`}>{t("unit")}</InputLabel>
                        <Select
                          labelId={`ingredient-unit-${index}`}
                          label={t("unit")}
                          value={row.quantityUnit}
                          onChange={(event) =>
                            updateIngredient(index, {
                              quantityUnit: event.target.value as IngredientRow["quantityUnit"],
                            })
                          }
                        >
                          <MenuItem value="">—</MenuItem>
                          {DISH_FORM_INGREDIENT_UNITS.map((unit) => (
                            <MenuItem key={unit} value={unit}>
                              {t(`ingredientUnits.${unit}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        fullWidth
                        label={t("ingredientNote")}
                        value={row.note}
                        onChange={(event) => updateIngredient(index, { note: event.target.value })}
                        slotProps={{ htmlInput: { maxLength: 240 } }}
                      />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("relations")}
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="related-dishes">{t("relatedDishes")}</InputLabel>
              <Select
                multiple
                labelId="related-dishes"
                label={t("relatedDishes")}
                value={values.relatedDishIds}
                onChange={(event) =>
                  update({
                    relatedDishIds:
                      typeof event.target.value === "string"
                        ? event.target.value.split(",")
                        : event.target.value,
                  })
                }
                renderValue={(selected) =>
                  selected
                    .map((selectedId) =>
                      localName(
                        dishOptions.find((option) => option.id === selectedId) ?? {
                          id: selectedId,
                          translations: [],
                        },
                      ),
                    )
                    .join(", ")
                }
              >
                {dishOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    <Checkbox checked={values.relatedDishIds.includes(option.id)} />
                    <ListItemText primary={localName(option)} />
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{t("blogRelationsPending")}</FormHelperText>
            </FormControl>
          </Paper>
        </Stack>

        <Stack spacing={3} sx={{ width: { xs: "100%", lg: 360 }, flexShrink: 0 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("media")}
            </Typography>
            <MediaPicker
              multiple
              maxItems={30}
              canUpload={canUploadMedia}
              allowedKinds={["image", "video"]}
              label={t("gallery")}
              value={values.mediaIds}
              onChange={(mediaIds) => update({ mediaIds })}
            />
            <Stack spacing={1} sx={{ mt: 2 }}>
              {values.mediaIds.map((mediaId, index) => (
                <Stack key={mediaId} direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                  <Chip
                    label={
                      index === 0
                        ? t("primaryMedia", { id: mediaId.slice(-6) })
                        : t("mediaItem", { index: index + 1, id: mediaId.slice(-6) })
                    }
                    sx={{ flex: 1, justifyContent: "flex-start" }}
                  />
                  <Tooltip title={t("moveUp")}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={index === 0}
                        onClick={() => moveMedia(index, -1)}
                      >
                        <ArrowUpwardRounded fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t("moveDown")}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={index === values.mediaIds.length - 1}
                        onClick={() => moveMedia(index, 1)}
                      >
                        <ArrowDownwardRounded fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("pricing")}
            </Typography>
            <Stack spacing={2}>
              <FormControl>
                <InputLabel id="discount-type">{t("discountType")}</InputLabel>
                <Select
                  labelId="discount-type"
                  label={t("discountType")}
                  value={values.discountType}
                  onChange={(event) =>
                    update({
                      discountType: event.target.value as FormValues["discountType"],
                      discountValue: "",
                      ...(event.target.value === "none"
                        ? { discountStartsAt: "", discountEndsAt: "" }
                        : {}),
                    })
                  }
                >
                  <MenuItem value="none">{t("discounts.none")}</MenuItem>
                  <MenuItem value="fixed">{t("discounts.fixed")}</MenuItem>
                  <MenuItem value="percentage">{t("discounts.percentage")}</MenuItem>
                </Select>
              </FormControl>
              {values.discountType !== "none" ? (
                <TextField
                  type="number"
                  label={
                    values.discountType === "fixed" ? t("discountAmount") : t("discountPercentage")
                  }
                  value={values.discountValue}
                  onChange={(event) => update({ discountValue: event.target.value })}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      max: values.discountType === "percentage" ? 99.99 : undefined,
                      step: 0.01,
                    },
                  }}
                />
              ) : null}
              <TextField
                type="datetime-local"
                label={t("discountStarts")}
                value={values.discountStartsAt}
                onChange={(event) => update({ discountStartsAt: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="datetime-local"
                label={t("discountEnds")}
                value={values.discountEndsAt}
                onChange={(event) => update({ discountEndsAt: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("publishing")}
            </Typography>
            <Stack spacing={2}>
              <FormControl>
                <InputLabel id="dish-status">{t("status")}</InputLabel>
                <Select
                  labelId="dish-status"
                  label={t("status")}
                  value={values.status}
                  onChange={(event) =>
                    update({ status: event.target.value as FormValues["status"] })
                  }
                >
                  <MenuItem value="draft">{t("statuses.draft")}</MenuItem>
                  <MenuItem value="published">{t("statuses.published")}</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={values.isFeatured}
                    onChange={(event) => update({ isFeatured: event.target.checked })}
                  />
                }
                label={t("featured")}
              />
              {values.isFeatured ? (
                <TextField
                  type="number"
                  label={t("featuredOrder")}
                  value={values.featuredOrder}
                  onChange={(event) => update({ featuredOrder: event.target.value })}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              ) : null}
              <FormControl>
                <InputLabel id="availability-mode">{t("availability")}</InputLabel>
                <Select
                  labelId="availability-mode"
                  label={t("availability")}
                  value={values.availabilityMode}
                  onChange={(event) =>
                    update({
                      availabilityMode: event.target.value as FormValues["availabilityMode"],
                      availableFrom: "",
                      availableUntil: "",
                    })
                  }
                >
                  <MenuItem value="available">{t("availabilityValues.available")}</MenuItem>
                  <MenuItem value="unavailable">{t("availabilityValues.unavailable")}</MenuItem>
                  <MenuItem value="scheduled">{t("availabilityValues.scheduled")}</MenuItem>
                </Select>
              </FormControl>
              {values.availabilityMode === "scheduled" ? (
                <>
                  <TextField
                    type="datetime-local"
                    label={t("availableFrom")}
                    value={values.availableFrom}
                    onChange={(event) => update({ availableFrom: event.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    type="datetime-local"
                    label={t("availableUntil")}
                    value={values.availableUntil}
                    onChange={(event) => update({ availableUntil: event.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              ) : null}
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("dietary")}
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="dietary-tags">{t("dietaryTags")}</InputLabel>
              <Select
                multiple
                labelId="dietary-tags"
                label={t("dietaryTags")}
                value={values.dietaryTags}
                onChange={(event) =>
                  update({
                    dietaryTags: (typeof event.target.value === "string"
                      ? event.target.value.split(",")
                      : event.target.value) as FormValues["dietaryTags"],
                  })
                }
              >
                {DISH_FORM_DIETARY_TAGS.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    <Checkbox checked={values.dietaryTags.includes(tag)} />
                    <ListItemText primary={t(`dietaryValues.${tag}`)} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="allergen-tags">{t("allergenTags")}</InputLabel>
              <Select
                multiple
                labelId="allergen-tags"
                label={t("allergenTags")}
                value={values.allergenTags}
                onChange={(event) =>
                  update({
                    allergenTags: (typeof event.target.value === "string"
                      ? event.target.value.split(",")
                      : event.target.value) as FormValues["allergenTags"],
                  })
                }
              >
                {DISH_FORM_ALLERGEN_TAGS.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    <Checkbox checked={values.allergenTags.includes(tag)} />
                    <ListItemText primary={t(`allergens.${tag}`)} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Stack>
      </Stack>
    </Stack>
  );
}
