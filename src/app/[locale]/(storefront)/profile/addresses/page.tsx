import type { Metadata } from "next";

import { requireCustomerPage } from "@/server/auth/page-guards";

import { CustomerAddressManager } from "./customer-address-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfileAddressesPage() {
  await requireCustomerPage("/profile/addresses");
  return <CustomerAddressManager />;
}
