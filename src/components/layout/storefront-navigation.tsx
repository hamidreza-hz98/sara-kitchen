"use client";

import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import HomeRounded from "@mui/icons-material/HomeRounded";
import InfoRounded from "@mui/icons-material/InfoRounded";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import LoginRounded from "@mui/icons-material/LoginRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import RestaurantMenuRounded from "@mui/icons-material/RestaurantMenuRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type MouseEvent, type ReactNode } from "react";

import { AppDrawer, AppLink } from "@/components/ui";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from "@/locales";
import { usePathname } from "@/locales/navigation";

import { BrandMark } from "./brand-mark";

type NavigationItem = {
  href: string;
  icon: ReactNode;
  key: "about" | "blog" | "contact" | "home" | "menu";
};

const primaryItems = [
  { href: "/", icon: <HomeRounded />, key: "home" },
  { href: "/menu", icon: <RestaurantMenuRounded />, key: "menu" },
  { href: "/blog", icon: <ArticleRounded />, key: "blog" },
  { href: "/about", icon: <InfoRounded />, key: "about" },
  { href: "/contact", icon: <PhoneRounded />, key: "contact" },
] as const satisfies readonly NavigationItem[];

const mobileItems = [primaryItems[0], primaryItems[1], primaryItems[2]] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function BrandLink() {
  const shared = useTranslations("shared");
  const shell = useTranslations("storefront.shell");

  return (
    <AppLink
      href="/"
      underline="none"
      sx={{ display: "inline-flex", alignItems: "center", gap: 2, color: "text.primary" }}
    >
      <BrandMark />
      <Box>
        <Typography component="span" sx={{ display: "block", fontWeight: 800, lineHeight: 1.15 }}>
          {shared("brandName")}
        </Typography>
        <Typography
          color="primary.dark"
          component="span"
          sx={{ display: { xs: "none", sm: "block" }, fontWeight: 700, letterSpacing: "0.08em" }}
          variant="caption"
        >
          {shell("authenticFlavors")}
        </Typography>
      </Box>
    </AppLink>
  );
}

function LocaleSelector() {
  const locale = useLocale();
  const shell = useTranslations("storefront.shell");
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const open = anchorElement !== null;

  const selectLocale = (nextLocale: string) => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    window.location.reload();
  };

  return (
    <>
      <Button
        aria-controls={open ? "storefront-language-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="menu"
        aria-label={shell("language")}
        startIcon={
          <LanguageRounded fontSize="small" sx={{ display: { xs: "none", lg: "block" }, me: 1 }} />
        }
        variant="outlined"
        onClick={(event) => setAnchorElement(event.currentTarget)}
        sx={{
          minWidth: { xs: 72, lg: 118 },
          borderRadius: 999,
          bgcolor: "background.paper",
        }}
      >
        {locale === "pt-PT" ? "PT" : locale === "fa" ? "فا" : "EN"}
      </Button>
      <Menu
        anchorEl={anchorElement}
        id="storefront-language-menu"
        open={open}
        onClose={() => setAnchorElement(null)}
      >
        <MenuItem lang="en" selected={locale === "en"} onClick={() => selectLocale("en")}>
          English
        </MenuItem>
        <MenuItem lang="pt-PT" selected={locale === "pt-PT"} onClick={() => selectLocale("pt-PT")}>
          Português
        </MenuItem>
        <MenuItem dir="rtl" lang="fa" selected={locale === "fa"} onClick={() => selectLocale("fa")}>
          فارسی
        </MenuItem>
      </Menu>
    </>
  );
}

function CartButton({ count, compact = false }: { compact?: boolean; count: number }) {
  const shell = useTranslations("storefront.shell");

  return (
    <IconButton
      aria-label={shell("cartItems", { count })}
      component={NextLink}
      href="/cart"
      sx={{
        width: compact ? 56 : 44,
        height: compact ? 56 : 44,
        color: compact ? "primary.contrastText" : "text.primary",
        bgcolor: compact ? "primary.main" : "transparent",
        border: compact ? "4px solid" : undefined,
        borderColor: compact ? "background.default" : undefined,
        boxShadow: compact ? 4 : undefined,
        "&:hover": { bgcolor: compact ? "primary.dark" : "action.hover" },
      }}
    >
      <Badge badgeContent={count} color="secondary" showZero>
        <ShoppingCartRounded />
      </Badge>
    </IconButton>
  );
}

function AccountMenu() {
  const navigation = useTranslations("shared.navigation");
  const shell = useTranslations("storefront.shell");
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const open = anchorElement !== null;

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchorElement(event.currentTarget);
  const handleClose = () => setAnchorElement(null);

  return (
    <>
      <IconButton
        aria-controls={open ? "storefront-account-menu" : undefined}
        aria-expanded={open ? "true" : undefined}
        aria-haspopup="menu"
        aria-label={shell("accountMenu")}
        onClick={handleOpen}
      >
        <AccountCircleRounded />
      </IconButton>
      <Menu
        anchorEl={anchorElement}
        id="storefront-account-menu"
        open={open}
        slotProps={{ list: { "aria-label": shell("accountNavigation") } }}
        onClose={handleClose}
      >
        <MenuItem component={NextLink} href="/profile" onClick={handleClose}>
          <PersonRounded fontSize="small" sx={{ me: 2 }} />
          {navigation("profile")}
        </MenuItem>
        <MenuItem component={NextLink} href="/profile/orders" onClick={handleClose}>
          <ReceiptLongRounded fontSize="small" sx={{ me: 2 }} />
          {navigation("orders")}
        </MenuItem>
        <MenuItem component={NextLink} href="/profile" onClick={handleClose}>
          <LoginRounded fontSize="small" sx={{ me: 2 }} />
          {navigation("signIn")}
        </MenuItem>
      </Menu>
    </>
  );
}

