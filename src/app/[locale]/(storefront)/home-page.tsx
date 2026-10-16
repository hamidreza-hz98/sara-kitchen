import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";

import type { SupportedLocale } from "@/constants";
import { formatEuro } from "@/locales/formatters";

import { HomeHero } from "./home-hero";
import {
  EMPTY_HOME_CONTENT,
  type HomeContent,
  type HomeDish,
  type HomeImage,
} from "./home-content";

function ImageTile({ image, height = 220 }: { image: HomeImage | null; height?: number }) {
  return image ? (
    <Box
      component="img"
      src={image.url}
      alt={image.alt}
      loading="lazy"
      decoding="async"
      sx={{ display: "block", width: "100%", height, objectFit: "cover" }}
    />
  ) : (
    <Box
      aria-hidden="true"
      sx={{ height, background: "linear-gradient(135deg, #ffe8df, #fff8ef 55%, #e1f1e7)" }}
    />
  );
}

function DishCard({ dish, locale }: { dish: HomeDish; locale: SupportedLocale }) {
  const t = useTranslations("storefront.home");
  return (
    <Paper
      component="article"
      variant="outlined"
      sx={{ overflow: "hidden", borderRadius: 4, height: "100%" }}
    >
      <ImageTile image={dish.image} height={210} />
      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        <Typography component="h3" variant="h6">
          {dish.name}
        </Typography>
        {dish.excerpt && (
          <Typography color="text.secondary" sx={{ minHeight: 40 }}>
            {dish.excerpt}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
          <Typography color="primary" sx={{ fontWeight: 800 }}>
            {formatEuro(dish.priceCents, locale)}
          </Typography>
          {dish.originalPriceCents !== null && (
            <Typography component="s" color="text.secondary" variant="body2">
              {formatEuro(dish.originalPriceCents, locale)}
            </Typography>
          )}
        </Stack>
        <Button
          href={`/menu/${dish.slug}`}
          aria-label={`${t("viewDish")}: ${dish.name}`}
          variant="contained"
          size="small"
        >
          {t("viewDish")}
        </Button>
      </Stack>
    </Paper>
  );
}

function SectionHeading({
  title,
  href,
  action,
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <Stack
      direction="row"
      sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2 }}
    >
      <Typography component="h2" variant="h4" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      {href && action && <Button href={href}>{action}</Button>}
    </Stack>
  );
}

