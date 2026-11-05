import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { RichContent } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import type { RichTextMediaNode } from "@/lib/rich-text";
import { formatDate, formatEuro } from "@/locales/formatters";

import type { BlogDetailContent, BlogDetailImage } from "./blog-detail-content";
import { BlogHeroActions, BlogShareControls, BlogViewTracker } from "./blog-interactions";

function ImageFrame({
  image,
  alt,
  height = 180,
}: {
  image: BlogDetailImage | null;
  alt: string;
  height?: number | string;
}) {
  return image ? (
    <Box
      component="img"
      src={image.url}
      alt={image.alt || alt}
      loading="lazy"
      decoding="async"
      sx={{ display: "block", width: "100%", height, objectFit: "cover" }}
    />
  ) : (
    <Box
      role="img"
      aria-label={alt}
      sx={{ height, background: "linear-gradient(135deg, #ffe0d9, #fff8ef 55%, #ddece5)" }}
    />
  );
}

export function BlogDetailPage({ article }: { article: BlogDetailContent }) {
  const t = useTranslations("storefront.blogDetail");
  const locale = useLocale() as SupportedLocale;
  const articleDate = article.publishedAt ? new Date(article.publishedAt) : null;
  const dateLabel =
    articleDate && !Number.isNaN(articleDate.getTime()) ? formatDate(articleDate, locale) : null;

  const renderMedia = (node: RichTextMediaNode) => {
    const asset = article.embeddedMedia[node.attrs.mediaId];
    if (!asset || asset.kind !== node.attrs.kind) return null;
    return (
      <Box component="figure" sx={{ mx: 0, my: { xs: 3, md: 4 } }}>
        {asset.kind === "image" ? (
          <Box
            component="img"
            src={asset.url}
            alt={node.attrs.alt}
            loading="lazy"
            decoding="async"
            sx={{ width: "100%", height: "auto", borderRadius: 1.5 }}
          />
        ) : (
          <Box
            component="video"
            src={asset.url}
            controls
            preload="metadata"
            aria-label={node.attrs.alt}
            sx={{ width: "100%", borderRadius: 1.5 }}
          />
        )}
        {node.attrs.caption && (
          <Typography
            component="figcaption"
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            {node.attrs.caption}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: "background.default", pb: { xs: 8, md: 12 } }}>
      <BlogViewTracker slug={article.slug} />
      <Container maxWidth="lg" sx={{ pt: { xs: 0, md: 4 } }}>
        <Box
          component="nav"
          aria-label={t("breadcrumbs")}
          sx={{
            mb: 2,
            display: { xs: "none", md: "flex" },
            flexWrap: "wrap",
            gap: 1,
            color: "text.secondary",
            fontSize: ".85rem",
          }}
        >
          <Link href="/" style={{ color: "inherit" }}>
            {t("home")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog" style={{ color: "inherit" }}>
            {t("blog")}
          </Link>
          <span aria-hidden="true">/</span>
          <Typography component="span" aria-current="page" variant="inherit" color="text.primary">
            {article.title}
          </Typography>
        </Box>

        <Box
          sx={{
            position: "relative",
            mx: { xs: -2, md: 0 },
            overflow: "hidden",
            borderRadius: { xs: 0, md: 2 },
            bgcolor: "#292844",
          }}
        >
          {article.banner ? (
            <Box
              component="img"
              src={article.banner.url}
              alt={article.banner.alt}
              fetchPriority="high"
              decoding="async"
              sx={{
                display: "block",
                width: "100%",
                height: { xs: "min(58svh, 520px)", md: 500 },
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              role="img"
              aria-label={article.title}
              sx={{
                height: { xs: "min(58svh, 520px)", md: 500 },
                background: "linear-gradient(140deg, #292844, #ff6269)",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(0deg, rgba(16,16,29,.62), transparent 55%)",
              pointerEvents: "none",
            }}
          />
          <BlogHeroActions canonicalUrl={article.canonicalUrl} title={article.title} />
          <Paper
            elevation={0}
            sx={{
              position: "absolute",
              insetInline: { xs: 12, md: 28 },
              bottom: { xs: 12, md: 28 },
              width: { md: "min(730px, 84%)" },
              p: { xs: 1.75, md: 2.75 },
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,.91)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 8px 30px #1113",
            }}
          >
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.3rem", sm: "1.55rem", md: "2.4rem" },
                lineHeight: 1.22,
                fontWeight: 800,
                color: "#25263c",
              }}
            >
              {article.title}
            </Typography>
            <Stack
              direction="row"
              sx={{ mt: 1.1, gap: { xs: 1.1, md: 1.8 }, flexWrap: "wrap", alignItems: "center" }}
            >
              <Stack
                direction="row"
                spacing={0.45}
                sx={{ alignItems: "center", color: "text.secondary" }}
              >
                <PersonOutlineRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
                <Typography variant="caption">
                  {t("byAuthor", { author: article.author })}
                </Typography>
              </Stack>
              {dateLabel && (
                <Stack
                  direction="row"
                  spacing={0.45}
                  sx={{ alignItems: "center", color: "text.secondary" }}
                >
                  <CalendarMonthRoundedIcon sx={{ fontSize: 15, color: "primary.main" }} />
                  <Typography variant="caption">{dateLabel}</Typography>
                </Stack>
              )}
              <Stack
                direction="row"
                spacing={0.45}
                sx={{ alignItems: "center", color: "text.secondary" }}
              >
                <AccessTimeRoundedIcon sx={{ fontSize: 15, color: "primary.main" }} />
                <Typography variant="caption">
                  {t("readTime", { minutes: article.readTimeMinutes })}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 280px" },
            gap: { xs: 4, md: 7 },
            mt: { xs: 3, md: 6 },
          }}
        >
          <Box component="article" sx={{ minWidth: 0 }}>
            {article.excerpt && (
              <Typography
                sx={{
                  mb: 3,
                  fontSize: { xs: "1.05rem", md: "1.18rem" },
                  fontWeight: 600,
                  lineHeight: 1.8,
                  color: "text.secondary",
                }}
              >
                {article.excerpt}
              </Typography>
            )}
            <Box
              sx={{
                color: "text.primary",
                fontSize: { xs: "1rem", md: "1.05rem" },
                lineHeight: { xs: 1.85, md: 1.95 },
                overflowWrap: "anywhere",
                "& p": { my: { xs: 1.6, md: 2.1 } },
                "& p:first-of-type::first-letter": {
                  float: "inline-start",
                  color: "primary.main",
                  fontSize: "3.3em",
                  fontWeight: 800,
                  lineHeight: 0.85,
                  paddingInlineEnd: ".12em",
                },
                "& h2, & h3": {
                  mt: { xs: 3.5, md: 4.5 },
                  mb: 1.25,
                  fontWeight: 800,
                  lineHeight: 1.3,
                },
                "& h2::before, & h3::before": {
                  content: '""',
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  verticalAlign: "middle",
                  marginInlineEnd: 1,
                },
                "& ul, & ol": { ps: 3, my: 2 },
                "& li": { mb: 0.75 },
                "& blockquote": {
                  mx: 0,
                  my: 3,
                  px: { xs: 2, md: 2.5 },
                  py: 1.75,
                  borderInlineStart: "3px solid",
                  borderColor: "primary.main",
                  borderRadius: "0 8px 8px 0",
                  bgcolor: "#fff0ec",
                  color: "text.primary",
                  fontStyle: "italic",
                },
                "& a": { color: "primary.dark", fontWeight: 700, textUnderlineOffset: 3 },
              }}
            >
              <RichContent content={article.content} renderMedia={renderMedia} />
            </Box>
          </Box>

          {article.relatedDishes.length > 0 && (
            <Box component="aside" aria-label={t("relatedDishes")} sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="h6" sx={{ mb: 1.5, fontWeight: 800 }}>
                {t("relatedDishes")}
              </Typography>
              <Box
                sx={{
                  overflowX: { xs: "auto", md: "visible" },
                  mx: { xs: -2, md: 0 },
                  px: { xs: 2, md: 0 },
                  pb: 1,
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                <Stack
                  direction={{ xs: "row", md: "column" }}
                  spacing={1.5}
                  sx={{ alignItems: "stretch" }}
                >
                  {article.relatedDishes.map((dish) => (
                    <Paper
                      key={dish.slug}
                      elevation={0}
                      sx={{
                        overflow: "hidden",
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        width: { xs: 255, md: "auto" },
                        flexShrink: 0,
                      }}
                    >
                      <ImageFrame image={dish.image} alt={dish.name} height={130} />
                      <Stack spacing={0.75} sx={{ p: 1.5 }}>
                        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {dish.name}
                        </Typography>
                        <Stack
                          direction="row"
                          sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
                        >
                          <Typography color="primary" sx={{ fontWeight: 800 }}>
                            {formatEuro(dish.priceCents, locale)}
                          </Typography>
                          <Button
                            component={Link}
                            href={`/menu/${dish.slug}`}
                            size="small"
                            sx={{ borderRadius: 1, minWidth: 0, px: 1 }}
                            aria-label={`${t("viewDish")}: ${dish.name}`}
                          >
                            <ArrowForwardRoundedIcon
                              fontSize="small"
                              sx={{ transform: "scaleX(var(--sk-direction-scale, 1))" }}
                            />
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </Box>
          )}
        </Box>

        {article.relatedBlogs.length > 0 && (
          <Box
            component="section"
            aria-labelledby="related-blog-title"
            sx={{ mt: { xs: 5, md: 8 } }}
          >
            <Typography
              component="h2"
              id="related-blog-title"
              sx={{ mb: 2, fontWeight: 800, fontSize: { xs: "1.45rem", md: "1.9rem" } }}
            >
              {t("relatedBlogs")}
            </Typography>
            <Box
              sx={{
                overflowX: { xs: "auto", md: "visible" },
                mx: { xs: -2, md: 0 },
                px: { xs: 2, md: 0 },
                pb: 1,
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              <Box
                sx={{
                  display: { xs: "flex", md: "grid" },
                  gridTemplateColumns: { md: "repeat(3, minmax(0, 1fr))" },
                  gap: 1.5,
                }}
              >
                {article.relatedBlogs.map((related) => (
                  <Paper
                    key={related.slug}
                    component={Link}
                    href={`/blog/${related.slug}`}
                    elevation={0}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      p: 1,
                      width: { xs: 280, md: "auto" },
                      flexShrink: 0,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      textDecoration: "none",
                      color: "text.primary",
                    }}
                  >
                    <Box
                      sx={{
                        width: 84,
                        height: 76,
                        overflow: "hidden",
                        flexShrink: 0,
                        borderRadius: 1,
                      }}
                    >
                      <ImageFrame image={related.image} alt={related.title} height={76} />
                    </Box>
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography
                        component="h3"
                        variant="subtitle2"
                        sx={{ fontWeight: 800, lineHeight: 1.35 }}
                      >
                        {related.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("readTime", { minutes: related.readTimeMinutes })}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Box>
          </Box>
        )}
        <BlogShareControls canonicalUrl={article.canonicalUrl} title={article.title} />
      </Container>
    </Box>
  );
}
