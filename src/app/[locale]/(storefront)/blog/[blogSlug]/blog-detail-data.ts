import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import type { SupportedLocale } from "@/constants";
import { sanitizeRichTextDocument, type RichTextNode } from "@/lib/rich-text";
import { resolveTranslation } from "@/locales/translation-selection";
import { connectToDatabase } from "@/server/database";
import { getApplicationSiteUrl } from "@/server/environment";
import { createBlogRepository } from "@/server/modules/blogs";
import { calculateDishPrice, createDishRepository } from "@/server/modules/dishes";
import {
  createMediaReadRepository,
  createMinioStorageProvider,
  getMediaDetail,
  resolveStorefrontMediaImage,
} from "@/server/modules/media";
import { findSeoMetadataByPath } from "@/server/modules/seo";

import type { BlogDetailContent, BlogDetailImage, BlogEmbeddedMedia } from "./blog-detail-content";

function collectMediaIds(
  nodes: readonly RichTextNode[] | undefined,
  ids = new Map<string, "image" | "video">(),
) {
  for (const node of nodes ?? []) {
    if (node.type === "media") ids.set(node.attrs.mediaId, node.attrs.kind);
    else if ("content" in node) collectMediaIds(node.content, ids);
  }
  return ids;
}

export const loadBlogDetailContent = cache(async function readBlogDetailContent(
  slug: string,
  locale: SupportedLocale,
): Promise<BlogDetailContent> {
  const connection = await connectToDatabase();
  const blogs = createBlogRepository(connection);
  const article = await blogs.findBySlug(slug, true);
  if (!article || !article.publishedAt) notFound();
  const translation = resolveTranslation(article.translations, locale)?.value;
  if (!translation) notFound();
  const content = sanitizeRichTextDocument(translation.content.document);
  const storage = createMinioStorageProvider();
  const image = async (
    id: string | null,
    alt: string,
    size: "display" | "thumbnail",
  ): Promise<BlogDetailImage | null> => {
    if (!id) return null;
    try {
      const found = await resolveStorefrontMediaImage(connection, storage, id, locale, size);
      return found ? { url: found.url, alt: found.alt || alt } : null;
    } catch {
      return null;
    }
  };
  const mediaRepository = createMediaReadRepository(connection);
  const embeddedEntries = await Promise.all(
    [...collectMediaIds(content.content)].map(async ([id, kind]) => {
      try {
        if (kind === "image") {
          const found = await image(id, "", "display");
          return found ? ([id, { kind, url: found.url }] as const) : null;
        }
        const detail = await getMediaDetail(mediaRepository, storage, id);
        return detail?.kind === "video" && detail.processingState === "ready" && detail.original
          ? ([id, { kind, url: detail.original.url }] as const)
          : null;
      } catch {
        return null;
      }
    }),
  );
  const embeddedMedia = Object.fromEntries(
    embeddedEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  ) as Record<string, BlogEmbeddedMedia>;
  const dishes = createDishRepository(connection);
  const [relatedDishRecords, relatedBlogRecords, banner, seo] = await Promise.all([
    Promise.all(article.relatedDishIds.slice(0, 4).map((id) => dishes.findById(id))),
    Promise.all(article.relatedBlogIds.slice(0, 4).map((id) => blogs.findById(id))),
    image(article.bannerMediaId ?? article.imageMediaId, translation.title, "display"),
    findSeoMetadataByPath(connection, `/blog/${article.slug}`),
  ]);
  const now = new Date();
  const relatedDishes = (
    await Promise.all(
      relatedDishRecords.map(async (record) => {
        if (!record || record.status !== "published" || record.deletedAt) return null;
        const available =
          record.availability.mode === "available" ||
          (record.availability.mode === "scheduled" &&
            (!record.availability.availableFrom || record.availability.availableFrom <= now) &&
            (!record.availability.availableUntil || record.availability.availableUntil > now));
        if (!available) return null;
        const translated = resolveTranslation(record.translations, locale)?.value;
        if (!translated) return null;
        return {
          slug: record.slug,
          name: translated.name,
          image: await image(record.mediaIds[0] ?? null, translated.name, "thumbnail"),
          priceCents: calculateDishPrice({
            basePriceCents: record.basePriceCents,
            discount: record.discount,
            at: now,
          }).effectivePriceCents,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  const relatedBlogs = (
    await Promise.all(
      relatedBlogRecords.map(async (record) => {
        if (
          !record ||
          record.id === article.id ||
          record.status !== "published" ||
          record.deletedAt ||
          !record.publishedAt ||
          new Date(record.publishedAt) > now
        )
          return null;
        const translated = resolveTranslation(record.translations, locale)?.value;
        if (!translated) return null;
        return {
          slug: record.slug,
          title: translated.title,
          image: await image(
            record.imageMediaId ?? record.bannerMediaId,
            translated.title,
            "thumbnail",
          ),
          readTimeMinutes: record.readTimeMinutes,
        };
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  return {
    id: article.id,
    slug: article.slug,
    title: translation.title,
    excerpt: translation.excerpt,
    author: article.authorSnapshot.displayName,
    publishedAt: article.publishedAt,
    readTimeMinutes: article.readTimeMinutes,
    banner,
    content,
    embeddedMedia,
    relatedDishes,
    relatedBlogs,
    canonicalUrl:
      seo?.canonicalUrl ?? new URL(`/blog/${article.slug}`, getApplicationSiteUrl()).toString(),
  };
});
