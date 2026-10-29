import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import {
  resolveStorefrontMetadata,
  resolveStorefrontStructuredData,
} from "../../../storefront-metadata";
import { StructuredDataScript } from "../../../structured-data-script";

import { loadBlogDetailContent } from "./blog-detail-data";
import { BlogDetailPage } from "./blog-detail-page";

type BlogPageProps = Readonly<{ params: Promise<{ locale: string; blogSlug: string }> }>;

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  await connection();
  const { locale, blogSlug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const article = await loadBlogDetailContent(blogSlug, locale);
  return resolveStorefrontMetadata(`/blog/${article.slug}`, locale, {
    title: article.title,
    description: article.excerpt,
  });
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale, blogSlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const article = await loadBlogDetailContent(blogSlug, locale);
  const structuredData = await resolveStorefrontStructuredData(
    `/blog/${article.slug}`,
    locale,
    { title: article.title, description: article.excerpt },
    ["web-page", "article", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <BlogDetailPage article={article} />
    </>
  );
}
