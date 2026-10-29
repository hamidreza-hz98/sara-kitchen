import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { requireAdminPage } from "@/server/auth/page-guards";

import { SETTINGS_PAGE_REGISTRY, SETTINGS_PAGE_SECTIONS } from "./settings-section-registry";

export default async function SettingsIndexPage() {
  await requireAdminPage("settings:read");
  const t = await getTranslations("dashboard.settingsEditor");
  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" variant="h4">
          {t("title")}
        </Typography>
        <Typography color="text.secondary">{t("indexDescription")}</Typography>
      </div>
      <Grid container spacing={2}>
        {SETTINGS_PAGE_SECTIONS.map((key) => {
          const definition = SETTINGS_PAGE_REGISTRY[key];
          return (
            <Grid key={key} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardActionArea
                  component={Link}
                  href={`/dashboard/settings/${key}`}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                        <Typography variant="h6">{t(`sections.${key}`)}</Typography>
                        <ArrowForwardRounded color="primary" />
                      </Stack>
                      <Typography color="text.secondary">{t(`descriptions.${key}`)}</Typography>
                      <Chip
                        label={t(`policy.${definition.policy}`)}
                        size="small"
                        variant="outlined"
                        sx={{ alignSelf: "flex-start" }}
                      />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
}
