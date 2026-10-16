import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";
import { formatDate, formatEuro, formatNumber } from "@/locales";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { readCustomerProfileOrders } from "@/server/modules/orders";
import { readCustomerLifetimeSpend } from "@/server/modules/transactions";

import { loadHomeContent } from "../home-data";
import { ProfileOverview } from "./profile-overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: candidate } = await params;
  const locale = isSupportedLocale(candidate) ? candidate : "en";
  const actor = await requireCustomerPage("/profile");
  const connection = await connectToDatabase();
  const [orders, spend, home, t] = await Promise.all([
    readCustomerProfileOrders(connection, actor.id),
    readCustomerLifetimeSpend(connection, actor.id),
    loadHomeContent(locale).catch(() => null),
    getTranslations({ locale, namespace: "profile" }),
  ]);
  const offer = home?.discounted[0] ?? null;

  return (
    <ProfileOverview
      labels={{
        title: t("title"),
        intro: t("summary.intro"),
        totalOrders: t("summary.totalOrders"),
        totalSpent: t("summary.totalSpent"),
        lastOrder: t("summary.lastOrder"),
        noOrders: t("summary.noOrders"),
        latestOrderStatus: orders.latestOrder
          ? t(`summary.status.${orders.latestOrder.status}`)
          : "",
        viewOrder: t("summary.viewOrder"),
        specialOffer: t("summary.specialOffer"),
        exploreOffer: t("summary.exploreOffer"),
        shortcuts: t("summary.shortcuts"),
        orders: t("orders"),
        addresses: t("addresses"),
        information: t("information"),
        menu: t("summary.browseMenu"),
      }}
      totalOrders={formatNumber(orders.totalOrders, locale)}
      totalSpent={formatEuro(spend.netCents, locale)}
      latestOrder={
        orders.latestOrder
          ? {
              code: orders.latestOrder.code,
              date: formatDate(new Date(orders.latestOrder.createdAt), locale),
              price: formatEuro(orders.latestOrder.totalCents, locale),
            }
          : null
      }
      offer={
        offer
          ? {
              slug: offer.slug,
              name: offer.name,
              price: formatEuro(offer.priceCents, locale),
              originalPrice: offer.originalPriceCents
                ? formatEuro(offer.originalPriceCents, locale)
                : null,
            }
          : null
      }
    />
  );
}
