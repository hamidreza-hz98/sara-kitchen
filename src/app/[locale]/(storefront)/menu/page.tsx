import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import {
  resolveStorefrontMetadata,
  resolveStorefrontStructuredData,
} from "../../storefront-metadata";
import { StructuredDataScript } from "../../structured-data-script";
import { loadMenuContent } from "./menu-data";
import { MenuPage } from "./menu-page";
import { parseMenuQuery, type MenuSearchParams } from "./menu-query";

type MenuPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<MenuSearchParams>;
}>;

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  await connection();
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.menu" });
  return resolveStorefrontMetadata("/menu", locale, {
    title: t("title"),
    description: t("description"),
  });
}

export default async function Menu({ params, searchParams }: MenuPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const query = parseMenuQuery(await searchParams);
  const [content, t] = await Promise.all([
    loadMenuContent(locale, query),
    getTranslations({ locale, namespace: "storefront.menu" }),
  ]);
  const structuredData = await resolveStorefrontStructuredData(
    "/menu",
    locale,
    { title: t("title"), description: t("description") },
    ["web-page", "menu", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <MenuPage content={content} query={query} />
    </>
  );
}
