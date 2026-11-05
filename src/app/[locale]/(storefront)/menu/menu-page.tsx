import GridViewRounded from "@mui/icons-material/GridViewRounded";
import ViewListRounded from "@mui/icons-material/ViewListRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import Link from "@/components/ui/client-next-link";
import { formatNumber } from "@/locales/formatters";
import { radiusTokens } from "@/theme";

import type { MenuContent } from "./menu-data";
import { MenuInfiniteResults } from "./menu-infinite-results";
import styles from "./menu-page.module.css";
import { menuHref, type MenuQuery } from "./menu-query";

function categoryFallbackImage(slug: string) {
  if (/(kebab|grill)/u.test(slug)) return "/images/home/hero-grill.webp";
  if (/(dessert|sweet|ice-cream|bastani)/u.test(slug)) return "/images/home/bastani-sonnati.webp";
  if (/(rice|polo|tahdig|side)/u.test(slug)) return "/images/home/adas-polo.webp";
  if (/(stew|khoresht|main-course|main)/u.test(slug)) return "/images/home/ghormeh-sabzi.webp";
  return "/images/home/persian-spices.webp";
}

function categoryHref(query: MenuQuery, categorySlug?: string) {
  const queryString = menuHref(query, { category: null, page: null }).slice("/menu".length);
  return categorySlug
    ? `/menu/category/${encodeURIComponent(categorySlug)}${queryString}`
    : `/menu${queryString}`;
}

