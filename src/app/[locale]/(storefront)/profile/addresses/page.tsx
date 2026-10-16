import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfileAddressesPage() {
  const t = await getTranslations("profile");
  return (
    <Typography component="h1" variant="h2">
      {t("addresses")}
    </Typography>
  );
}
