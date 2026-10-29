import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import {
  resolveStorefrontMetadata,
  resolveStorefrontStructuredData,
} from "../../storefront-metadata";
import { StructuredDataScript } from "../../structured-data-script";
import { loadBlogIndex } from "./blog-data";
import { BlogIndexPage } from "./blog-page";
import { blogHref, parseBlogQuery, type BlogSearchParams } from "./blog-query";

type BlogPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<BlogSearchParams>;
}>;

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  await connection();
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.blog" });
  return resolveStorefrontMetadata("/blog", locale, {
    title: t("title"),
    description: t("description"),
  });
}

export default async function Blog({ params, searchParams }: BlogPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const { query, canonical } = parseBlogQuery(await searchParams);
  if (!canonical) redirect(blogHref(query));
  const [content, t] = await Promise.all([
    loadBlogIndex(locale, query),
    getTranslations({ locale, namespace: "storefront.blog" }),
  ]);
  if (query.page > 1 && query.page > content.totalPages) redirect(blogHref(query, { page: 1 }));
  const structuredData = await resolveStorefrontStructuredData(
    "/blog",
    locale,
    { title: t("title"), description: t("description") },
    ["web-page", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <BlogIndexPage content={content} query={query} />
    </>
  );
}
