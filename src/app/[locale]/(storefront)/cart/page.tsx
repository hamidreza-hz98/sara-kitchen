import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";

import { CartStepOne } from "./cart-step-one";

type CartPageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "storefront.cart" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params }: CartPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  return <CartStepOne />;
}
