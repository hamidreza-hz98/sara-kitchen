import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { formatDate, formatNumber } from "@/locales/formatters";

import type { BlogCard, BlogIndexContent } from "./blog-data";
import { blogHref, type BlogQuery } from "./blog-query";

function categoryLabel(tags: readonly string[]) {
  const tag = tags[0];
  if (!tag) return "";
  return tag
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function StoryTile({ article, featured }: { article: BlogCard; featured: boolean }) {
  return (
    <Box
      component={Link}
      href={`/blog/${article.slug}`}
      aria-label={article.title}
      sx={{
        position: "relative",
        display: "flex",
        minHeight: featured ? { xs: 340, md: 382 } : { xs: 165, md: 185 },
        alignItems: "flex-end",
        overflow: "hidden",
        borderRadius: 2,
        color: "common.white",
        textDecoration: "none",
        bgcolor: "#252a28",
        backgroundImage: article.image
          ? `linear-gradient(0deg, rgba(16,20,20,.82), rgba(16,20,20,.06) 76%), url("${article.image.url}")`
          : "linear-gradient(140deg, #6c453c, #d96d60)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 16px 34px #251b1730" },
        "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 3 },
      }}
    >
      <Stack spacing={0.75} sx={{ p: { xs: 1.75, md: 2.25 }, zIndex: 1 }}>
        {categoryLabel(article.tags) && (
          <Typography
            component="span"
            sx={{
              color: "#ffd5cb",
              fontSize: ".68rem",
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            {categoryLabel(article.tags)}
          </Typography>
        )}
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: featured ? { xs: "1.15rem", md: "1.45rem" } : "1rem",
            lineHeight: 1.25,
          }}
        >
          {article.title}
        </Typography>
      </Stack>
    </Box>
  );
}

function ArticleCard({ article, view }: { article: BlogCard; view: BlogQuery["view"] }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.blog");
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : null;
  const dateLabel =
    publishedDate && !Number.isNaN(publishedDate.getTime())
      ? formatDate(publishedDate, locale)
      : null;
  const category = categoryLabel(article.tags);

  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        display: view === "list" ? { xs: "block", md: "flex" } : "block",
        minWidth: 0,
        transition: "box-shadow .2s ease, transform .2s ease",
        "&:hover": { boxShadow: "0 14px 34px #2a21191a", transform: "translateY(-2px)" },
      }}
    >
      <Box
        component={Link}
        href={`/blog/${article.slug}`}
        aria-label={`${t("readPost")}: ${article.title}`}
        sx={{
          position: "relative",
          display: "block",
          width: view === "list" ? { xs: "100%", md: 290 } : "100%",
          height: view === "list" ? { xs: 205, md: 230 } : { xs: 205, sm: 220 },
          flexShrink: 0,
          bgcolor: "#ece4dc",
          overflow: "hidden",
        }}
      >
        {article.image ? (
          <Box
            component="img"
            src={article.image.url}
            alt={article.image.alt || article.title}
            loading="lazy"
            decoding="async"
            sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            aria-hidden="true"
            sx={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #ffe0d9, #fff8ef 55%, #ddece5)",
            }}
          />
        )}
        {category && (
          <Typography
            component="span"
            sx={{
              position: "absolute",
              insetBlockStart: 12,
              insetInlineEnd: 12,
              px: 1.1,
              py: 0.55,
              bgcolor: "rgba(255,255,255,.92)",
              color: "primary.dark",
              borderRadius: 1,
              fontSize: ".66rem",
              fontWeight: 800,
              letterSpacing: ".05em",
              textTransform: "uppercase",
            }}
          >
            {category}
          </Typography>
        )}
      </Box>
      <Stack spacing={1.2} sx={{ p: { xs: 1.75, md: 2.25 }, flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            flexWrap: "wrap",
            columnGap: 1.4,
            rowGap: 0.65,
            color: "text.secondary",
          }}
        >
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <PersonOutlineRoundedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">{article.author}</Typography>
          </Stack>
          {dateLabel && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <CalendarMonthRoundedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption">{dateLabel}</Typography>
            </Stack>
          )}
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <AccessTimeRoundedIcon sx={{ fontSize: 15 }} />
            <Typography variant="caption">
              {t("readTime", { minutes: article.readTimeMinutes })}
            </Typography>
          </Stack>
        </Stack>
        <Typography
          component="h2"
          sx={{ fontSize: { xs: "1.2rem", md: "1.3rem" }, fontWeight: 800, lineHeight: 1.35 }}
        >
          {article.title}
        </Typography>
        {article.excerpt && (
          <Typography
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: { xs: 2, md: 3 },
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.7,
            }}
          >
            {article.excerpt}
          </Typography>
        )}
        <Button
          component={Link}
          href={`/blog/${article.slug}`}
          variant="contained"
          endIcon={
            <ArrowForwardRoundedIcon sx={{ transform: "scaleX(var(--sk-direction-scale, 1))" }} />
          }
          aria-label={`${t("readPost")}: ${article.title}`}
          sx={{
            mt: "auto !important",
            width: { xs: "100%", md: "auto" },
            alignSelf: { md: "flex-start" },
            minHeight: 43,
            borderRadius: 1.25,
            boxShadow: "none",
          }}
        >
          {t("readPost")}
        </Button>
      </Stack>
    </Paper>
  );
}

