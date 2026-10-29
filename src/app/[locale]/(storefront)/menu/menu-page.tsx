import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { formatEuro, formatNumber } from "@/locales/formatters";

import type { MenuContent, MenuDish } from "./menu-data";
import {
  MENU_ALLERGEN_TAGS,
  MENU_DIETARY_TAGS,
  MENU_SORTS,
  menuHref,
  type MenuQuery,
} from "./menu-query";

const controlStyle = {
  minHeight: 44,
  width: "100%",
  border: "1px solid #d9cec8",
  borderRadius: 2,
  backgroundColor: "white",
  paddingInline: 12,
  font: "inherit",
} as const;

function DishCard({ dish, view }: { dish: MenuDish; view: MenuQuery["view"] }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.menu");
  return (
    <Paper
      component="article"
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 4,
        display: view === "list" ? { xs: "block", sm: "flex" } : "block",
        height: "100%",
      }}
    >
      {dish.image ? (
        <Box
          component="img"
          src={dish.image.url}
          alt={dish.image.alt}
          loading="lazy"
          decoding="async"
          sx={{
            display: "block",
            width: view === "list" ? { xs: "100%", sm: 220 } : "100%",
            height: 210,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <Box
          aria-hidden="true"
          sx={{
            width: view === "list" ? { xs: "100%", sm: 220 } : "100%",
            height: 210,
            flexShrink: 0,
            background: "linear-gradient(135deg, #ffe8df, #fff8ef 55%, #e1f1e7)",
          }}
        />
      )}
      <Stack spacing={1.5} sx={{ p: 2.5, flex: 1 }}>
        <Typography component="h3" variant="h6">
          {dish.name}
        </Typography>
        {dish.excerpt && <Typography color="text.secondary">{dish.excerpt}</Typography>}
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap" }}>
          <Typography color="primary" sx={{ fontWeight: 800 }}>
            {formatEuro(dish.priceCents, locale)}
          </Typography>
          {dish.compareAtPriceCents !== null && (
            <Typography component="s" color="text.secondary" variant="body2">
              {formatEuro(dish.compareAtPriceCents, locale)}
            </Typography>
          )}
        </Stack>
        {!dish.isOrderable && (
          <Typography color="text.secondary" variant="body2">
            {t("unavailable")}
          </Typography>
        )}
        <Button
          href={`/menu/${dish.slug}`}
          aria-label={`${t("viewDish")}: ${dish.name}`}
          variant="contained"
          size="small"
          sx={{ alignSelf: "flex-start" }}
        >
          {t("viewDish")}
        </Button>
      </Stack>
    </Paper>
  );
}

