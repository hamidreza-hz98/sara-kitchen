import type { ReactNode } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { ProfileShell } from "@/components/profile/profile-shell";
import { requireCustomerPage } from "@/server/auth/page-guards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProtectedProfileLayout({ children }: { children: ReactNode }) {
  const requestedPath = (await headers()).get("x-sara-kitchen-public-path") ?? "/profile";
  await requireCustomerPage(requestedPath);
  return <ProfileShell>{children}</ProfileShell>;
}
