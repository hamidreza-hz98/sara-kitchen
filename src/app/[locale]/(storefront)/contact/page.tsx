import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";

import {
  resolveStorefrontMetadata,
  resolveStorefrontStructuredData,
} from "../../storefront-metadata";
import { StructuredDataScript } from "../../structured-data-script";
import { loadContactPageData } from "./contact-data";
import { ContactPage } from "./contact-page";

type ContactPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.contact" });
  return resolveStorefrontMetadata("/contact", locale, {
    title: t("title"),
    description: t("intro"),
  });
}

export default async function Contact({ params }: ContactPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const [data, t] = await Promise.all([
    loadContactPageData(locale),
    getTranslations({ locale, namespace: "storefront.contact" }),
  ]);
  const structuredData = await resolveStorefrontStructuredData(
    "/contact",
    locale,
    { title: t("title"), description: t("intro") },
    ["web-page", "breadcrumb-list"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <ContactPage data={data} />
    </>
  );
}
