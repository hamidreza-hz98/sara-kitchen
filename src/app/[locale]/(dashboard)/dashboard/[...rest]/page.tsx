import { notFound } from "next/navigation";

import { requireDashboardPage } from "@/server/auth/page-guards";

// Every deep link resolves its own permission, independent of navigation visibility.
// Unimplemented pages remain 404 after the access check.
export default async function DashboardDeepLinkPage({
  params,
}: {
  params: Promise<{ rest: string[] }>;
}) {
  await requireDashboardPage((await params).rest);
  notFound();
}
