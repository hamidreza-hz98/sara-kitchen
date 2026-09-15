import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark";
import styles from "./storefront-shell.module.css";

const quickLinks = [
  { href: "/about", key: "about" },
  { href: "/menu", key: "menu" },
  { href: "/contact", key: "contact" },
] as const;

const categoryLinks = [
  { href: "/menu?category=kebabs", key: "kebabs" },
  { href: "/menu?category=stews", key: "stews" },
  { href: "/menu?category=sides", key: "sides" },
  { href: "/menu?category=drinks", key: "drinks" },
] as const;

export async function StorefrontFooter() {
  const shared = await getTranslations("shared");
  const navigation = await getTranslations("shared.navigation");
  const shell = await getTranslations("storefront.shell");

  return (
    <Box
      component="footer"
      sx={{
        mt: "auto",
        borderBlockStart: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Container maxWidth="lg" sx={{ pt: { xs: 10, md: 14 }, pb: { xs: 28, lg: 8 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1.5fr) 1fr 1fr" },
            gap: { xs: 9, md: 10 },
          }}
        >
          <Stack
            spacing={3}
            sx={{
              alignItems: { xs: "center", md: "flex-start" },
              textAlign: { xs: "center", md: "start" },
            }}
          >
            <BrandMark size={64} />
            <Typography color="primary.dark" variant="h2">
              {shared("brandName")}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
              {shell("footerTagline")}
            </Typography>
          </Stack>
          <FooterLinkGroup title={shell("quickLinks")}>
            {quickLinks.map((item) => (
              <Link className={styles.footerLink} href={item.href} key={item.key}>
                {navigation(item.key)}
              </Link>
            ))}
            <Link className={styles.footerLink} href="/terms">
              {shell("terms")}
            </Link>
          </FooterLinkGroup>
          <FooterLinkGroup title={shell("categories")}>
            {categoryLinks.map((item) => (
              <Link className={styles.footerLink} href={item.href} key={item.key}>
                {shell(item.key)}
              </Link>
            ))}
          </FooterLinkGroup>
        </Box>
        <Divider sx={{ mt: { xs: 10, md: 12 }, mb: 6 }} />
        <Typography color="text.secondary" sx={{ textAlign: "center" }} variant="caption">
          {shell("copyright", { year: new Date().getUTCFullYear() })}
        </Typography>
      </Container>
    </Box>
  );
}

function FooterLinkGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Stack spacing={3} sx={{ alignItems: { xs: "center", md: "flex-start" } }}>
      <Typography component="h2" variant="h5">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