export function BlogIndexPage({ content, query }: { content: BlogIndexContent; query: BlogQuery }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.blog");
  const featured =
    query.page === 1 && !query.search && query.sort === "newest" ? content.items.slice(0, 3) : [];
  const mosaic = featured.length >= 3;
  const pages = Array.from(
    { length: Math.min(content.totalPages, 5) },
    (_, index) => Math.max(1, Math.min(query.page - 2, content.totalPages - 4)) + index,
  );

  return (
    <Box sx={{ bgcolor: "background.default", pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 } }}>
        <Box
          component="nav"
          aria-label={t("breadcrumbs")}
          sx={{ mb: { xs: 2, md: 2.5 }, color: "text.secondary", fontSize: ".82rem" }}
        >
          <Link href="/" style={{ color: "inherit" }}>
            {t("home")}
          </Link>
          <span aria-hidden="true"> / </span>
          <Typography component="span" aria-current="page" variant="inherit" color="text.primary">
            {t("title")}
          </Typography>
        </Box>
        <Box sx={{ mb: { xs: 2.5, md: 4 } }}>
          <Typography
            component="h1"
            sx={{
              color: "primary.dark",
              fontWeight: 800,
              fontSize: { xs: "1.8rem", md: "2.8rem" },
              lineHeight: 1.15,
              letterSpacing: "-.03em",
            }}
          >
            {t("title")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680, lineHeight: 1.75 }}>
            {t("description")}
          </Typography>
        </Box>

        {featured.length > 0 && (
          <Box component="section" aria-label={t("featured")} sx={{ mb: { xs: 3, md: 5 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: mosaic
                  ? {
                      xs: "repeat(2, minmax(0, 1fr))",
                      md: "minmax(0, 1.25fr) minmax(0, .9fr) minmax(0, .9fr)",
                    }
                  : { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gridTemplateRows: mosaic
                  ? { xs: "repeat(2, minmax(0, 170px))", md: "repeat(2, minmax(0, 185px))" }
                  : undefined,
                gap: { xs: 1.25, md: 1.75 },
              }}
            >
              {featured.map((article, index) => (
                <Box
                  key={article.slug}
                  sx={
                    mosaic && index === 0
                      ? { gridColumn: { xs: "auto", md: "span 2" }, gridRow: "span 2" }
                      : undefined
                  }
                >
                  <StoryTile article={article} featured={mosaic && index === 0} />
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.25, md: 1.75 },
            mb: 2,
            borderRadius: 1.75,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
              <TuneRoundedIcon color="primary" sx={{ fontSize: 21 }} />
              <Typography
                component="h2"
                sx={{ fontWeight: 800, fontSize: { xs: ".98rem", md: "1.05rem" } }}
              >
                {t("latest")}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{
                  px: 1,
                  py: 0.6,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  whiteSpace: "nowrap",
                }}
              >
                {t("found", { count: formatNumber(content.total, locale) })}
              </Typography>
              <IconButton
                component={Link}
                href={blogHref(query, { view: "grid", page: 1 })}
                aria-label={t("grid")}
                aria-current={query.view === "grid" ? "true" : undefined}
                size="small"
                sx={{
                  color: query.view === "grid" ? "primary.main" : "text.secondary",
                  bgcolor: query.view === "grid" ? "action.hover" : "transparent",
                  borderRadius: 1,
                }}
              >
                <GridViewRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                component={Link}
                href={blogHref(query, { view: "list", page: 1 })}
                aria-label={t("list")}
                aria-current={query.view === "list" ? "true" : undefined}
                size="small"
                sx={{
                  color: query.view === "list" ? "primary.main" : "text.secondary",
                  bgcolor: query.view === "list" ? "action.hover" : "transparent",
                  borderRadius: 1,
                }}
              >
                <ViewAgendaOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
          <Box
            component="details"
            sx={{
              mt: 1.25,
              "& summary": {
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                width: "fit-content",
                cursor: "pointer",
                color: "text.secondary",
                fontSize: ".85rem",
                fontWeight: 700,
                listStyle: "none",
                "&::-webkit-details-marker": { display: "none" },
              },
            }}
          >
            <Box component="summary">
              <SearchRoundedIcon sx={{ fontSize: 18 }} />
              {t("search")}
            </Box>
            <Box
              component="form"
              action="/blog"
              method="get"
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) 180px auto" },
                gap: 1,
                mt: 1.25,
              }}
            >
              <Box
                component="input"
                type="search"
                name="q"
                defaultValue={query.search}
                placeholder={t("search")}
                aria-label={t("search")}
                sx={{
                  minHeight: 42,
                  minWidth: 0,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.default",
                  px: 1.25,
                  font: "inherit",
                }}
              />
              <Box
                component="select"
                name="sort"
                defaultValue={query.sort}
                aria-label={t("sort")}
                sx={{
                  minHeight: 42,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.default",
                  px: 1.25,
                  font: "inherit",
                }}
              >
                <option value="newest">{t("newest")}</option>
                <option value="oldest">{t("oldest")}</option>
                <option value="popular">{t("popular")}</option>
              </Box>
              {query.view !== "grid" && <input type="hidden" name="view" value={query.view} />}
              <Button
                type="submit"
                variant="contained"
                sx={{ minHeight: 42, borderRadius: 1, px: 2 }}
              >
                {t("apply")}
              </Button>
            </Box>
          </Box>
        </Paper>

        {content.items.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: "center",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {t("empty")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t("emptyHint")}
            </Typography>
            <Button component={Link} href="/blog" variant="outlined" sx={{ borderRadius: 1.25 }}>
              {t("clearFilters")}
            </Button>
          </Paper>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                query.view === "list"
                  ? "1fr"
                  : { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
              gap: { xs: 1.75, md: 2.5 },
            }}
          >
            {content.items.map((article) => (
              <ArticleCard key={article.slug} article={article} view={query.view} />
            ))}
          </Box>
        )}

        {content.totalPages > 1 && (
          <Box
            component="nav"
            aria-label={t("pagination")}
            sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.75, mt: 4 }}
          >
            {query.page > 1 && (
              <Button
                component={Link}
                href={blogHref(query, { page: query.page - 1 })}
                variant="outlined"
                aria-label={t("previous")}
                sx={{ minWidth: 42, borderRadius: 1.1 }}
              >
                <ArrowForwardRoundedIcon
                  sx={{ transform: "rotate(180deg) scaleX(var(--sk-direction-scale, 1))" }}
                />
              </Button>
            )}
            {pages.map((page) => (
              <Button
                key={page}
                component={Link}
                href={blogHref(query, { page })}
                variant={page === query.page ? "contained" : "outlined"}
                aria-current={page === query.page ? "page" : undefined}
                aria-label={t("page", { page })}
                sx={{ minWidth: 42, borderRadius: 1.1 }}
              >
                {formatNumber(page, locale)}
              </Button>
            ))}
            {query.page < content.totalPages && (
              <Button
                component={Link}
                href={blogHref(query, { page: query.page + 1 })}
                variant="outlined"
                aria-label={t("next")}
                sx={{ minWidth: 42, borderRadius: 1.1 }}
              >
                <ArrowForwardRoundedIcon
                  sx={{ transform: "scaleX(var(--sk-direction-scale, 1))" }}
                />
              </Button>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
