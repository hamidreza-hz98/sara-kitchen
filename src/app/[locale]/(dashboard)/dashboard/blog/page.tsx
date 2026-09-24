import { requireAdminPage } from "@/server/auth/page-guards";

import { BlogList } from "./blog-list";

export default async function DashboardBlogPage() {
  const admin = await requireAdminPage("blogs:read");

  return (
    <BlogList
      canArchive={admin.permissions.includes("blogs:delete")}
      canCreate={admin.permissions.includes("blogs:create")}
      canPublish={admin.permissions.includes("blogs:publish")}
      canUpdate={admin.permissions.includes("blogs:update")}
    />
  );
}
