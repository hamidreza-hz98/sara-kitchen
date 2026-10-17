import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { formatDate, formatNumber } from "@/locales/formatters";

import type { BlogCard, BlogIndexContent } from "./blog-data";
import { blogHref, type BlogQuery } from "./blog-query";

const inputStyle = {
  minHeight: 44,
  width: "100%",
  border: "1px solid #d9cec8",
  borderRadius: 2,
  backgroundColor: "white",
  paddingInline: 12,
  font: "inherit",
} as const;

function ArticleCard({ article, view }: { article: BlogCard; view: BlogQuery["view"] }) {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("storefront.blog");
  return (
    <Paper
      component="article"
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 4,
        height: "100%",
        display: view === "list" ? { xs: "block", sm: "flex" } : "block",
      }}
    >
      {article.image ? (
        <Box
          component="img"
          src={article.image.url}
          alt={article.image.alt}
          loading="lazy"
          decoding="async"
          sx={{
            display: "block",
            width: view === "list" ? { xs: "100%", sm: 280 } : "100%",
            height: 220,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <Box
          aria-hidden="true"
          sx={{
            width: view === "list" ? { xs: "100%", sm: 280 } : "100%",
            height: 220,
            flexShrink: 0,
            background: "linear-gradient(135deg, #ffe0d9, #fff8ef 55%, #ddece5)",
          }}
        />
      )}
      <Stack spacing={1.25} sx={{ p: 2.5, flex: 1 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", color: "text.secondary" }}>
          <Typography variant="caption">{article.author}</Typography>
          <Typography variant="caption" aria-hidden="true">
            ·
          </Typography>
          <Typography variant="caption">
            {formatDate(new Date(article.publishedAt), locale)}
          </Typography>
          <Typography variant="caption" aria-hidden="true">
            ·
          </Typography>
          <Typography variant="caption">
            {t("readTime", { minutes: article.readTimeMinutes })}
          </Typography>
        </Stack>
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800 }}>
          {article.title}
        </Typography>
        {article.excerpt && (
          <Typography
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {article.excerpt}
          </Typography>
        )}
        <Button
          component="a"
          href={`/blog/${article.slug}`}
          variant="contained"
          sx={{ alignSelf: "flex-start", mt: "auto !important" }}
          aria-label={`${t("readPost")}: ${article.title}`}
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
  const pages = Array.from(
    { length: Math.min(content.totalPages, 5) },
    (_, index) => Math.max(1, Math.min(query.page - 2, content.totalPages - 4)) + index,
  );
  return (
    <Box sx={{ bgcolor: "background.default", pb: { xs: 7, md: 12 } }}>
      <Box
        sx={{
          bgcolor: "#fff0e7",
          backgroundImage:
            "radial-gradient(circle at 15% 30%, #ffd7d0 0, transparent 24%), radial-gradient(circle at 85% 65%, #e2f0e5 0, transparent 26%)",
          "html.dark &": {
            bgcolor: "#321b1b",
            backgroundImage:
              "radial-gradient(circle at 15% 30%, #432424 0, transparent 24%), radial-gradient(circle at 85% 65%, #3a282e 0, transparent 26%)",
          },
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Box component="nav" aria-label={t("breadcrumbs")} sx={{ mb: 2 }}>
            <Link href="/">{t("home")}</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{t("title")}</span>
          </Box>
          <Typography component="h1" variant="h2" sx={{ fontWeight: 800, maxWidth: 750 }}>
            {t("title")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 650 }}>
            {t("description")}
          </Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 6 } }}>
        {featured.length > 0 && (
          <Box component="section" aria-label={t("featured")} sx={{ mb: 5 }}>
            <Typography component="h2" variant="h5" sx={{ mb: 2, fontWeight: 800 }}>
              {t("featured")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {featured.map((article) => (
                <Box
                  key={article.slug}
                  component="a"
                  href={`/blog/${article.slug}`}
                  sx={{
                    position: "relative",
                    minHeight: { xs: 190, sm: 230 },
                    borderRadius: 4,
                    overflow: "hidden",
                    color: "white",
                    textDecoration: "none",
                    bgcolor: "#272742",
                    display: "flex",
                    alignItems: "flex-end",
                    p: 2.5,
                    backgroundImage: article.image
                      ? `linear-gradient(0deg, rgba(20,20,30,.93), rgba(20,20,30,.82) 48%, rgba(20,20,30,.42)), url("${article.image.url}")`
                      : "linear-gradient(140deg, #292844, #ff6269)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    "&:focus-visible": {
                      outline: "3px solid var(--sara-palette-primary-dark)",
                      outlineOffset: 3,
                    },
                  }}
                >
                  <Typography component="span" variant="h6" sx={{ fontWeight: 800, zIndex: 1 }}>
                    {article.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        <Paper
          component="form"
          action="/blog"
          method="get"
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mb: 3 }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr auto" },
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
                type="search"
                name="q"
                defaultValue={query.search}
                sx={inputStyle}
              />
            </Box>
            <Box component="label" sx={{ display: "grid", gap: 0.75 }}>
              <Typography component="span" variant="body2">
                {t("sort")}
              </Typography>
              <Box component="select" name="sort" defaultValue={query.sort} sx={inputStyle}>
                <option value="newest">{t("newest")}</option>
                <option value="oldest">{t("oldest")}</option>
                <option value="popular">{t("popular")}</option>
              </Box>
            </Box>
            <Button type="submit" variant="contained" sx={{ minHeight: 44 }}>
              {t("apply")}
            </Button>
          </Box>
          {query.view !== "grid" && <input type="hidden" name="view" value={query.view} />}
        </Paper>
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800 }}>
            {t("latest")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t("found", { count: formatNumber(content.total, locale) })}
            </Typography>
            <Button
              component="a"
              href={blogHref(query, { view: "grid", page: 1 })}
              aria-current={query.view === "grid" ? "true" : undefined}
              variant={query.view === "grid" ? "contained" : "outlined"}
              size="small"
            >
              {t("grid")}
            </Button>
            <Button
              component="a"
              href={blogHref(query, { view: "list", page: 1 })}
              aria-current={query.view === "list" ? "true" : undefined}
              variant={query.view === "list" ? "contained" : "outlined"}
              size="small"
            >
              {t("list")}
            </Button>
          </Stack>
        </Stack>
        {content.items.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 4 }}>
            <Typography variant="h6">{t("empty")}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t("emptyHint")}
            </Typography>
            <Button component="a" href="/blog" variant="outlined">
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
                  : { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
              gap: 3,
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
            sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1, mt: 5 }}
          >
            {query.page > 1 && (
              <Button
                component="a"
                href={blogHref(query, { page: query.page - 1 })}
                variant="outlined"
              >
                {t("previous")}
              </Button>
            )}
            {pages.map((page) => (
              <Button
                key={page}
                component="a"
                href={blogHref(query, { page })}
                variant={page === query.page ? "contained" : "outlined"}
                aria-current={page === query.page ? "page" : undefined}
                aria-label={t("page", { page })}
              >
                {formatNumber(page, locale)}
              </Button>
            ))}
            {query.page < content.totalPages && (
              <Button
                component="a"
                href={blogHref(query, { page: query.page + 1 })}
                variant="outlined"
              >
                {t("next")}
              </Button>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
