import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { getTranslations } from "next-intl/server";

import Link from "@/components/ui/client-next-link";

export default async function DashboardShellPreviewPage() {
  const shell = await getTranslations("dashboard.shell");
  return (
    <>
      <Typography component="h1" variant="h2" sx={{ mb: 2 }}>
        {shell("previewTitle")}
      </Typography>
      <Typography color="text.secondary">{shell("previewDescription")}</Typography>
      <Button component={Link} href="/theme-showcase" sx={{ mt: 2 }}>
        {shell("brand")}
      </Button>
    </>
  );
}
