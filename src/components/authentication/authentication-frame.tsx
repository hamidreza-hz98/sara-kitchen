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
        display: { md: "flex" },
        alignItems: { md: "center" },
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
          position: "relative",
          display: "flex",
          justifyContent: { md: rtl ? "flex-start" : "flex-end" },
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
            color: "var(--sara-palette-text-primary)",
            "--sara-palette-text-primary": "#2C2C47",
            "--sara-palette-text-secondary": "#5A6678",
            "--sara-palette-divider": "rgba(44,44,71,.24)",
            "--sara-palette-action-active": "rgba(44,44,71,.68)",
            "--sara-palette-background-paperChannel": "255 255 255",
            "& .MuiInputBase-root": { color: "var(--sara-palette-text-primary)" },
            "& .MuiInputLabel-root, & .MuiFormHelperText-root": {
              color: "var(--sara-palette-text-secondary)",
            },
            "& .MuiInputLabel-root.Mui-focused": { color: "var(--sara-palette-primary-dark)" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(44,44,71,.28)" },
            "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(44,44,71,.5)",
            },
            "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "var(--sara-palette-primary-dark)",
            },
            "& .MuiIconButton-root, & .MuiCheckbox-root": {
              color: "var(--sara-palette-action-active)",
            },
            "& .MuiCheckbox-root.Mui-checked": { color: "var(--sara-palette-primary-dark)" },
            "& input:-webkit-autofill": {
              WebkitBoxShadow: "0 0 0 100px rgba(255,255,255,.92) inset",
              WebkitTextFillColor: "#2C2C47",
              caretColor: "#2C2C47",
            },
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
