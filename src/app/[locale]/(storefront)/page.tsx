import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";
import { resolveStorefrontMetadata, resolveStorefrontStructuredData } from "../storefront-metadata";
import { StructuredDataScript } from "../structured-data-script";
import { HomePage } from "./home-page";

type HomePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const translations = await getTranslations({ locale, namespace: "storefront.metadata" });
  return resolveStorefrontMetadata("/", locale, {
    title: translations("title"),
    description: translations("description"),
  });
}

export default async function Home({ params }: HomePageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return <HomePage />;
  const translations = await getTranslations({ locale, namespace: "storefront.metadata" });
  const structuredData = await resolveStorefrontStructuredData(
    "/",
    locale,
    { title: translations("title"), description: translations("description") },
    ["web-page", "website", "organization"],
  );
  return (
    <>
      <StructuredDataScript data={structuredData} />
      <HomePage />
    </>
  );
}
