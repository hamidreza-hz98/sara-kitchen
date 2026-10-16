import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";

export default async function CustomerOrdersPage() {
  const t = await getTranslations("profile");
  return (
    <div>
      <Typography component="h1" variant="h2">
        {t("orders")}
      </Typography>
    </div>
  );
}