export function MenuPage({ content, query }: { content: MenuContent; query: MenuQuery }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.menu");
  const filters = useTranslations("shared.filters");
  const title = content.selectedCategory?.name ?? t("title");
  const description = content.selectedCategory?.description || t("description");
  const pages = Array.from({ length: Math.min(content.totalPages, 5) }, (_, index) => {
    const start = Math.max(1, Math.min(query.page - 2, content.totalPages - 4));
    return start + index;
  });
  return (
    <Box sx={{ pb: { xs: 7, md: 12 }, bgcolor: "background.default" }}>
      <Box
        sx={{
          position: "relative",
          bgcolor: "#fff0e7",
          overflow: "hidden",
          "html.dark &": { bgcolor: "#321b1b" },
        }}
      >
        {content.banner && (
          <Box
            component="img"
            src={content.banner.url}
            alt={content.banner.alt}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.16,
            }}
          />
        )}
        <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 5, md: 7 } }}>
          <Box component="nav" aria-label={t("breadcrumbs")} sx={{ mb: 2 }}>
            <Link href="/">{t("home")}</Link> <span aria-hidden="true"> / </span>
            {content.selectedCategory ? (
              <>
                <Link href="/menu">{t("title")}</Link> <span aria-hidden="true"> / </span>
                <span aria-current="page">{title}</span>
              </>
            ) : (
              <span aria-current="page">{title}</span>
            )}
          </Box>
          <Typography component="h1" variant="h2" sx={{ fontWeight: 800, maxWidth: 760 }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 700 }} color="text.secondary">
            {description}
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 } }}>
        <Paper
          component="form"
          action="/menu"
          method="get"
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mb: 4 }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 2,
              alignItems: "end",
            }}
          >
            <Box component="label" sx={{ display: "grid", gap: 0.75 }}>
              <Typography component="span" variant="body2">
                {t("search")}
              </Typography>
              <Box
                component="input"
                name="q"
                type="search"
                defaultValue={query.search}
                maxLength={80}
                placeholder={t("searchPlaceholder")}
                sx={controlStyle}
              />
            </Box>
            <Button type="submit" variant="contained" sx={{ minHeight: 44 }}>
              {t("apply")}
            </Button>
          </Box>
          <Box
            component="details"
            sx={{ mt: 2, "& summary": { cursor: "pointer", fontWeight: 700 } }}
          >
            <Box component="summary">{filters("advanced")}</Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 3,
                pt: 2,
              }}
            >
              <Box component="label" sx={{ display: "grid", gap: 0.75 }}>
                <Typography component="span" variant="body2">
                  {t("category")}
                </Typography>
                <Box
                  component="select"
                  name="category"
                  defaultValue={query.category}
                  sx={controlStyle}
                >
                  <option value="">{t("allCategories")}</option>
                  {content.categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </Box>
              </Box>
              <Box component="label" sx={{ display: "grid", gap: 0.75 }}>
                <Typography component="span" variant="body2">
                  {t("sort")}
                </Typography>
                <Box component="select" name="sort" defaultValue={query.sort} sx={controlStyle}>
                  {MENU_SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                      {t(`sortOptions.${sort}`)}
                    </option>
                  ))}
                </Box>
              </Box>
              <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                <Typography component="legend" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("availability")}
                </Typography>
                {(["available", "all", "unavailable"] as const).map((value) => (
                  <Box component="label" key={value} sx={{ display: "block", mb: 0.75 }}>
                    <input
                      type="radio"
                      name="availability"
                      value={value}
                      defaultChecked={query.availability === value}
                    />{" "}
                    {t(`availabilityOptions.${value}`)}
                  </Box>
                ))}
              </Box>
              <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                <Typography component="legend" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("dietary")}
                </Typography>
                {MENU_DIETARY_TAGS.map((value) => (
                  <Box component="label" key={value} sx={{ display: "block", mb: 0.75 }}>
                    <input
                      type="checkbox"
                      name="diet"
                      value={value}
                      defaultChecked={query.dietaryTags.includes(value)}
                    />{" "}
                    {t(`dietaryOptions.${value}`)}
                  </Box>
                ))}
                <Box component="label" sx={{ display: "block", mb: 0.75 }}>
                  <input
                    type="checkbox"
                    name="discounted"
                    value="1"
                    defaultChecked={query.discounted}
                  />{" "}
                  {t("discounted")}
                </Box>
                <Box component="label" sx={{ display: "block" }}>
                  <input
                    type="checkbox"
                    name="featured"
                    value="1"
                    defaultChecked={query.featured}
                  />{" "}
                  {t("featured")}
                </Box>
              </Box>
              <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                <Typography component="legend" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("excludeAllergens")}
                </Typography>
                {MENU_ALLERGEN_TAGS.map((value) => (
                  <Box component="label" key={value} sx={{ display: "block", mb: 0.75 }}>
                    <input
                      type="checkbox"
                      name="excludeAllergen"
                      value={value}
                      defaultChecked={query.excludeAllergens.includes(value)}
                    />{" "}
                    {t(`allergens.${value}`)}
                  </Box>
                ))}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("allergenNotice")}
            </Typography>
          </Box>
          <input type="hidden" name="view" value={query.view} />
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button type="submit" size="small">
              {t("apply")}
            </Button>
            <Button href="/menu" size="small">
              {t("clear")}
            </Button>
          </Stack>
        </Paper>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, mb: 3 }}
        >
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800 }}>
            {t("results", { count: formatNumber(content.totalItems, locale) })}
          </Typography>
          <Box role="group" aria-label={t("viewMode")} sx={{ display: "flex", gap: 1 }}>
            <Button
              href={menuHref(query, { view: "grid", page: null })}
              variant={query.view === "grid" ? "contained" : "outlined"}
              aria-current={query.view === "grid" ? "page" : undefined}
              size="small"
            >
              {t("grid")}
            </Button>
            <Button
              href={menuHref(query, { view: "list", page: null })}
              variant={query.view === "list" ? "contained" : "outlined"}
              aria-current={query.view === "list" ? "page" : undefined}
              size="small"
            >
              {t("list")}
            </Button>
          </Box>
        </Stack>
        {content.dishes.length ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                query.view === "list"
                  ? "1fr"
                  : { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
              gap: 3,
            }}
          >
            {content.dishes.map((dish) => (
              <DishCard dish={dish} view={query.view} key={dish.slug} />
            ))}
          </Box>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 4, p: { xs: 4, md: 7 }, textAlign: "center" }}
          >
            <Typography component="h2" variant="h5">
              {query.invalid ? t("invalidFilters") : t("emptyTitle")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
              {t("emptyDescription")}
            </Typography>
            <Button href="/menu" variant="contained">
              {t("clear")}
            </Button>
          </Paper>
        )}
        {content.totalPages > 1 && (
          <Box
            component="nav"
            aria-label={t("pagination")}
            sx={{ mt: 5, display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap" }}
          >
            {query.page > 1 && (
              <Button href={menuHref(query, { page: query.page - 1 })}>{t("previous")}</Button>
            )}
            {pages.map((page) => (
              <Button
                key={page}
                href={menuHref(query, { page })}
                variant={query.page === page ? "contained" : "outlined"}
                aria-current={query.page === page ? "page" : undefined}
                aria-label={t("page", { page })}
              >
                {page}
              </Button>
            ))}
            {query.page < content.totalPages && (
              <Button href={menuHref(query, { page: query.page + 1 })}>{t("next")}</Button>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
