"use client";

import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import AssessmentRounded from "@mui/icons-material/AssessmentRounded";
import CategoryRounded from "@mui/icons-material/CategoryRounded";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import ContactMailRounded from "@mui/icons-material/ContactMailRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import PeopleRounded from "@mui/icons-material/PeopleRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import RestaurantMenuRounded from "@mui/icons-material/RestaurantMenuRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { AppDrawer } from "@/components/ui";
import { useFeedback } from "@/hooks";
import { usePathname, useRouter } from "@/locales/navigation";

import { BrandMark } from "./brand-mark";
import {
  dashboardItemForPath,
  visibleDashboardItems,
  type DashboardActor,
  type DashboardNavItem,
  type DashboardSection,
} from "./dashboard-policy";
import { SkipLink } from "./skip-link";

const sidebarWidth = 272;
const collapsedWidth = 76;
const collapseStorageKey = "sara-dashboard-sidebar-collapsed";
const collapseChangeEvent = "sara-dashboard-sidebar-change";

function subscribeCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(collapseChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(collapseChangeEvent, callback);
  };
}

function getCollapsed() {
  return window.localStorage.getItem(collapseStorageKey) === "true";
}

function safePathLabel(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const itemIcons = {
  overview: <AssessmentRounded />,
  categories: <CategoryRounded />,
  dishes: <RestaurantMenuRounded />,
  ingredients: <LocalDiningRounded />,
  media: <ImageRounded />,
  blogs: <ArticleRounded />,
  customers: <PeopleRounded />,
  admins: <AdminPanelSettingsRounded />,
  orders: <ShoppingBagRounded />,
  transactions: <PaymentsRounded />,
  contacts: <ContactMailRounded />,
  activity: <HistoryRounded />,
  settings: <SettingsRounded />,
} as const;

export type DashboardShellProps = {
  actor: DashboardActor;
  basePath?: string;
  children: ReactNode;
  enableSignOut?: boolean;
};

function NavigationList({
  actor,
  basePath,
  collapsed,
  mobile,
  onNavigate,
  pathname,
}: {
  actor: DashboardActor;
  basePath: string;
  collapsed: boolean;
  mobile: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  const navigation = useTranslations("dashboard.navigation");
  const shell = useTranslations("dashboard.shell");
  const items = visibleDashboardItems(actor);
  const activeItem = dashboardItemForPath(pathname, basePath);
  const sections: DashboardSection[] = ["main", "management", "settings"];

  return (
    <Box
      aria-label={shell("navigation")}
      component="nav"
      sx={{ flexGrow: 1, overflowY: "auto", p: 3 }}
    >
      {sections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (sectionItems.length === 0) return null;
        return (
          <Box key={section} sx={{ mb: 5 }}>
            {collapsed && !mobile ? null : (
              <Typography
                color="text.secondary"
                sx={{
                  px: 3,
                  mb: 2,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {shell(`sections.${section}`)}
              </Typography>
            )}
            <List disablePadding>
              {sectionItems.map((item: DashboardNavItem) => {
                const active = activeItem?.key === item.key;
                const label = navigation(item.key);
                const link = (
                  <ListItemButton
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed && !mobile ? label : undefined}
                    component={NextLink}
                    href={`${basePath}${item.path}`}
                    onClick={() => onNavigate?.()}
                    selected={active}
                    sx={{
                      minHeight: 44,
                      mb: 0.5,
                      px: collapsed && !mobile ? 2 : 3,
                      borderRadius: 3,
                      justifyContent: collapsed && !mobile ? "center" : "initial",
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        boxShadow: 2,
                      },
                      "&.Mui-selected:hover": { bgcolor: "primary.dark" },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: collapsed && !mobile ? 0 : 38, color: "inherit" }}
                    >
                      {itemIcons[item.key]}
                    </ListItemIcon>
                    {collapsed && !mobile ? null : (
                      <ListItemText
                        primary={label}
                        slotProps={{ primary: { sx: { fontSize: 14, fontWeight: 700 } } }}
                      />
                    )}
                  </ListItemButton>
                );
                return (
                  <ListItem disablePadding key={item.key}>
                    {collapsed && !mobile ? (
                      <Tooltip title={label} placement="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        );
      })}
    </Box>
  );
}

export function DashboardShell({
  actor,
  basePath = "/dashboard",
  children,
  enableSignOut = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const navigation = useTranslations("dashboard.navigation");
  const shell = useTranslations("dashboard.shell");
  const feedback = useFeedback();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => false);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const activeItem = dashboardItemForPath(pathname, basePath);
  const accessibleItems = visibleDashboardItems(actor);
  const isSessionPath = pathname === `${basePath}/sessions`;
  const isAuthorizedPath =
    isSessionPath || accessibleItems.some((item) => item.key === activeItem?.key);

  const toggleCollapsed = () => {
    window.localStorage.setItem(collapseStorageKey, String(!collapsed));
    window.dispatchEvent(new Event(collapseChangeEvent));
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/admin/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign-out failed");
      router.replace("/authentication");
      router.refresh();
    } catch {
      setSigningOut(false);
      setAccountAnchor(null);
      feedback.notify({ message: shell("signOutError"), severity: "error" });
    }
  };

  const relativePath = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length + 1)
    : "";
  const pathParts = relativePath.split("/").filter(Boolean);
  const sectionDepth = activeItem?.path.split("/").filter(Boolean).length ?? 0;
  const detailParts = pathParts.slice(sectionDepth).map(safePathLabel);

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      <SkipLink label={shell("skipToContent")} targetId="dashboard-main-content" />
      <Box
        aria-label={shell("sidebar")}
        component="aside"
        sx={{
          display: { xs: "none", lg: "flex" },
          flexDirection: "column",
          width: collapsed ? collapsedWidth : sidebarWidth,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100dvh",
          borderInlineEnd: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          transition: "width 200ms ease",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            minHeight: 80,
            px: collapsed ? 2 : 4,
            borderBlockEnd: "1px solid",
            borderColor: "divider",
          }}
        >
          <BrandMark size={40} />
          {collapsed ? null : (
            <Box>
              <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                {shell("brand")}
              </Typography>
              <Typography
                color="primary"
                sx={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em" }}
              >
                {shell("management")}
              </Typography>
            </Box>
          )}
        </Box>
        <NavigationList
          actor={actor}
          basePath={basePath}
          collapsed={collapsed}
          mobile={false}
          pathname={pathname}
        />
        <Tooltip title={collapsed ? shell("expandSidebar") : shell("collapseSidebar")}>
          <IconButton
            aria-label={collapsed ? shell("expandSidebar") : shell("collapseSidebar")}
            onClick={toggleCollapsed}
            sx={{ alignSelf: collapsed ? "center" : "flex-end", m: 3 }}
          >
            {locale === "fa" ? (
              collapsed ? (
                <ChevronLeftRounded />
              ) : (
                <ChevronRightRounded />
              )
            ) : collapsed ? (
              <ChevronRightRounded />
            ) : (
              <ChevronLeftRounded />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        <AppBar
          position="sticky"
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            borderBlockEnd: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          <Box
            sx={{
              minHeight: 72,
              px: { xs: 4, md: 6 },
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <IconButton
              aria-label={shell("openMenu")}
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: "inline-flex", lg: "none" } }}
            >
              <MenuRounded />
            </IconButton>
            <Typography sx={{ display: { xs: "block", lg: "none" }, fontWeight: 800, flexGrow: 1 }}>
              {shell("brand")}
            </Typography>
            <Typography sx={{ display: { xs: "none", lg: "block" }, flexGrow: 1, fontWeight: 700 }}>
              {isSessionPath
                ? shell("sessions")
                : activeItem
                  ? navigation(activeItem.key)
                  : shell("unknownSection")}
            </Typography>
            <IconButton
              aria-label={shell("accountMenu")}
              aria-haspopup="menu"
              aria-expanded={accountAnchor ? "true" : undefined}
              onClick={(event) => setAccountAnchor(event.currentTarget)}
            >
              <Avatar sx={{ bgcolor: "primary.main", width: 38, height: 38, fontSize: 16 }}>
                {actor.displayName.slice(0, 1)}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={accountAnchor}
              open={Boolean(accountAnchor)}
              onClose={() => setAccountAnchor(null)}
              slotProps={{ list: { "aria-label": shell("accountMenu") } }}
            >
              <MenuItem disabled>
                {actor.displayName} — {actor.roleLabel}
              </MenuItem>
              {enableSignOut && (
                <MenuItem
                  component={NextLink}
                  href={`${basePath}/sessions`}
                  onClick={() => setAccountAnchor(null)}
                >
                  {shell("sessions")}
                </MenuItem>
              )}
              {enableSignOut ? (
                <MenuItem
                  disabled={signingOut}
                  onClick={() => {
                    signOut().catch(() =>
                      feedback.notify({ message: shell("signOutError"), severity: "error" }),
                    );
                  }}
                >
                  {shell("signOut")}
                </MenuItem>
              ) : (
                <MenuItem disabled>{shell("signOutPending")}</MenuItem>
              )}
            </Menu>
          </Box>
        </AppBar>
        <Box
          component="main"
          id="dashboard-main-content"
          tabIndex={-1}
          sx={{
            minWidth: 0,
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
            p: { xs: 4, md: 6, xl: 8 },
            flexGrow: 1,
          }}
        >
          <Breadcrumbs aria-label={shell("breadcrumbs")} sx={{ mb: 4 }}>
            <Typography
              component={NextLink}
              href={basePath}
              sx={{
                color: "text.secondary",
                textDecoration: "none",
                "&:hover": { color: "primary.main" },
              }}
            >
              {navigation("overview")}
            </Typography>
            {isSessionPath ? (
              <Typography color="text.primary">{shell("sessions")}</Typography>
            ) : activeItem && activeItem.key !== "overview" ? (
              <Typography
                component={detailParts.length ? NextLink : "span"}
                href={detailParts.length ? `${basePath}${activeItem.path}` : undefined}
                sx={{
                  color: detailParts.length ? "text.secondary" : "text.primary",
                  textDecoration: "none",
                }}
              >
                {navigation(activeItem.key)}
              </Typography>
            ) : null}
            {detailParts.map((part, index) => (
              <Typography
                key={`${part}-${index}`}
                color={index === detailParts.length - 1 ? "text.primary" : "text.secondary"}
              >
                {part}
              </Typography>
            ))}
          </Breadcrumbs>
          {isAuthorizedPath ? (
            children
          ) : (
            <Typography role="alert">{shell("permissionDenied")}</Typography>
          )}
        </Box>
      </Box>

      <AppDrawer
        closeLabel={shell("closeMenu")}
        open={mobileOpen}
        side="start"
        title={shell("navigation")}
        onClose={() => setMobileOpen(false)}
      >
        <NavigationList
          actor={actor}
          basePath={basePath}
          collapsed={false}
          mobile
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </AppDrawer>
    </Box>
  );
}
