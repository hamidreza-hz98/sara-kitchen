import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/constants";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { customerOrderListQuerySchema, listCustomerOrders } from "@/server/modules/orders";

import { CustomerOrderList } from "./customer-order-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CustomerOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: candidate }, raw] = await Promise.all([params, searchParams]);
  const locale = isSupportedLocale(candidate) ? candidate : "en";
  const actor = await requireCustomerPage("/profile/orders");
  const parsed = customerOrderListQuerySchema.safeParse(raw);
  if (!parsed.success) notFound();
  const query = parsed.data;
  const page = await listCustomerOrders(await connectToDatabase(), {
    customerId: actor.id,
    tab: query.tab,
    page: query.page,
    pageSize: 8,
    ...(query.status ? { status: query.status } : {}),
  });
  return (
    <CustomerOrderList locale={locale} page={page} tab={query.tab} status={query.status ?? null} />
  );
}
