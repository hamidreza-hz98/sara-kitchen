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
import { formatEuro, formatNumber } from "@/locales/formatters";

import type { DishDetailContent, DishDetailImage } from "./dish-detail-content";
import { DishGallery, DishPurchase } from "./dish-interactions";

function DetailImage({ image, height = 180 }: { image: DishDetailImage | null; height?: number }) {
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

export function DishDetailPage({ dish }: { dish: DishDetailContent }) {
  const t = useTranslations("storefront.dishDetail");
  const menu = useTranslations("storefront.menu");
  const locale = useLocale() as SupportedLocale;
  return (
    <Box sx={{ bgcolor: "background.default", pb: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 } }}>
        <Box
          component="nav"
          aria-label={t("breadcrumbs")}
          sx={{ mb: 3, display: "flex", flexWrap: "wrap", gap: 1 }}
        >
          <Link href="/">{t("home")}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/menu">{t("menu")}</Link>
          {dish.category && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/menu/category/${dish.category.slug}`}>{dish.category.name}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{dish.name}</span>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(0, 0.8fr)" },
            gap: { xs: 4, md: 6 },
            alignItems: "start",
          }}
        >
          <DishGallery images={dish.images} name={dish.name} />
          <DishPurchase dish={dish} />
        </Box>
        {dish.ingredients.length > 0 && (
          <Box
            component="section"
            aria-labelledby="dish-ingredients"
            sx={{ mt: { xs: 7, md: 10 } }}
          >
            <Typography
              component="h2"
              id="dish-ingredients"
              variant="h4"
              sx={{ mb: 3, fontWeight: 800 }}
            >
              {t("ingredients")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {dish.ingredients.map((ingredient, index) => (
                <Paper
                  key={`${ingredient.name}-${index}`}
                  variant="outlined"
                  sx={{ overflow: "hidden", borderRadius: 3 }}
                >
                  <DetailImage image={ingredient.image} height={120} />
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 700 }}>{ingredient.name}</Typography>
                    {ingredient.quantityAmount !== null && ingredient.quantityUnit && (
                      <Typography color="text.secondary" variant="body2">
                        {formatNumber(ingredient.quantityAmount, locale)}{" "}
                        {t(
                          `ingredientUnit.${ingredient.quantityUnit as "gram" | "millilitre" | "piece" | "teaspoon" | "tablespoon"}`,
                        )}
                      </Typography>
                    )}
                    {ingredient.note && (
                      <Typography color="text.secondary" variant="body2">
                        {ingredient.note}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
        {(dish.allergens.contains.length > 0 ||
          dish.allergens.mayContain.length > 0 ||
          dish.dietaryTags.length > 0) && (
          <Paper component="section" variant="outlined" sx={{ mt: 4, p: 3, borderRadius: 3 }}>
            <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              {t("dietaryAndAllergens")}
            </Typography>
            {dish.dietaryTags.length > 0 && (
              <Typography>
                {t("dietary")}:{" "}
                {dish.dietaryTags
                  .map((tag) => menu(`dietaryOptions.${tag as "vegetarian" | "vegan" | "halal"}`))
                  .join(", ")}
              </Typography>
            )}
            {dish.allergens.contains.length > 0 && (
              <Typography>
                {t("contains")}:{" "}
                {dish.allergens.contains
                  .map((tag) => menu(`allergens.${tag as "gluten"}`))
                  .join(", ")}
              </Typography>
            )}
            {dish.allergens.mayContain.length > 0 && (
              <Typography>
                {t("mayContain")}:{" "}
                {dish.allergens.mayContain
                  .map((tag) => menu(`allergens.${tag as "gluten"}`))
                  .join(", ")}
              </Typography>
            )}
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
              {t("allergenNotice")}
            </Typography>
          </Paper>
        )}
        {dish.description && (
          <Box
            component="section"
            aria-labelledby="dish-description"
            sx={{ mt: { xs: 7, md: 10 }, maxWidth: 840 }}
          >
            <Typography
              component="h2"
              id="dish-description"
              variant="h4"
              sx={{ fontWeight: 800, mb: 2 }}
            >
              {t("description")}
            </Typography>
            <RichContent content={dish.description} />
          </Box>
        )}
        {dish.specifications.length > 0 && (
          <Box component="section" aria-labelledby="dish-specifications" sx={{ mt: 7 }}>
            <Typography
              component="h2"
              id="dish-specifications"
              variant="h4"
              sx={{ fontWeight: 800, mb: 2 }}
            >
              {t("specifications")}
            </Typography>
            <Box
              component="dl"
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
                m: 0,
              }}
            >
              {dish.specifications.map((item, index) => (
                <Paper
                  component="div"
                  variant="outlined"
                  key={`${item.label}-${index}`}
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Typography component="dt" color="text.secondary" variant="body2">
                    {item.label}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>
                    {item.value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
        {dish.relatedDishes.length > 0 && (
          <Box component="section" aria-labelledby="dish-related" sx={{ mt: { xs: 8, md: 11 } }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
            >
              <Typography component="h2" id="dish-related" variant="h4" sx={{ fontWeight: 800 }}>
                {t("relatedDishes")}
              </Typography>
              <Button href="/menu">{t("viewAll")}</Button>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {dish.relatedDishes.map((item) => (
                <Paper
                  component="article"
                  variant="outlined"
                  key={item.slug}
                  sx={{ borderRadius: 3, overflow: "hidden" }}
                >
                  <DetailImage image={item.image} />
                  <Box sx={{ p: 2 }}>
                    <Typography component="h3" sx={{ fontWeight: 700 }}>
                      {item.name}
                    </Typography>
                    {item.excerpt && (
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                        {item.excerpt}
                      </Typography>
                    )}
                    <Typography color="primary" sx={{ mt: 1, fontWeight: 800 }}>
                      {formatEuro(item.priceCents, locale)}
                    </Typography>
                    <Button
                      href={`/menu/${item.slug}`}
                      size="small"
                      sx={{ mt: 1 }}
                      aria-label={`${t("viewDish")}: ${item.name}`}
                    >
                      {t("viewDish")}
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
        {dish.relatedBlogs.length > 0 && (
          <Box component="section" aria-labelledby="dish-blogs" sx={{ mt: { xs: 8, md: 11 } }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between", alignItems: "center", mb: 3 }}
            >
              <Typography component="h2" id="dish-blogs" variant="h4" sx={{ fontWeight: 800 }}>
                {t("relatedBlogs")}
              </Typography>
              <Button href="/blog">{t("readMore")}</Button>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {dish.relatedBlogs.map((item) => (
                <Paper
                  component="article"
                  variant="outlined"
                  key={item.slug}
                  sx={{ borderRadius: 3, overflow: "hidden", display: "flex" }}
                >
                  <Box sx={{ width: 130, flexShrink: 0 }}>
                    <DetailImage image={item.image} height={160} />
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography component="h3" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                      {item.excerpt}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {t("readTime", { minutes: formatNumber(item.readTimeMinutes, locale) })}
                    </Typography>
                    <Button
                      href={`/blog/${item.slug}`}
                      size="small"
                      sx={{ display: "block", mt: 1 }}
                      aria-label={`${t("readBlog")}: ${item.title}`}
                    >
                      {t("readBlog")}
                    </Button>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
