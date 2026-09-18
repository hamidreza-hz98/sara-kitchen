import { requireAdminPage } from "@/server/auth/page-guards";

import { MediaUploadPage } from "./upload-page";

export default async function DashboardMediaUploadPage() {
  await requireAdminPage("media:create");
  return <MediaUploadPage />;
}