export function MenuPage({ content, query }: { content: MenuContent; query: MenuQuery }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.menu");
  const title = content.selectedCategory?.name ?? t("title");
  const description = content.selectedCategory?.description || t("description");
  const categoryShowcases = content.categoryShowcases ?? [];
  const fallbackBanner = content.selectedCategory
    ? categoryFallbackImage(content.selectedCategory.slug)
    : "/images/home/hero-grill.webp";
  return (
    <Box className={styles.page}>
      <Container maxWidth="lg" className={styles.content}>
        <Box component="section" aria-labelledby="menu-title" className={styles.hero}>
          <Box
            component="img"
            src={content.banner?.url ?? fallbackBanner}
            alt={content.banner?.alt ?? ""}
            className={styles.heroImage}
          />
          <Box className={styles.heroShade} />
          <Typography id="menu-title" component="h1" variant="h2" className={styles.heroTitle}>
            {title}
          </Typography>
        </Box>

        <Box component="nav" aria-label={t("breadcrumbs")} className={styles.breadcrumbs}>
          <Link href="/">{t("home")}</Link>
          <span aria-hidden="true">/</span>
          {content.selectedCategory ? (
            <>
              <Link href="/menu">{t("title")}</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{title}</span>
            </>
          ) : (
            <span aria-current="page">{title}</span>
          )}
        </Box>

        <Typography color="text.secondary" className={styles.description}>
          {description}
        </Typography>

        <Box component="nav" aria-label={t("category")} className={styles.categorySelector}>
          <Box className={styles.categoryTrack}>
            <Link
              href={categoryHref(query)}
              aria-current={!content.selectedCategory && !query.category ? "page" : undefined}
              className={`${styles.categoryOption} ${!content.selectedCategory && !query.category ? styles.categoryOptionActive : ""}`}
            >
              <Box
                component="img"
                src="/images/home/hero-grill.webp"
                alt=""
                loading="lazy"
                decoding="async"
                className={styles.categoryOptionImage}
              />
              <span>{t("allDishes")}</span>
            </Link>
            {content.categories.map((category) => {
              const selected = category.slug === (query.category || content.selectedCategory?.slug);
              return (
                <Link
                  href={categoryHref(query, category.slug)}
                  aria-current={selected ? "page" : undefined}
                  className={`${styles.categoryOption} ${selected ? styles.categoryOptionActive : ""}`}
                  key={category.slug}
                >
                  <Box
                    component="img"
                    src={
                      category.image?.url ??
                      category.banner?.url ??
                      categoryFallbackImage(category.slug)
                    }
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={styles.categoryOptionImage}
                  />
                  <span>{category.name}</span>
                </Link>
              );
            })}
          </Box>
        </Box>

        {/* Sort and advanced filters are hidden while the menu catalog is small. */}

        <Stack direction="row" className={styles.resultsHeading}>
          <Typography component="h2" variant="body2" color="text.secondary">
            {t("results", { count: formatNumber(content.totalItems, locale) })}
          </Typography>
          <Box role="group" aria-label={t("viewMode")} className={styles.viewToggle}>
            <Link
              href={menuHref(query, { view: "grid", page: null })}
              aria-label={t("grid")}
              aria-current={query.view === "grid" ? "page" : undefined}
              className={query.view === "grid" ? styles.viewButtonActive : styles.viewButton}
            >
              <GridViewRounded fontSize="small" />
            </Link>
            <Link
              href={menuHref(query, { view: "list", page: null })}
              aria-label={t("list")}
              aria-current={query.view === "list" ? "page" : undefined}
              className={query.view === "list" ? styles.viewButtonActive : styles.viewButton}
            >
              <ViewListRounded fontSize="small" />
            </Link>
          </Box>
        </Stack>

        {!content.selectedCategory && categoryShowcases.length ? (
          <Box className={styles.categorySections}>
            {categoryShowcases.map((showcase) => {
              const categoryQuery = { ...query, category: showcase.category.slug, page: 1 };
              return (
                <Box
                  component="section"
                  id={`category-${showcase.category.slug}`}
                  aria-labelledby={`category-title-${showcase.category.slug}`}
                  className={styles.categorySection}
                  key={showcase.category.slug}
                >
                  <Box className={styles.showcaseBanner}>
                    <Box
                      component="img"
                      src={
                        showcase.category.banner?.url ??
                        showcase.category.image?.url ??
                        categoryFallbackImage(showcase.category.slug)
                      }
                      alt={showcase.category.banner?.alt ?? showcase.category.name}
                      loading="lazy"
                      decoding="async"
                      className={styles.showcaseImage}
                    />
                    <Box className={styles.showcaseShade} />
                    <Box className={styles.showcaseCopy}>
                      <Typography
                        id={`category-title-${showcase.category.slug}`}
                        component="h2"
                        variant="h5"
                        className={styles.showcaseTitle}
                      >
                        {showcase.category.name}
                      </Typography>
                      {showcase.category.description && (
                        <Typography variant="body2" className={styles.showcaseDescription}>
                          {showcase.category.description}
                        </Typography>
                      )}
                    </Box>
                    <Link
                      href={categoryHref(query, showcase.category.slug)}
                      className={styles.showcaseLink}
                    >
                      {t("viewCategory")}
                    </Link>
                  </Box>
                  {showcase.dishes.length ? (
                    <MenuInfiniteResults
                      key={`${locale}:${menuHref(categoryQuery, { page: null })}`}
                      initialDishes={showcase.dishes}
                      query={categoryQuery}
                      totalPages={showcase.totalPages}
                    />
                  ) : (
                    <Paper
                      variant="outlined"
                      className={styles.categoryEmpty}
                      sx={{ borderRadius: `${radiusTokens.md}px` }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t("categoryEmpty")}
                      </Typography>
                    </Paper>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : content.dishes.length ? (
          <MenuInfiniteResults
            key={`${locale}:${menuHref(query, { page: null })}`}
            initialDishes={content.dishes}
            query={query}
            totalPages={content.totalPages}
          />
        ) : (
          <Paper
            variant="outlined"
            className={styles.emptyState}
            sx={{ borderRadius: `${radiusTokens.lg}px` }}
          >
            <Typography component="h2" variant="h5">
              {query.invalid ? t("invalidFilters") : t("emptyTitle")}
            </Typography>
            <Typography color="text.secondary">{t("emptyDescription")}</Typography>
            <Button href="/menu" variant="contained">
              {t("clear")}
            </Button>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