export function HomePage({ content = EMPTY_HOME_CONTENT }: { content?: HomeContent }) {
  const t = useTranslations("storefront.home");
  const locale = useLocale() as SupportedLocale;
  return (
    <Box sx={{ pb: { xs: 7, md: 12 }, bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 } }}>
        <HomeHero
          slides={content.hero}
          fallback={{
            eyebrow: t("eyebrow"),
            title: t("title"),
            description: t("description"),
            action: t("browseMenu"),
          }}
        />
        {content.banners.length > 0 && (
          <Box
            component="section"
            aria-label={t("banners")}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 2,
              mt: 3,
            }}
          >
            {content.banners.map((banner) => (
              <Paper
                key={banner.id}
                component="a"
                href={banner.link.href}
                {...(banner.link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                sx={{
                  position: "relative",
                  display: "block",
                  overflow: "hidden",
                  borderRadius: 4,
                  color: "common.white",
                }}
              >
                <ImageTile image={banner.image} height={180} />
                {banner.title && (
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      position: "absolute",
                      insetInlineStart: 20,
                      insetBlockEnd: 20,
                      textShadow: "0 2px 10px #222",
                    }}
                  >
                    {banner.title}
                  </Typography>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Container>

      {content.featured.length > 0 && (
        <Container component="section" maxWidth="lg" sx={{ mt: { xs: 7, md: 10 } }}>
          <SectionHeading
            title={content.titles?.featured ?? t("featured")}
            href="/menu"
            action={t("viewAll")}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2.5,
            }}
          >
            {content.featured.slice(0, 6).map((dish) => (
              <DishCard key={dish.id} dish={dish} locale={locale} />
            ))}
          </Box>
        </Container>
      )}
      {content.discounted.length > 0 && (
        <Container component="section" maxWidth="lg" sx={{ mt: { xs: 7, md: 10 } }}>
          <SectionHeading
            title={content.titles?.discounted ?? t("discounted")}
            href="/menu?discounted=true"
            action={t("viewAll")}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2.5,
            }}
          >
            {content.discounted.map((dish) => (
              <DishCard key={dish.id} dish={dish} locale={locale} />
            ))}
          </Box>
        </Container>
      )}
      {content.categories.length > 0 && (
        <Container component="section" maxWidth="lg" sx={{ mt: { xs: 7, md: 10 } }}>
          <SectionHeading
            title={content.titles?.categories ?? t("categories")}
            href="/menu"
            action={t("viewAll")}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
              gap: 2,
            }}
          >
            {content.categories.map((category) => (
              <Paper
                key={category.id}
                component="a"
                href={`/menu/category/${category.slug}`}
                aria-label={category.name}
                variant="outlined"
                sx={{
                  overflow: "hidden",
                  borderRadius: 4,
                  color: "text.primary",
                  textDecoration: "none",
                  "&:hover": { boxShadow: 3 },
                }}
              >
                <ImageTile image={category.image} height={160} />
                <Typography component="h3" variant="h6" sx={{ p: 2 }}>
                  {category.name}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      )}
      {content.benefits.length > 0 && (
        <Box
          component="section"
          sx={{ mt: { xs: 7, md: 10 }, py: { xs: 6, md: 8 }, bgcolor: "background.paper" }}
        >
          <Container maxWidth="lg">
            <SectionHeading title={content.titles?.benefits ?? t("benefits")} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                gap: 2,
              }}
            >
              {content.benefits.map((benefit) => (
                <Stack
                  key={benefit.id}
                  spacing={1.5}
                  sx={{
                    alignItems: "center",
                    textAlign: "center",
                    p: 2.5,
                    borderRadius: 4,
                    bgcolor: "background.default",
                  }}
                >
                  {benefit.icon ? (
                    <Box
                      component="img"
                      src={benefit.icon.url}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                    />
                  ) : (
                    <Typography aria-hidden="true" color="primary" variant="h4">
                      ✦
                    </Typography>
                  )}
                  <Typography component="h3" variant="h6">
                    {benefit.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {benefit.description}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Container>
        </Box>
      )}
      {content.testimonials.length > 0 && (
        <Container component="section" maxWidth="lg" sx={{ mt: { xs: 7, md: 10 } }}>
          <SectionHeading title={content.titles?.testimonials ?? t("testimonials")} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: 2,
            }}
          >
            {content.testimonials.map((item) => (
              <Paper
                key={item.id}
                component="figure"
                variant="outlined"
                sx={{ m: 0, p: 3, borderRadius: 4 }}
              >
                <Typography color="primary" aria-label={t("rating", { count: item.rating })}>
                  {"★".repeat(item.rating)}
                </Typography>
                <Typography component="blockquote" sx={{ m: 0, my: 2 }}>
                  {item.quote}
                </Typography>
                <Typography component="figcaption" sx={{ fontWeight: 700 }}>
                  {item.author}
                  {item.role ? ` · ${item.role}` : ""}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Container>
      )}
      {content.blogs.length > 0 && (
        <Container component="section" maxWidth="lg" sx={{ mt: { xs: 7, md: 10 } }}>
          <SectionHeading
            title={content.titles?.blog ?? t("blog")}
            href="/blog"
            action={t("viewAll")}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2.5,
            }}
          >
            {content.blogs.map((blog) => (
              <Paper
                key={blog.id}
                component="article"
                variant="outlined"
                sx={{ overflow: "hidden", borderRadius: 4 }}
              >
                <ImageTile image={blog.image} height={180} />
                <Stack spacing={1} sx={{ p: 2.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t("readTime", { count: blog.readTimeMinutes })}
                  </Typography>
                  <Typography component="h3" variant="h6">
                    {blog.title}
                  </Typography>
                  <Typography color="text.secondary">{blog.excerpt}</Typography>
                  <Button href={`/blog/${blog.slug}`} sx={{ alignSelf: "start" }}>
                    {t("readPost")}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Container>
      )}
    </Box>
  );
}
