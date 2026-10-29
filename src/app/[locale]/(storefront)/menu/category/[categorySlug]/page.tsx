import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { entityPageMetadata } from "../../../entity-seo-page";
import { resolveStorefrontStructuredData } from "../../../../storefront-metadata";
import { StructuredDataScript } from "../../../../structured-data-script";
import { loadMenuContent } from "../../menu-data";
import { MenuPage } from "../../menu-page";
import { parseMenuQuery, type MenuSearchParams } from "../../menu-query";

type CategoryPageProps = Readonly<{
  params: Promise<{ locale: string; categorySlug: string }>;
  searchParams: Promise<MenuSearchParams>;
}>;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  await connection();
  const { locale, categorySlug } = await params;
  return isSupportedLocale(locale) ? entityPageMetadata("category", categorySlug, locale) : {};
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, categorySlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const query = parseMenuQuery({ ...(await searchParams), category: categorySlug });
  const content = await loadMenuContent(locale, query, categorySlug);
  const title = content.selectedCategory?.name ?? categorySlug;
  const description = content.selectedCategory?.description ?? "";
  const structuredData = await resolveStorefrontStructuredData(
    `/menu/category/${categorySlug}`,
    locale,
    { title, description },
    ["web-page", "menu", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <MenuPage content={content} query={query} />
    </>
  );
}
