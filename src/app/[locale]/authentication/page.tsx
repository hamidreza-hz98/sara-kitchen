import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const dashboard = await getTranslations("dashboard");
  return { title: dashboard("title"), robots: { index: false, follow: false } };
}

export default async function AuthenticationPage() {
  const dashboard = await getTranslations("dashboard");
  return (
    <Container maxWidth="sm" sx={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
      <Box
        sx={{
          p: 6,
          bgcolor: "background.paper",
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography component="h1" variant="h2" sx={{ mb: 4 }}>
          {dashboard("title")}
        </Typography>
        <Alert severity="info">{dashboard("shell.authPending")}</Alert>
      </Box>
    </Container>
  );
}
