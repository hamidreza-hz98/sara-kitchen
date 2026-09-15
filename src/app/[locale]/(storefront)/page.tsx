import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

import { DirectionalIcon } from "@/components";

export default function Home() {
  const translations = useTranslations("storefront.home");

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 6, sm: 9, lg: 14 },
        backgroundImage:
          "linear-gradient(135deg, rgba(255, 97, 97, 0.045) 25%, transparent 25%, transparent 75%, rgba(255, 97, 97, 0.045) 75%)",
        backgroundSize: "48px 48px",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          sx={{
            position: "relative",
            overflow: "hidden",
            minHeight: { xs: 420, lg: 500 },
            display: "flex",
            alignItems: "center",
            p: { xs: 7, sm: 10, lg: 14 },
            borderRadius: { xs: 6, lg: 8 },
            bgcolor: "primary.main",
            color: "primary.contrastText",
            boxShadow: 4,
            "&::after": {
              content: '\"\"',
              position: "absolute",
              width: { xs: 240, lg: 420 },
              height: { xs: 240, lg: 420 },
              insetInlineEnd: { xs: -110, lg: -100 },
              insetBlockEnd: { xs: -120, lg: -180 },
              borderRadius: "50%",
              bgcolor: "secondary.main",
              opacity: 0.72,
            },
          }}
        >
          <Stack spacing={4} sx={{ position: "relative", zIndex: 1, maxWidth: 690 }}>
            <Typography
              component="p"
              sx={{ fontWeight: 800, letterSpacing: "0.08em" }}
              variant="overline"
            >
              {translations("eyebrow")}
            </Typography>
            <Typography component="h1" variant="h1">
              {translations("title")}
            </Typography>
            <Typography sx={{ maxWidth: 600 }} variant="body1">
              {translations("description")}
            </Typography>
            <Box>
              <Button
                color="secondary"
                endIcon={
                  <DirectionalIcon mirrorInRtl>
                    <ArrowForwardRounded />
                  </DirectionalIcon>
                }
                href="/theme-showcase"
                size="large"
                variant="contained"
              >
                {translations("showcase")}
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
