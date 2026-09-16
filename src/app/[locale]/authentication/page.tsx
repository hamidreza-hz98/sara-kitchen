import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminLoginForm } from "./admin-login-form";

export async function generateMetadata(): Promise<Metadata> {
  const auth = await getTranslations("dashboard.auth");
  return { title: auth("title"), robots: { index: false, follow: false } };
}

export default async function AuthenticationPage() {
  const auth = await getTranslations("dashboard.auth");
  return (
    <Container maxWidth="sm" sx={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
      <Box
        sx={{
          p: { xs: 4, sm: 6 },
          bgcolor: "background.paper",
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography component="h1" variant="h2" sx={{ mb: 2 }}>
          {auth("title")}
        </Typography>
        <Typography sx={{ mb: 4, color: "text.secondary" }}>{auth("description")}</Typography>
        <AdminLoginForm />
      </Box>
    </Container>
  );
}
