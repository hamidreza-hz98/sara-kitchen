import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { type SupportedLocale } from "@/constants";
import { resolveTranslation } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { isPublishedBlogSlug } from "@/server/modules/blogs";
import { isPublishedCategorySlug } from "@/server/modules/categories";
import { isAvailableDishSlug } from "@/server/modules/dishes";
import { findSeoMetadataByPath } from "@/server/modules/seo";

import { resolveStorefrontMetadata, resolveStorefrontStructuredData } from "../storefront-metadata";
import { StructuredDataScript } from "../structured-data-script";

export type PublicEntityKind = "category" | "dish" | "blog";

function pathFor(kind: PublicEntityKind, slug: string): string {
  if (kind === "category") return `/menu/category/${slug}`;
  return kind === "dish" ? `/menu/${slug}` : `/blog/${slug}`;
}

async function loadEntity(kind: PublicEntityKind, slug: string, locale: SupportedLocale) {
  const connection = await connectToDatabase();
  const visible =
    kind === "category"
      ? await isPublishedCategorySlug(connection, slug)
      : kind === "dish"
        ? await isAvailableDishSlug(connection, slug)
        : await isPublishedBlogSlug(connection, slug);
  if (!visible) return null;
  const path = pathFor(kind, slug);
  const record = await findSeoMetadataByPath(connection, path);
  const translation = record ? resolveTranslation(record.translations, locale) : null;
  return record && translation
    ? { path, title: translation.value.title, description: translation.value.description }
    : null;
}

export async function entityPageMetadata(
  kind: PublicEntityKind,
  slug: string,
  locale: SupportedLocale,
): Promise<Metadata> {
  const entity = await loadEntity(kind, slug, locale);
  if (!entity) return {};
  return resolveStorefrontMetadata(entity.path, locale, entity);
}

export async function EntitySeoPage({
  kind,
  slug,
  locale,
}: Readonly<{ kind: PublicEntityKind; slug: string; locale: SupportedLocale }>) {
  const entity = await loadEntity(kind, slug, locale);
  if (!entity) notFound();
  const structuredData = await resolveStorefrontStructuredData(
    entity.path,
    locale,
    entity,
    kind === "dish"
      ? ["web-page", "product", "menu-item", "breadcrumb-list"]
      : kind === "blog"
        ? ["web-page", "article", "breadcrumb-list"]
        : ["web-page", "menu", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <Box component="main" id="main-content" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Typography component="h1" variant="h1">
            {entity.title}
          </Typography>
          <Typography sx={{ mt: 3 }} variant="body1">
            {entity.description}
          </Typography>
        </Container>
      </Box>
    </>
  );
}
