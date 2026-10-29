import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import { resolveStorefrontMetadata } from "../../../storefront-metadata";
import { StructuredDataScript } from "../../../structured-data-script";

import { loadDishDetailContent } from "./dish-detail-data";
import { DishDetailPage } from "./dish-detail-page";
import { dishDetailStructuredData } from "./dish-detail-structured-data";

type DishPageProps = Readonly<{ params: Promise<{ locale: string; dishSlug: string }> }>;

export async function generateMetadata({ params }: DishPageProps): Promise<Metadata> {
  await connection();
  const { locale, dishSlug } = await params;
  if (!isSupportedLocale(locale)) return {};
  const dish = await loadDishDetailContent(dishSlug, locale);
  return resolveStorefrontMetadata(`/menu/${dish.slug}`, locale, {
    title: dish.name,
    description: dish.excerpt || dish.name,
  });
}

export default async function DishPage({ params }: DishPageProps) {
  const { locale, dishSlug } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const dish = await loadDishDetailContent(dishSlug, locale);
  const t = await getTranslations({ locale, namespace: "storefront.dishDetail" });
  return (
    <>
      <StructuredDataScript
        data={dishDetailStructuredData(dish, undefined, { home: t("home"), menu: t("menu") })}
      />
      <DishDetailPage dish={dish} />
    </>
  );
}
