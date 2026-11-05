import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

import { isRtlLocale, type SupportedLocale } from "@/constants";
import { LiquidGlass } from "@/components/ui/liquid-glass";

export function AuthenticationFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const locale = useLocale() as SupportedLocale;
  const rtl = isRtlLocale(locale);

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        minHeight: { xs: 0, md: "min(820px, calc(100svh - 84px))" },
        py: { xs: 2, md: 5 },
        bgcolor: "#f4eee7",
        "html.dark &": { bgcolor: "#221c1b" },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: { xs: "relative", md: "absolute" },
          insetBlock: { md: 0 },
          insetInlineStart: { md: 0 },
          zIndex: -1,
          width: "100%",
          height: { xs: 245, md: "100%" },
          backgroundImage:
            "linear-gradient(90deg, rgba(33,23,21,.04), rgba(33,23,21,0)), url('/images/authentication/persian-table.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      />
      <Container
        maxWidth="lg"
        sx={{
          position: { xs: "relative", md: "absolute" },
          insetBlock: { md: 0 },
          insetInline: { md: 0 },
          display: "flex",
          direction: { md: "ltr" },
          justifyContent: { md: "flex-end" },
          alignItems: "center",
          px: { xs: 2, md: 3 },
          mt: { xs: -4, md: 0 },
        }}
      >
        <LiquidGlass
          component="section"
          aria-labelledby="authentication-title"
          dir={rtl ? "rtl" : "ltr"}
          intensity="strong"
          sx={{
            width: "100%",
            maxWidth: { xs: "none", md: 470 },
            p: { xs: 2.5, sm: 3.5, md: 4 },
            borderRadius: { xs: 2, md: 2.5 },
            color: "#242239",
          }}
        >
          <Typography
            component="h1"
            id="authentication-title"
            sx={{
              mb: 1,
              fontSize: { xs: "1.8rem", md: "2.1rem" },
              lineHeight: 1.2,
              fontWeight: 800,
            }}
          >
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
            {description}
          </Typography>
          {children}
        </LiquidGlass>
      </Container>
    </Box>
  );
}