export function StorefrontHeader({ cartItemCount }: { cartItemCount: number }) {
  const pathname = usePathname();
  const navigation = useTranslations("shared.navigation");
  const shell = useTranslations("storefront.shell");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.appBar }}>
        <Container maxWidth="xl" disableGutters>
          <Toolbar
            sx={{ minHeight: { xs: 68, lg: 76 }, gap: { xs: 2, lg: 5 }, px: { xs: 4, lg: 6 } }}
          >
            <BrandLink />
            <Stack
              aria-label={shell("primaryNavigation")}
              component="nav"
              direction="row"
              spacing={1}
              sx={{ display: { xs: "none", lg: "flex" }, flexGrow: 1, justifyContent: "center" }}
            >
              {primaryItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Button
                    aria-current={active ? "page" : undefined}
                    color={active ? "primary" : "inherit"}
                    component={NextLink}
                    href={item.href}
                    key={item.key}
                    variant={active ? "contained" : "text"}
                  >
                    {navigation(item.key)}
                  </Button>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", ms: "auto" }}>
              <LocaleSelector />
              <Box sx={{ display: { xs: "none", lg: "block" } }}>
                <CartButton count={cartItemCount} />
              </Box>
              <Box sx={{ display: { xs: "none", lg: "block" } }}>
                <AccountMenu />
              </Box>
              <IconButton
                aria-label={shell("openMenu")}
                sx={{ display: { xs: "inline-flex", lg: "none" } }}
                onClick={() => setDrawerOpen(true)}
              >
                <MenuRounded />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <AppDrawer
        closeLabel={shell("closeMenu")}
        description={shell("authenticFlavors")}
        open={drawerOpen}
        title={navigation("menu")}
        onClose={() => setDrawerOpen(false)}
      >
        <Stack aria-label={shell("mobileNavigation")} component="nav" spacing={1}>
          {primaryItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Button
                aria-current={active ? "page" : undefined}
                color={active ? "primary" : "inherit"}
                component={NextLink}
                href={item.href}
                key={item.key}
                startIcon={item.icon}
                sx={{ justifyContent: "flex-start", px: 4 }}
                variant={active ? "contained" : "text"}
                onClick={() => setDrawerOpen(false)}
              >
                {navigation(item.key)}
              </Button>
            );
          })}
        </Stack>
      </AppDrawer>
    </>
  );
}

export function StorefrontMobileNavigation({ cartItemCount }: { cartItemCount: number }) {
  const pathname = usePathname();
  const navigation = useTranslations("shared.navigation");
  const shell = useTranslations("storefront.shell");

  return (
    <Box
      aria-label={shell("mobileNavigation")}
      component="nav"
      sx={{
        position: "fixed",
        zIndex: (theme) => theme.zIndex.appBar,
        insetInline: 12,
        insetBlockEnd: 12,
        display: { xs: "grid", lg: "none" },
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        alignItems: "end",
        maxWidth: 520,
        mx: "auto",
        px: 2,
        py: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 999,
        bgcolor: "rgba(var(--sara-palette-background-paperChannel) / 0.94)",
        boxShadow: 5,
        backdropFilter: "blur(14px)",
      }}
    >
      {mobileItems.slice(0, 2).map((item) => (
        <MobileNavigationLink
          active={isActivePath(pathname, item.href)}
          href={item.href}
          icon={item.icon}
          key={item.key}
          label={navigation(item.key)}
        />
      ))}
      <Box sx={{ display: "grid", placeItems: "center", transform: "translateY(-12px)" }}>
        <CartButton compact count={cartItemCount} />
      </Box>
      <MobileNavigationLink
        active={isActivePath(pathname, mobileItems[2].href)}
        href={mobileItems[2].href}
        icon={mobileItems[2].icon}
        label={navigation(mobileItems[2].key)}
      />
      <MobileNavigationLink
        active={isActivePath(pathname, "/profile")}
        href="/profile"
        icon={<PersonRounded />}
        label={navigation("profile")}
      />
    </Box>
  );
}

function MobileNavigationLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Button
      aria-current={active ? "page" : undefined}
      aria-label={label}
      color={active ? "primary" : "inherit"}
      component={NextLink}
      href={href}
      sx={{ minWidth: 0, px: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}
    >
      {icon}
      <Typography component="span" sx={{ fontSize: 10, fontWeight: 700 }}>
        {label}
      </Typography>
    </Button>
  );
}
