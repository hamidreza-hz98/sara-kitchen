import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import {
  resolveStorefrontMetadata,
  resolveStorefrontStructuredData,
} from "../../storefront-metadata";
import { StructuredDataScript } from "../../structured-data-script";
import { loadAboutContent } from "./about-data";
import { AboutPage } from "./about-page";

type AboutPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const [content, t] = await Promise.all([
    loadAboutContent(locale),
    getTranslations({ locale, namespace: "storefront.about" }),
  ]);
  return resolveStorefrontMetadata("/about", locale, {
    title: content?.title ?? t("title"),
    description: content?.summary ?? t("summary"),
  });
}

export default async function About({ params }: AboutPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const [content, t] = await Promise.all([
    loadAboutContent(locale),
    getTranslations({ locale, namespace: "storefront.about" }),
  ]);
  const structuredData = await resolveStorefrontStructuredData(
    "/about",
    locale,
    {
      title: content?.title ?? t("title"),
      description: content?.summary ?? t("summary"),
    },
    ["web-page", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <AboutPage content={content} />
    </>
  );
}
