"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import Autocomplete from "@mui/material/Autocomplete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { MediaPicker } from "@/components/media";
import type {
  HomepageSettingsData,
  HomepageSettingsTranslationValue,
} from "@/server/modules/settings";

type Locale = "en" | "pt-PT" | "fa";
type RecordValue = Record<string, unknown>;
type ApiList<T> = Readonly<{ data?: readonly T[] }>;
type EntityTranslation = Readonly<{ locale: Locale; name?: string; title?: string }>;
type SelectableEntity = Readonly<{
  id: string;
  slug: string;
  translations: readonly EntityTranslation[];
}>;
type DishOption = SelectableEntity & Readonly<{ basePriceCents?: number }>;
type EntityOptions = Readonly<{
  dishes: readonly DishOption[];
  categories: readonly SelectableEntity[];
  blogs: readonly SelectableEntity[];
}>;

function object(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function labelFor(item: SelectableEntity, locale: string): string {
  return (
    item.translations.find((translation) => translation.locale === locale)?.name ??
    item.translations.find((translation) => translation.locale === locale)?.title ??
    item.translations.find((translation) => translation.locale === "en")?.name ??
    item.translations.find((translation) => translation.locale === "en")?.title ??
    item.translations[0]?.name ??
    item.translations[0]?.title ??
    item.slug
  );
}

function stableId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function blankTranslation(): HomepageSettingsTranslationValue {
  return {
    heroSlides: [],
    linkedBanners: [],
    benefits: [],
    testimonials: [],
    categoryBanners: [],
    sectionTitles: {
      featured: "",
      benefits: "",
      testimonials: "",
      categories: "",
      discounted: "",
      blog: "",
    },
  };
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description ? (
              <Typography color="text.secondary" variant="body2">
                {description}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

function ReorderActions({
  index,
  length,
  disabled,
  onMove,
  onRemove,
  removeLabel,
  upLabel,
  downLabel,
}: {
  index: number;
  length: number;
  disabled: boolean;
  onMove: (offset: number) => void;
  onRemove: () => void;
  removeLabel: string;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <Stack direction="row" spacing={0.25}>
      <IconButton
        aria-label={upLabel}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
        size="small"
      >
        <ArrowUpwardRounded fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={downLabel}
        disabled={disabled || index === length - 1}
        onClick={() => onMove(1)}
        size="small"
      >
        <ArrowDownwardRounded fontSize="small" />
      </IconButton>
      <IconButton
        aria-label={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        size="small"
        color="error"
      >
        <DeleteOutlineRounded fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function Selection<T extends SelectableEntity>({
  label,
  unavailableLabel,
  options,
  ids,
  locale,
  disabled,
  loading,
  limit,
  onChange,
}: {
  label: string;
  unavailableLabel: string;
  options: readonly T[];
  ids: readonly string[];
  locale: string;
  disabled: boolean;
  loading: boolean;
  limit: number;
  onChange: (ids: string[]) => void;
}) {
  const selected = ids.map(
    (id) =>
      options.find((item) => item.id === id) ?? {
        id,
        slug: unavailableLabel,
        translations: [],
      },
  );
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      value={selected}
      loading={loading}
      disabled={disabled}
      getOptionLabel={(item) => labelFor(item, locale)}
      isOptionEqualToValue={(item, value) => item.id === value.id}
      getOptionDisabled={(item) => ids.length >= limit && !ids.includes(item.id)}
      onChange={(_, value) => onChange(value.map((item) => item.id))}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}

export function HomepageSettingsEditor({
  data,
  locale,
  canEdit,
  canUploadMedia,
  onDataChange,
}: {
  data: HomepageSettingsData;
  locale: Locale;
  canEdit: boolean;
  canUploadMedia: boolean;
  onDataChange: (value: HomepageSettingsData) => void;
}) {
  const t = useTranslations("dashboard.settingsEditor.homepage");
  const uiLocale = useLocale();
  const [options, setOptions] = useState<EntityOptions>({ dishes: [], categories: [], blogs: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState(false);
  const [categoryToAdd, setCategoryToAdd] = useState("");
  const direction = uiLocale === "fa" ? "rtl" : "ltr";

  useEffect(() => {
    const controller = new AbortController();
    const fetchList = async <T,>(url: string): Promise<readonly T[]> => {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("list_unavailable");
      const body = (await response.json()) as ApiList<T>;
      return Array.isArray(body.data) ? body.data : [];
    };

    Promise.allSettled([
      fetchList<DishOption>(
        "/api/dishes/manage?page=1&pageSize=100&status=published&sortBy=name&sortDirection=asc",
      ),
      fetchList<SelectableEntity>(
        "/api/categories?page=1&pageSize=100&status=published&sortBy=sortOrder&sortDirection=asc",
      ),
      fetchList<SelectableEntity>(
        "/api/blogs/manage?page=1&pageSize=100&status=published&sortBy=title&sortDirection=asc",
      ),
    ])
      .then((results) => {
        if (controller.signal.aborted) return;
        const [dishes, categories, blogs] = results;
        setOptions({
          dishes: dishes.status === "fulfilled" ? dishes.value : [],
          categories: categories.status === "fulfilled" ? categories.value : [],
          blogs: blogs.status === "fulfilled" ? blogs.value : [],
        });
        setOptionsError(results.some((result) => result.status === "rejected"));
        setLoadingOptions(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOptionsError(true);
        setLoadingOptions(false);
      });
    return () => controller.abort();
  }, []);

  const update = (patch: Partial<HomepageSettingsData>) => onDataChange({ ...data, ...patch });
  const move = <T,>(items: readonly T[], index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= items.length) return [...items];
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  };
  return (
    <Stack spacing={2.5} dir={direction}>
      {loadingOptions ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CircularProgress size={18} />
          <Typography color="text.secondary">{t("loadingOptions")}</Typography>
        </Stack>
      ) : null}
      {optionsError ? <Alert severity="warning">{t("optionsWarning")}</Alert> : null}

      <Section
        title={t("heroSlides")}
        description={t("heroSlidesHelp")}
        action={
          <Button
            startIcon={<AddRounded />}
            disabled={!canEdit || data.heroSlides.length >= 8}
            onClick={() =>
              update({
                heroSlides: [
                  ...data.heroSlides,
                  {
                    id: stableId("hero"),
                    imageMediaId: "",
                    mobileImageMediaId: null,
                    href: "/menu",
                    openInNewTab: false,
                    enabled: true,
                  } as HomepageSettingsData["heroSlides"][number],
                ],
              })
            }
            variant="outlined"
          >
            {t("addHeroSlide")}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          {data.heroSlides.length === 0 ? (
            <Alert severity="info">{t("emptyHeroSlides")}</Alert>
          ) : null}
          {data.heroSlides.map((slide, index) => (
            <Card key={slide.id} variant="outlined">
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                  >
                    <Chip size="small" label={t("heroSlideNumber", { number: index + 1 })} />
                    <ReorderActions
                      index={index}
                      length={data.heroSlides.length}
                      disabled={!canEdit}
                      onMove={(offset) =>
                        update({ heroSlides: move(data.heroSlides, index, offset) })
                      }
                      onRemove={() =>
                        update({
                          heroSlides: data.heroSlides.filter((_, position) => position !== index),
                        })
                      }
                      removeLabel={t("remove")}
                      upLabel={t("moveUp")}
                      downLabel={t("moveDown")}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("desktopImage")}
                      value={slide.imageMediaId || null}
                      onChange={(imageMediaId) =>
                        update({
                          heroSlides: data.heroSlides.map((item, position) =>
                            position === index
                              ? { ...item, imageMediaId: imageMediaId ?? "" }
                              : item,
                          ),
                        })
                      }
                    />
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("mobileImage")}
                      value={slide.mobileImageMediaId}
                      onChange={(mobileImageMediaId) =>
                        update({
                          heroSlides: data.heroSlides.map((item, position) =>
                            position === index ? { ...item, mobileImageMediaId } : item,
                          ),
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label={t("destination")}
                      value={slide.href ?? ""}
                      disabled={!canEdit}
                      slotProps={{ htmlInput: { dir: "ltr" } }}
                      onChange={(event) =>
                        update({
                          heroSlides: data.heroSlides.map((item, position) =>
                            position === index
                              ? { ...item, href: event.target.value || null }
                              : item,
                          ),
                        })
                      }
                    />
                    <Stack
                      direction="row"
                      sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={slide.openInNewTab}
                            disabled={!canEdit}
                            onChange={(event) =>
                              update({
                                heroSlides: data.heroSlides.map((item, position) =>
                                  position === index
                                    ? { ...item, openInNewTab: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                        }
                        label={t("openInNewTab")}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={slide.enabled}
                            disabled={!canEdit}
                            onChange={(event) =>
                              update({
                                heroSlides: data.heroSlides.map((item, position) =>
                                  position === index
                                    ? { ...item, enabled: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                        }
                        label={t("visible")}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Section>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <Section
          title={t("linkedBanners")}
          description={t("linkedBannersHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              disabled={!canEdit || data.linkedBanners.length >= 8}
              onClick={() =>
                update({
                  linkedBanners: [
                    ...data.linkedBanners,
                    {
                      id: stableId("banner"),
                      imageMediaId: "",
                      href: "/menu",
                      openInNewTab: false,
                      enabled: true,
                    } as HomepageSettingsData["linkedBanners"][number],
                  ],
                })
              }
              variant="outlined"
            >
              {t("addBanner")}
            </Button>
          }
        >
          <Stack spacing={1.5}>
            {data.linkedBanners.length === 0 ? (
              <Alert severity="info">{t("emptyBanners")}</Alert>
            ) : null}
            {data.linkedBanners.map((banner, index) => (
              <Card key={banner.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: "center", justifyContent: "space-between" }}
                    >
                      <Chip size="small" label={t("bannerNumber", { number: index + 1 })} />
                      <ReorderActions
                        index={index}
                        length={data.linkedBanners.length}
                        disabled={!canEdit}
                        onMove={(offset) =>
                          update({ linkedBanners: move(data.linkedBanners, index, offset) })
                        }
                        onRemove={() =>
                          update({
                            linkedBanners: data.linkedBanners.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                        removeLabel={t("remove")}
                        upLabel={t("moveUp")}
                        downLabel={t("moveDown")}
                      />
                    </Stack>
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("bannerImage")}
                      value={banner.imageMediaId || null}
                      onChange={(imageMediaId) =>
                        update({
                          linkedBanners: data.linkedBanners.map((item, position) =>
                            position === index
                              ? { ...item, imageMediaId: imageMediaId ?? "" }
                              : item,
                          ),
                        })
                      }
                    />
                    <TextField
                      fullWidth
                      label={t("destination")}
                      value={banner.href}
                      disabled={!canEdit}
                      slotProps={{ htmlInput: { dir: "ltr" } }}
                      onChange={(event) =>
                        update({
                          linkedBanners: data.linkedBanners.map((item, position) =>
                            position === index ? { ...item, href: event.target.value } : item,
                          ),
                        })
                      }
                    />
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={banner.openInNewTab}
                            disabled={!canEdit}
                            onChange={(event) =>
                              update({
                                linkedBanners: data.linkedBanners.map((item, position) =>
                                  position === index
                                    ? { ...item, openInNewTab: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                        }
                        label={t("openInNewTab")}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={banner.enabled}
                            disabled={!canEdit}
                            onChange={(event) =>
                              update({
                                linkedBanners: data.linkedBanners.map((item, position) =>
                                  position === index
                                    ? { ...item, enabled: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                        }
                        label={t("visible")}
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Section>

        <Section title={t("featuredDishes")} description={t("featuredDishesHelp")}>
          <Selection
            label={t("selectDishes")}
            unavailableLabel={t("unavailableItem")}
            options={options.dishes}
            ids={data.featuredDishIds}
            locale={locale}
            disabled={!canEdit}
            loading={loadingOptions}
            limit={6}
            onChange={(featuredDishIds) => update({ featuredDishIds })}
          />
          <Typography variant="caption" color="text.secondary">
            {t("selectionCount", { count: data.featuredDishIds.length, limit: 6 })}
          </Typography>
        </Section>

        <Section title={t("categoryShowcase")} description={t("categoryShowcaseHelp")}>
          <FormControl
            fullWidth
            disabled={!canEdit || loadingOptions || data.categoryBanners.length >= 12}
          >
            <InputLabel id="homepage-category-add">{t("addCategory")}</InputLabel>
            <Select
              id="homepage-category-add"
              labelId="homepage-category-add"
              label={t("addCategory")}
              value={categoryToAdd}
              onChange={(event) => {
                const categoryId = event.target.value;
                setCategoryToAdd("");
                if (
                  !categoryId ||
                  data.categoryBanners.some((item) => item.categoryId === categoryId)
                )
                  return;
                update({
                  categoryBanners: [
                    ...data.categoryBanners,
                    { categoryId, imageMediaId: null, enabled: true },
                  ],
                });
              }}
            >
              {options.categories
                .filter(
                  (item) => !data.categoryBanners.some((banner) => banner.categoryId === item.id),
                )
                .map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {labelFor(category, locale)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <Stack spacing={1}>
            {data.categoryBanners.map((banner, index) => (
              <Card key={banner.categoryId} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {labelFor(
                          options.categories.find((item) => item.id === banner.categoryId) ?? {
                            id: banner.categoryId,
                            slug: t("unavailableItem"),
                            translations: [],
                          },
                          locale,
                        )}
                      </Typography>
                      <ReorderActions
                        index={index}
                        length={data.categoryBanners.length}
                        disabled={!canEdit}
                        onMove={(offset) =>
                          update({ categoryBanners: move(data.categoryBanners, index, offset) })
                        }
                        onRemove={() =>
                          update({
                            categoryBanners: data.categoryBanners.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                        removeLabel={t("remove")}
                        upLabel={t("moveUp")}
                        downLabel={t("moveDown")}
                      />
                    </Stack>
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("categoryImage")}
                      value={banner.imageMediaId}
                      onChange={(imageMediaId) =>
                        update({
                          categoryBanners: data.categoryBanners.map((item, position) =>
                            position === index ? { ...item, imageMediaId } : item,
                          ),
                        })
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={banner.enabled}
                          disabled={!canEdit}
                          onChange={(event) =>
                            update({
                              categoryBanners: data.categoryBanners.map((item, position) =>
                                position === index
                                  ? { ...item, enabled: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />
                      }
                      label={t("visible")}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Section>

        <Section
          title={t("benefits")}
          description={t("benefitsHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              disabled={!canEdit || data.benefits.length >= 12}
              onClick={() =>
                update({
                  benefits: [
                    ...data.benefits,
                    { id: stableId("benefit"), iconMediaId: null, enabled: true },
                  ],
                })
              }
              variant="outlined"
            >
              {t("addBenefit")}
            </Button>
          }
        >
          <Stack spacing={1}>
            {data.benefits.map((benefit, index) => (
              <Card key={benefit.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                    >
                      <Chip size="small" label={t("benefitNumber", { number: index + 1 })} />
                      <ReorderActions
                        index={index}
                        length={data.benefits.length}
                        disabled={!canEdit}
                        onMove={(offset) =>
                          update({ benefits: move(data.benefits, index, offset) })
                        }
                        onRemove={() =>
                          update({
                            benefits: data.benefits.filter((_, position) => position !== index),
                          })
                        }
                        removeLabel={t("remove")}
                        upLabel={t("moveUp")}
                        downLabel={t("moveDown")}
                      />
                    </Stack>
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("benefitIcon")}
                      value={benefit.iconMediaId}
                      onChange={(iconMediaId) =>
                        update({
                          benefits: data.benefits.map((item, position) =>
                            position === index ? { ...item, iconMediaId } : item,
                          ),
                        })
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={benefit.enabled}
                          disabled={!canEdit}
                          onChange={(event) =>
                            update({
                              benefits: data.benefits.map((item, position) =>
                                position === index
                                  ? { ...item, enabled: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />
                      }
                      label={t("visible")}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Section>

        <Section
          title={t("testimonials")}
          description={t("testimonialsHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              disabled={!canEdit || data.testimonials.length >= 12}
              onClick={() =>
                update({
                  testimonials: [
                    ...data.testimonials,
                    { id: stableId("guest"), avatarMediaId: null, rating: 5, enabled: true },
                  ],
                })
              }
              variant="outlined"
            >
              {t("addTestimonial")}
            </Button>
          }
        >
          <Stack spacing={1}>
            {data.testimonials.map((item, index) => (
              <Card key={item.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
                    >
                      <Chip size="small" label={t("testimonialNumber", { number: index + 1 })} />
                      <ReorderActions
                        index={index}
                        length={data.testimonials.length}
                        disabled={!canEdit}
                        onMove={(offset) =>
                          update({ testimonials: move(data.testimonials, index, offset) })
                        }
                        onRemove={() =>
                          update({
                            testimonials: data.testimonials.filter(
                              (_, position) => position !== index,
                            ),
                          })
                        }
                        removeLabel={t("remove")}
                        upLabel={t("moveUp")}
                        downLabel={t("moveDown")}
                      />
                    </Stack>
                    <MediaPicker
                      allowedKinds={["image"]}
                      canUpload={canUploadMedia}
                      disabled={!canEdit}
                      label={t("guestPhoto")}
                      value={item.avatarMediaId}
                      onChange={(avatarMediaId) =>
                        update({
                          testimonials: data.testimonials.map((entry, position) =>
                            position === index ? { ...entry, avatarMediaId } : entry,
                          ),
                        })
                      }
                    />
                    <FormControl fullWidth disabled={!canEdit}>
                      <InputLabel id={`testimonial-rating-${item.id}`}>{t("rating")}</InputLabel>
                      <Select
                        labelId={`testimonial-rating-${item.id}`}
                        label={t("rating")}
                        value={item.rating}
                        onChange={(event) =>
                          update({
                            testimonials: data.testimonials.map((entry, position) =>
                              position === index
                                ? {
                                    ...entry,
                                    rating: Number(event.target.value) as 1 | 2 | 3 | 4 | 5,
                                  }
                                : entry,
                            ),
                          })
                        }
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <MenuItem key={rating} value={rating}>
                            {t("starRating", { count: rating })}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={item.enabled}
                          disabled={!canEdit}
                          onChange={(event) =>
                            update({
                              testimonials: data.testimonials.map((entry, position) =>
                                position === index
                                  ? { ...entry, enabled: event.target.checked }
                                  : entry,
                              ),
                            })
                          }
                        />
                      }
                      label={t("visible")}
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Section>

        <Section title={t("discountedSection")} description={t("discountedSectionHelp")}>
          <FormControlLabel
            control={
              <Switch
                checked={data.discountedSection.enabled}
                disabled={!canEdit}
                onChange={(event) =>
                  update({
                    discountedSection: { ...data.discountedSection, enabled: event.target.checked },
                  })
                }
              />
            }
            label={t("visible")}
          />
          <Box
            sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}
          >
            <FormControl fullWidth disabled={!canEdit}>
              <InputLabel id="homepage-discount-mode">{t("offerSelection")}</InputLabel>
              <Select
                labelId="homepage-discount-mode"
                label={t("offerSelection")}
                value={data.discountedSection.mode}
                onChange={(event) => {
                  const mode = event.target.value as "automatic" | "curated";
                  update({
                    discountedSection: {
                      ...data.discountedSection,
                      mode,
                      dishIds: mode === "automatic" ? [] : data.discountedSection.dishIds,
                    },
                  });
                }}
              >
                <MenuItem value="automatic">{t("automaticSelection")}</MenuItem>
                <MenuItem value="curated">{t("curatedSelection")}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="number"
              label={t("offerLimit")}
              value={data.discountedSection.limit}
              disabled={!canEdit}
              slotProps={{ htmlInput: { min: 1, max: 12, step: 1 } }}
              onChange={(event) =>
                update({
                  discountedSection: {
                    ...data.discountedSection,
                    limit: Number(event.target.value),
                  },
                })
              }
            />
          </Box>
          {data.discountedSection.mode === "curated" ? (
            <Selection
              label={t("selectDiscountedDishes")}
              unavailableLabel={t("unavailableItem")}
              options={options.dishes}
              ids={data.discountedSection.dishIds}
              locale={locale}
              disabled={!canEdit}
              loading={loadingOptions}
              limit={12}
              onChange={(dishIds) =>
                update({
                  discountedSection: { ...data.discountedSection, dishIds },
                })
              }
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t("automaticOffersHelp")}
            </Typography>
          )}
        </Section>

        <Section title={t("blogPosts")} description={t("blogPostsHelp")}>
          <Selection
            label={t("selectBlogs")}
            unavailableLabel={t("unavailableItem")}
            options={options.blogs}
            ids={data.blogIds}
            locale={locale}
            disabled={!canEdit}
            loading={loadingOptions}
            limit={12}
            onChange={(blogIds) => update({ blogIds })}
          />
        </Section>
      </Box>
    </Stack>
  );
}

type TranslationField = Readonly<{
  name: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
}>;

function LocalizedItems({
  locale,
  dataItems,
  rows,
  idField,
  fields,
  canEdit,
  itemNumberLabel,
  englishCopyLabel,
  addEnglishLabel,
  addTranslationLabel,
  fallbackLabel,
  onChange,
}: {
  locale: Locale;
  dataItems: readonly RecordValue[];
  rows: readonly RecordValue[];
  idField: "id" | "categoryId";
  fields: readonly TranslationField[];
  canEdit: boolean;
  itemNumberLabel: (number: number) => string;
  englishCopyLabel: string;
  addEnglishLabel: string;
  addTranslationLabel: string;
  fallbackLabel: string;
  onChange: (rows: RecordValue[]) => void;
}) {
  const localizedId = (row: RecordValue) => String(row[idField] ?? "");
  const getRow = (id: string) => rows.find((row) => localizedId(row) === id);
  const begin = (id: string) =>
    onChange([
      ...rows,
      { [idField]: id, ...Object.fromEntries(fields.map((field) => [field.name, ""])) },
    ]);
  const patch = (id: string, field: string, value: string) => {
    const existing = getRow(id);
    if (!existing) {
      onChange([
        ...rows,
        {
          [idField]: id,
          ...Object.fromEntries(
            fields.map((entry) => [entry.name, entry.name === field ? value : ""]),
          ),
        },
      ]);
      return;
    }
    onChange(rows.map((row) => (localizedId(row) === id ? { ...row, [field]: value } : row)));
  };
  const remove = (id: string) => onChange(rows.filter((row) => localizedId(row) !== id));

  if (dataItems.length === 0) return null;
  return (
    <Stack spacing={1}>
      {dataItems.map((item) => {
        const id = String(item[idField] ?? "");
        const row = getRow(id);
        return (
          <Card key={id} variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                >
                  <Typography sx={{ fontWeight: 600 }}>
                    {itemNumberLabel(dataItems.indexOf(item) + 1)}
                  </Typography>
                  {row ? (
                    locale === "en" ? (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={englishCopyLabel}
                      />
                    ) : (
                      <Button size="small" disabled={!canEdit} onClick={() => remove(id)}>
                        {fallbackLabel}
                      </Button>
                    )
                  ) : (
                    <Button size="small" disabled={!canEdit} onClick={() => begin(id)}>
                      {locale === "en" ? addEnglishLabel : addTranslationLabel}
                    </Button>
                  )}
                </Stack>
                {row ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    {fields.map((field) => (
                      <TextField
                        key={field.name}
                        fullWidth
                        label={field.label}
                        value={String(row[field.name] ?? "")}
                        disabled={!canEdit}
                        required={field.required}
                        multiline={field.multiline}
                        minRows={field.multiline ? 2 : undefined}
                        dir={locale === "fa" ? "rtl" : "ltr"}
                        onChange={(event) => patch(id, field.name, event.target.value)}
                        sx={{ gridColumn: field.multiline ? { md: "span 2" } : undefined }}
                      />
                    ))}
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

export function HomepageTranslationsEditor({
  data,
  locale,
  value,
  canEdit,
  onChange,
  onClear,
}: {
  data: HomepageSettingsData;
  locale: Locale;
  value: HomepageSettingsTranslationValue | null;
  canEdit: boolean;
  onChange: (value: HomepageSettingsTranslationValue) => void;
  onClear: () => void;
}) {
  const t = useTranslations("dashboard.settingsEditor.homepage");
  const uiLocale = useLocale();
  const direction = uiLocale === "fa" ? "rtl" : "ltr";
  const contentDirection = locale === "fa" ? "rtl" : "ltr";
  const dataItems: Record<string, RecordValue[]> = {
    heroSlides: data.heroSlides.map(object),
    linkedBanners: data.linkedBanners.map(object),
    benefits: data.benefits.map(object),
    testimonials: data.testimonials.map(object),
    categoryBanners: data.categoryBanners.map(object),
  };
  const current = value ?? blankTranslation();
  const update = (patch: Partial<HomepageSettingsTranslationValue>) =>
    onChange({ ...current, ...patch });
  const updateRows = (
    key: "heroSlides" | "linkedBanners" | "benefits" | "testimonials" | "categoryBanners",
    rows: RecordValue[],
  ) => update({ [key]: rows } as Partial<HomepageSettingsTranslationValue>);
  const sectionTitleFields = [
    ["featured", t("featuredDishes")],
    ["benefits", t("benefits")],
    ["testimonials", t("testimonials")],
    ["categories", t("categoryShowcase")],
    ["discounted", t("discountedSection")],
    ["blog", t("blogPosts")],
  ] as const;

  if (locale !== "en" && !value) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="h6">{t("localizedHomepage")}</Typography>
        <Typography color="text.secondary">{t("optionalTranslationHelp")}</Typography>
        <Button
          disabled={!canEdit}
          variant="outlined"
          onClick={() => onChange(blankTranslation())}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("enableTranslation")}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5} dir={direction}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="h6">{t("localizedHomepage")}</Typography>
          <Typography color="text.secondary" variant="body2">
            {locale === "en" ? t("englishTranslationHelp") : t("localizedHomepageHelp")}
          </Typography>
        </Box>
        {locale !== "en" ? (
          <Button disabled={!canEdit} onClick={onClear}>
            {t("useEnglishFallback")}
          </Button>
        ) : null}
      </Stack>
      <Section title={t("sectionTitles")} description={t("sectionTitlesHelp")}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          {sectionTitleFields.map(([key, label]) => (
            <TextField
              key={key}
              fullWidth
              required
              label={label}
              value={current.sectionTitles[key]}
              disabled={!canEdit}
              dir={contentDirection}
              onChange={(event) =>
                update({ sectionTitles: { ...current.sectionTitles, [key]: event.target.value } })
              }
            />
          ))}
        </Box>
      </Section>
      <Section title={t("heroSlides")} description={t("translateHeroSlides")}>
        <LocalizedItems
          locale={locale}
          dataItems={dataItems.heroSlides ?? []}
          rows={records(current.heroSlides)}
          idField="id"
          fields={[
            { name: "title", label: t("slideTitle"), required: true },
            { name: "description", label: t("slideDescription"), multiline: true },
            { name: "ctaLabel", label: t("buttonLabel") },
            { name: "imageAlt", label: t("imageDescription"), required: true },
          ]}
          canEdit={canEdit}
          itemNumberLabel={(number) => t("itemNumber", { number })}
          englishCopyLabel={t("englishCopyRequired")}
          addEnglishLabel={t("addEnglishCopy")}
          addTranslationLabel={t("addTranslation")}
          fallbackLabel={t("useEnglishFallback")}
          onChange={(rows) => updateRows("heroSlides", rows)}
        />
      </Section>
      <Section title={t("linkedBanners")} description={t("translateBanners")}>
        <LocalizedItems
          locale={locale}
          dataItems={dataItems.linkedBanners ?? []}
          rows={records(current.linkedBanners)}
          idField="id"
          fields={[
            { name: "title", label: t("bannerTitle") },
            { name: "imageAlt", label: t("imageDescription"), required: true },
          ]}
          canEdit={canEdit}
          itemNumberLabel={(number) => t("itemNumber", { number })}
          englishCopyLabel={t("englishCopyRequired")}
          addEnglishLabel={t("addEnglishCopy")}
          addTranslationLabel={t("addTranslation")}
          fallbackLabel={t("useEnglishFallback")}
          onChange={(rows) => updateRows("linkedBanners", rows)}
        />
      </Section>
      <Section title={t("benefits")} description={t("translateBenefits")}>
        <LocalizedItems
          locale={locale}
          dataItems={dataItems.benefits ?? []}
          rows={records(current.benefits)}
          idField="id"
          fields={[
            { name: "title", label: t("benefitTitle"), required: true },
            {
              name: "description",
              label: t("benefitDescription"),
              multiline: true,
              required: true,
            },
          ]}
          canEdit={canEdit}
          itemNumberLabel={(number) => t("itemNumber", { number })}
          englishCopyLabel={t("englishCopyRequired")}
          addEnglishLabel={t("addEnglishCopy")}
          addTranslationLabel={t("addTranslation")}
          fallbackLabel={t("useEnglishFallback")}
          onChange={(rows) => updateRows("benefits", rows)}
        />
      </Section>
      <Section title={t("testimonials")} description={t("translateTestimonials")}>
        <LocalizedItems
          locale={locale}
          dataItems={dataItems.testimonials ?? []}
          rows={records(current.testimonials)}
          idField="id"
          fields={[
            { name: "authorName", label: t("guestName"), required: true },
            { name: "authorRole", label: t("guestRole") },
            { name: "quote", label: t("guestQuote"), multiline: true, required: true },
          ]}
          canEdit={canEdit}
          itemNumberLabel={(number) => t("itemNumber", { number })}
          englishCopyLabel={t("englishCopyRequired")}
          addEnglishLabel={t("addEnglishCopy")}
          addTranslationLabel={t("addTranslation")}
          fallbackLabel={t("useEnglishFallback")}
          onChange={(rows) => updateRows("testimonials", rows)}
        />
      </Section>
      <Section title={t("categoryShowcase")} description={t("translateCategories")}>
        <LocalizedItems
          locale={locale}
          dataItems={dataItems.categoryBanners ?? []}
          rows={records(current.categoryBanners)}
          idField="categoryId"
          fields={[
            { name: "title", label: t("categoryTitle") },
            { name: "imageAlt", label: t("imageDescription"), required: true },
          ]}
          canEdit={canEdit}
          itemNumberLabel={(number) => t("itemNumber", { number })}
          englishCopyLabel={t("englishCopyRequired")}
          addEnglishLabel={t("addEnglishCopy")}
          addTranslationLabel={t("addTranslation")}
          fallbackLabel={t("useEnglishFallback")}
          onChange={(rows) => updateRows("categoryBanners", rows)}
        />
      </Section>
    </Stack>
  );
}
