import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { getTranslations } from "next-intl/server";

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard.overview");
  return (
    <Box role="status" aria-label={t("loading")} sx={{ pb: 6 }}>
      <Skeleton variant="text" width={300} height={58} />
      <Skeleton variant="text" width={380} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          gap: 2.5,
          my: 3,
        }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Paper key={index} sx={{ p: 3, borderRadius: 3 }}>
            <Skeleton variant="rounded" width={42} height={42} />
            <Skeleton sx={{ mt: 2 }} />
            <Skeleton variant="text" height={38} />
          </Paper>
        ))}
      </Box>
      <Stack sx={{ gap: 3 }}>
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
      </Stack>
    </Box>
  );
}
