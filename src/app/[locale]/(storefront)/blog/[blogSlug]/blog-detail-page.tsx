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
import { BlogShareControls, BlogViewTracker } from "./blog-interactions";

function ImageFrame({
  image,
  alt,
  height = 180,
}: {
  image: BlogDetailImage | null;
  alt: string;
  height?: number;
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
  const renderMedia = (node: RichTextMediaNode) => {
    const asset = article.embeddedMedia[node.attrs.mediaId];
    if (!asset || asset.kind !== node.attrs.kind) return null;
    return (
      <Box component="figure" sx={{ mx: 0, my: 4 }}>
        {asset.kind === "image" ? (
          <Box
            component="img"
            src={asset.url}
            alt={node.attrs.alt}
            loading="lazy"
            decoding="async"
            sx={{ width: "100%", height: "auto", borderRadius: 3 }}
          />
        ) : (
          <Box
            component="video"
            src={asset.url}
            controls
            preload="metadata"
            aria-label={node.attrs.alt}
            sx={{ width: "100%", borderRadius: 3 }}
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
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 } }}>
        <Box
          component="nav"
          aria-label={t("breadcrumbs")}
          sx={{ mb: 3, display: "flex", flexWrap: "wrap", gap: 1 }}
        >
          <Link href="/">{t("home")}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/blog">{t("blog")}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{article.title}</span>
        </Box>
        <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 4, bgcolor: "#292844" }}>
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
                height: { xs: 360, md: 500 },
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              role="img"
              aria-label={article.title}
              sx={{
                height: { xs: 360, md: 500 },
                background: "linear-gradient(140deg, #292844, #ff6269)",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(0deg, rgba(16,16,29,.85), transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <Paper
            sx={{
              position: "absolute",
              insetInline: { xs: 16, md: 32 },
              bottom: { xs: 16, md: 32 },
              width: { md: "min(720px, 80%)" },
              borderRadius: 3,
              p: { xs: 2, md: 3 },
              bgcolor: "rgba(255,255,255,.94)",
            }}
          >
            <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>
              {article.title}
            </Typography>
            <Stack direction="row" sx={{ mt: 1.5, gap: 1.5, flexWrap: "wrap" }}>
              <Typography variant="body2">{t("byAuthor", { author: article.author })}</Typography>
              <Typography variant="body2">
                {formatDate(new Date(article.publishedAt), locale)}
              </Typography>
              <Typography variant="body2">
                {t("readTime", { minutes: article.readTimeMinutes })}
              </Typography>
            </Stack>
          </Paper>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 280px" },
            gap: { xs: 5, md: 7 },
            mt: { xs: 5, md: 7 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
              {article.excerpt}
            </Typography>
            <RichContent content={article.content} renderMedia={renderMedia} />
          </Box>
          {article.relatedDishes.length > 0 && (
            <Box component="aside" aria-label={t("relatedDishes")}>
              <Typography component="h2" variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
                {t("relatedDishes")}
              </Typography>
              <Stack spacing={2}>
                {article.relatedDishes.map((dish) => (
                  <Paper
                    key={dish.slug}
                    variant="outlined"
                    sx={{ overflow: "hidden", borderRadius: 3 }}
                  >
                    <ImageFrame image={dish.image} alt={dish.name} height={130} />
                    <Stack spacing={1} sx={{ p: 2 }}>
                      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {dish.name}
                      </Typography>
                      <Typography color="primary" sx={{ fontWeight: 800 }}>
                        {formatEuro(dish.priceCents, locale)}
                      </Typography>
                      <Button
                        component={Link}
                        href={`/menu/${dish.slug}`}
                        size="small"
                        sx={{ alignSelf: "flex-start" }}
                      >
                        {t("viewDish")}
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
        {article.relatedBlogs.length > 0 && (
          <Box
            component="section"
            aria-labelledby="related-blog-title"
            sx={{ mt: { xs: 7, md: 9 } }}
          >
            <Typography
              component="h2"
              id="related-blog-title"
              variant="h4"
              sx={{ mb: 3, fontWeight: 800 }}
            >
              {t("relatedBlogs")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {article.relatedBlogs.map((related) => (
                <Paper
                  key={related.slug}
                  component={Link}
                  href={`/blog/${related.slug}`}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    overflow: "hidden",
                    textDecoration: "none",
                    color: "text.primary",
                  }}
                >
                  <ImageFrame image={related.image} alt={related.title} height={140} />
                  <Stack spacing={1} sx={{ p: 2 }}>
                    <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
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
        )}
        <BlogShareControls canonicalUrl={article.canonicalUrl} title={article.title} />
      </Container>
    </Box>
  );
}
