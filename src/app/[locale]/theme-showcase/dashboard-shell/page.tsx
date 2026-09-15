import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";

export default async function DashboardShellPreviewPage() {
  const shell = await getTranslations("dashboard.shell");
  return (
    <>
      <Typography component="h1" variant="h2" sx={{ mb: 2 }}>
        {shell("previewTitle")}
      </Typography>
      <Typography color="text.secondary">{shell("previewDescription")}</Typography>
    </>
  );
}
