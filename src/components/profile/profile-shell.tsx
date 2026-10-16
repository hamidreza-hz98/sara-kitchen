"use client";

import HomeRounded from "@mui/icons-material/HomeRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { useFeedback } from "@/hooks";
import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { Link, usePathname, useRouter } from "@/locales/navigation";

const items = [
  { href: "/profile", label: "overview", icon: <HomeRounded fontSize="small" /> },
  { href: "/profile/information", label: "information", icon: <PersonRounded fontSize="small" /> },
  { href: "/profile/addresses", label: "addresses", icon: <PlaceRounded fontSize="small" /> },
  { href: "/profile/orders", label: "orders", icon: <ReceiptLongRounded fontSize="small" /> },
  { href: "/profile/sessions", label: "security", icon: <SecurityRounded fontSize="small" /> },
] as const;

export function ProfileShell({ children }: { children: ReactNode }) {
  const t = useTranslations("profile");
  const shell = useTranslations("storefront.shell");
  const pathname = usePathname();
  const router = useRouter();
  const feedback = useFeedback();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/customer/logout", {
        method: "POST",
        headers: await csrfJsonHeaders("customer"),
        credentials: "same-origin",
        body: "{}",
      });
      if (!response.ok) throw new Error("Customer sign-out failed");
      broadcastCustomerAuthChange();
      router.replace("/");
      router.refresh();
    } catch {
      feedback.notify({ message: shell("signOutFailed"), severity: "error" });
      setSigningOut(false);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 8 } }}>
      <Box
        sx={{
          display: { xs: "block", md: "grid" },
          gridTemplateColumns: "240px minmax(0, 1fr)",
          gap: 6,
        }}
      >
        <Paper
          component="nav"
          aria-label={t("navigation")}
          elevation={0}
          sx={{
            alignSelf: "start",
            p: 2,
            mb: { xs: 4, md: 0 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 4,
          }}
        >
          <Typography
            component="h2"
            variant="h6"
            sx={{ px: 2, py: 1, display: { xs: "none", md: "block" } }}
          >
            {t("title")}
          </Typography>
          <Stack
            direction={{ xs: "row", md: "column" }}
            spacing={1}
            sx={{ overflowX: { xs: "auto", md: "visible" }, pb: { xs: 1, md: 0 } }}
          >
            {items.map((item) => {
              const active =
                item.href === "/profile"
                  ? pathname === item.href
                  : pathname === item.href ||
                    (item.href === "/profile/sessions" &&
                      pathname === "/profile/change-password") ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  startIcon={item.icon}
                  variant={active ? "contained" : "text"}
                  color={active ? "primary" : "inherit"}
                  sx={{ justifyContent: "flex-start", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {t(item.label)}
                </Button>
              );
            })}
            <Button
              type="button"
              color="inherit"
              disabled={signingOut}
              startIcon={<LogoutRounded fontSize="small" />}
              sx={{ justifyContent: "flex-start", whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => {
                signOut().catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? t("signingOut") : t("logout")}
            </Button>
          </Stack>
        </Paper>
        <Box component="section" aria-label={t("content")} sx={{ minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Container>
  );
}
