import { requireAdminPage } from "@/server/auth/page-guards";

import { BlogEditor } from "./blog-editor";

export default async function BlogModifyPage() {
  const admin = await requireAdminPage("blogs:read");
  const permissions = new Set(admin.permissions);

  return (
    <BlogEditor
      canCreate={permissions.has("blogs:create")}
      canPublish={permissions.has("blogs:publish")}
      canUpdate={permissions.has("blogs:update")}
      canUploadMedia={permissions.has("media:create")}
    />
  );
}
