import type { ReactNode } from "react";

import { requireCustomerPage } from "@/server/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function ProtectedProfileLayout({ children }: { children: ReactNode }) {
  await requireCustomerPage();
  return children;
}
