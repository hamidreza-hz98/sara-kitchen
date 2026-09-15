"use client";

import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useColorScheme, useTheme } from "@mui/material/styles";
import { useState } from "react";

import { DirectionalIcon } from "@/components";
import {
  ActionButton,
  AppDialog,
  AppDrawer,
  AppImage,
  AppLink,
  AppPagination,
  AppTooltip,
  ContentSkeleton,
  EmptyState,
  ErrorState,
  FormField,
  NotificationBadge,
  RichContent,
  SelectField,
  StatusChip,
  type RichTextDocument,
} from "@/components/ui";
import { colorTokens, radiusTokens, shadowTokens } from "@/theme";

const swatches = [
  { name: "Primary coral", value: colorTokens.brand.primary },
  { name: "Coral text", value: colorTokens.brand.primaryText },
  { name: "Kitchen ink", value: colorTokens.brand.ink },
  { name: "Saffron", value: colorTokens.brand.accent },
  { name: "Canvas", value: colorTokens.light.canvas },
  { name: "Success", value: colorTokens.status.success },
] as const;

const orderRows = [
  { item: "Fesenjan", status: "Preparing", quantity: 2, total: "€24.00" },
  { item: "Kuku Sabzi", status: "Ready", quantity: 1, total: "€5.50" },
] as const;

const categoryOptions = [
  { label: "Main course", value: "main" },
  { label: "Starter", value: "starter" },
] as const;

const richContentExample = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "A recipe story" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Fresh herbs", marks: [{ type: "bold" }] },
        { type: "text", text: " and patient preparation give Persian dishes their character." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Cooked at home" }] }],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Prepared for your order" }] },
          ],
        },
      ],
    },
  ],
} as const satisfies RichTextDocument;

function ShowcaseSection({
  eyebrow,
  title,
  children,
}: Readonly<{ eyebrow: string; title: string; children: React.ReactNode }>) {
  return (
    <Box component="section">
      <Typography color="primary.dark" variant="overline">
        {eyebrow}
      </Typography>
      <Typography sx={{ mb: { xs: 4, md: 6 } }} variant="h2">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function ThemeShowcase() {
  const { mode, setMode } = useColorScheme();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState(0);
  const isDark = mode === "dark";

  return (
    <Box
      data-hydrated={mode !== undefined}
      data-theme-direction={theme.direction}
      data-testid="theme-showcase"
      sx={{ minHeight: "100dvh", bgcolor: "background.default" }}
    >
      <AppBar position="sticky">
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, gap: 3 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              borderRadius: "50% 50% 45% 55%",
              bgcolor: "secondary.main",
              color: "secondary.contrastText",
            }}
          >
            <LocalDiningRounded data-testid="static-kitchen-icon" />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography component="p" variant="h5">
              Sara Kitchen
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Design system · v1
            </Typography>
          </Box>
          <AppTooltip
            disabled={mode === undefined}
            title={isDark ? "Use light theme" : "Use dark theme"}
          >
            <IconButton
              aria-label={isDark ? "Use light theme" : "Use dark theme"}
              disabled={mode === undefined}
              onClick={() => setMode(isDark ? "light" : "dark")}
            >
              {isDark ? <LightModeRounded /> : <DarkModeRounded />}
            </IconButton>
          </AppTooltip>
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        maxWidth="xl"
        sx={{ py: { xs: 8, sm: 10, lg: 16 }, display: "grid", gap: { xs: 12, lg: 18 } }}
      >
        <Paper
          sx={{
            position: "relative",
            overflow: "hidden",
            p: { xs: 6, sm: 10, lg: 14 },
            borderRadius: { xs: 4, md: 6 },
            bgcolor: "primary.main",
            color: "primary.contrastText",
            boxShadow: 4,
            "&::after": {
              content: '""',
              position: "absolute",
              width: { xs: 160, md: 280 },
              height: { xs: 160, md: 280 },
              insetInlineEnd: { xs: -70, md: -80 },
              insetBlockEnd: { xs: -90, md: -130 },
              borderRadius: "50%",
              bgcolor: "secondary.main",
              opacity: 0.72,
            },
          }}
        >
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
            <Chip label="Persian homemade food" sx={{ mb: 5, bgcolor: "secondary.main" }} />
            <Typography variant="h1">Warm hospitality, translated into every component.</Typography>
            <Typography sx={{ mt: 4, maxWidth: 620 }} variant="body1">
              A responsive visual reference for Sara Kitchen’s public menu and management panel.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mt: 7 }}>
              <Button
                color="secondary"
                endIcon={
                  <DirectionalIcon mirrorInRtl testId="directional-arrow">
                    <ArrowForwardRounded />
                  </DirectionalIcon>
                }
                size="large"
                startIcon={<ShoppingBagRounded />}
                variant="contained"
                onClick={() => setDialogOpen(true)}
              >
                Preview order
              </Button>
              <Button color="inherit" size="large" variant="outlined">
                Browse components
              </Button>
            </Stack>
          </Box>
        </Paper>

        <ShowcaseSection eyebrow="Foundations" title="Color and elevation">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
                lg: "repeat(6, minmax(0, 1fr))",
              },
              gap: 4,
            }}
          >
            {swatches.map((swatch, index) => (
              <Card key={swatch.name} sx={{ boxShadow: index % 3 }}>
                <Box sx={{ height: 80, bgcolor: swatch.value }} />
                <CardContent>
                  <Typography component="p" variant="subtitle2">
                    {swatch.name}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {swatch.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </ShowcaseSection>

        <ShowcaseSection eyebrow="Shared UI" title="Accessible product primitives">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
              gap: 5,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="h3">Actions, links, and indicators</Typography>
                <Stack direction="row" useFlexGap spacing={3} sx={{ mt: 5, flexWrap: "wrap" }}>
                  <ActionButton variant="contained" onClick={() => setDrawerOpen(true)}>
                    Open order drawer
                  </ActionButton>
                  <AppLink href="/menu">View the menu</AppLink>
                  <AppTooltip title="Three unread notifications">
                    <IconButton aria-label="Notifications">
                      <NotificationBadge
                        badgeContent={3}
                        badgeLabel="3 unread notifications"
                        color="primary"
                      >
                        <NotificationsRounded />
                      </NotificationBadge>
                    </IconButton>
                  </AppTooltip>
                </Stack>
                <Stack direction="row" useFlexGap spacing={2} sx={{ mt: 5, flexWrap: "wrap" }}>
                  <StatusChip color="success" label="Ready" />
                  <StatusChip color="warning" label="Preparing" />
                  <StatusChip color="error" label="Cancelled" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h3">Fields and selection</Typography>
                <Box
                  sx={{
                    mt: 5,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 4,
                  }}
                >
                  <FormField
                    helperText="Shown on the menu"
                    label="Public dish name"
                    name="dishName"
                    defaultValue="Fesenjan"
                  />
                  <SelectField
                    label="Dish category"
                    name="dishCategory"
                    options={categoryOptions}
                    defaultValue="main"
                  />
                </Box>
              </CardContent>
            </Card>

            <Box sx={{ display: "grid", gap: 5 }}>
              <EmptyState
                title="No saved addresses"
                description="Add an address now or choose pickup during checkout."
                action={<ActionButton variant="outlined">Add address</ActionButton>}
              />
              <ErrorState
                title="Orders could not load"
                description="Check the connection and try again."
                action={<ActionButton startIcon={<RefreshRounded />}>Try again</ActionButton>}
              />
            </Box>

            <Card>
              <CardContent>
                <Typography variant="h3">Loading, media, and rich content</Typography>
                <Stack spacing={4} sx={{ mt: 5 }}>
                  <ContentSkeleton height={24} label="Loading dish details" variant="rounded" />
                  <ContentSkeleton height={80} label="Loading dish image" variant="rounded" />
                  <Box sx={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                    <AppImage
                      alt="Media component example"
                      height={88}
                      objectFit="contain"
                      src="/window.svg"
                      style={{ flexShrink: 0 }}
                      width={88}
                    />
                    <RichContent content={richContentExample} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ gridColumn: { lg: "1 / -1" } }}>
              <CardContent>
                <Typography variant="h3">Pagination</Typography>
                <AppPagination
                  count={8}
                  label="Dish pages"
                  page={page}
                  onChange={(_event, value) => setPage(value)}
                  sx={{ mt: 5 }}
                />
              </CardContent>
            </Card>
          </Box>
        </ShowcaseSection>

        <ShowcaseSection eyebrow="Type system" title="Clear at every scale">
          <Card>
            <CardContent>
              <Stack divider={<Divider flexItem />} spacing={5}>
                <Typography variant="h1">Hero heading / 48</Typography>
                <Typography variant="h2">Section heading / 30</Typography>
                <Typography variant="h3">Card heading / 24</Typography>
                <Typography variant="body1">
                  Body text balances warmth and clarity for menu descriptions, order details, and
                  editorial content.
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Secondary copy stays legible while preserving hierarchy.
                </Typography>
                <Box
                  data-testid="persian-font-sample"
                  dir="rtl"
                  lang="fa"
                  sx={{ textAlign: "start" }}
                >
                  <Typography component="p" variant="h3">
                    آشپزخانه سارا؛ غذای خانگی ایرانی
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 2 }}>
                    طعم اصیل، مواد تازه و آماده‌سازی با حوصله
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </ShowcaseSection>

        <ShowcaseSection eyebrow="Components" title="Controls and feedback">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
              gap: 5,
            }}
          >
            <Card>
              <CardContent>
                <Typography variant="h3">Actions</Typography>
                <Stack direction="row" useFlexGap spacing={3} sx={{ mt: 5, flexWrap: "wrap" }}>
                  <Button data-testid="primary-action" variant="contained">
                    Primary action
                  </Button>
                  <Button variant="outlined">Secondary</Button>
                  <Button variant="text">Text action</Button>
                  <Button disabled variant="contained">
                    Disabled
                  </Button>
                </Stack>
                <Stack direction="row" useFlexGap spacing={2} sx={{ mt: 6, flexWrap: "wrap" }}>
                  <Chip color="success" icon={<CheckCircleRounded />} label="Ready" />
                  <Chip color="warning" label="Preparing" />
                  <Chip color="error" label="Cancelled" variant="outlined" />
                  <Chip label="Persian" variant="outlined" />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h3">Form controls</Typography>
                <Box
                  component="form"
                  noValidate
                  sx={{
                    mt: 5,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 4,
                  }}
                >
                  <TextField label="Dish name" defaultValue="Fesenjan" />
                  <TextField label="Category" defaultValue="main" select>
                    <MenuItem value="main">Main course</MenuItem>
                    <MenuItem value="starter">Starter</MenuItem>
                  </TextField>
                  <TextField
                    error
                    helperText="Enter a valid amount"
                    label="Price"
                    defaultValue="0"
                  />
                  <TextField disabled label="Order code" defaultValue="SK-1234" />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ gridColumn: { lg: "1 / -1" } }}>
              <CardContent>
                <Tabs
                  aria-label="Order status example"
                  value={tab}
                  onChange={(_event, value: number) => setTab(value)}
                  variant="scrollable"
                >
                  <Tab label="All orders" />
                  <Tab label="Preparing" />
                  <Tab label="Ready" />
                </Tabs>
                <Stack spacing={3} sx={{ mt: 5 }}>
                  <Alert severity="success">The order is ready for pickup.</Alert>
                  <Alert severity="info" variant="outlined">
                    Delivery lead time follows the dish with the longest preparation time.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </ShowcaseSection>

        <ShowcaseSection eyebrow="Responsive data" title="Orders adapt without losing context">
          <TableContainer component={Card} sx={{ display: { xs: "none", md: "block" } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Dish</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ textAlign: "end" }}>Quantity</TableCell>
                  <TableCell sx={{ textAlign: "end" }}>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orderRows.map((row) => (
                  <TableRow key={row.item}>
                    <TableCell>{row.item}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        color={row.status === "Ready" ? "success" : "warning"}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "end" }}>{row.quantity}</TableCell>
                    <TableCell sx={{ textAlign: "end" }}>{row.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack spacing={3} sx={{ display: { xs: "flex", md: "none" } }}>
            {orderRows.map((row) => (
              <Card key={row.item}>
                <CardContent>
                  <Stack direction="row" spacing={3} sx={{ justifyContent: "space-between" }}>
                    <Box>
                      <Typography component="h3" variant="h4">
                        {row.item}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        Quantity {row.quantity}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "end" }}>
                      <Chip
                        label={row.status}
                        color={row.status === "Ready" ? "success" : "warning"}
                      />
                      <Typography sx={{ mt: 2 }} variant="subtitle1">
                        {row.total}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </ShowcaseSection>

        <Paper
          component="footer"
          sx={{
            p: { xs: 5, md: 7 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: `${radiusTokens.lg}px`,
            boxShadow: shadowTokens.subtle,
          }}
        >
          <Typography component="p" variant="subtitle1">
            Breakpoint coverage
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Phone 0–639 · Small 640–767 · Tablet 768–1023 · Desktop 1024–1279 · Wide 1280+
          </Typography>
        </Paper>
      </Container>

      <AppDialog
        actions={
          <>
            <ActionButton onClick={() => setDialogOpen(false)}>Cancel</ActionButton>
            <ActionButton variant="contained" onClick={() => setDialogOpen(false)}>
              Confirm
            </ActionButton>
          </>
        }
        closeLabel="Close order preview"
        description="Dialog shape, elevation, spacing, focus trapping, and controls inherit the product contract."
        fullWidth
        maxWidth="xs"
        open={dialogOpen}
        title="Preview order"
        onClose={() => setDialogOpen(false)}
      />

      <AppDrawer
        closeLabel="Close order drawer"
        description="A logical end-side drawer mirrors automatically in Persian."
        open={drawerOpen}
        title="Order summary"
        onClose={() => setDrawerOpen(false)}
      >
        <Stack spacing={4}>
          <Typography>Fesenjan × 2</Typography>
          <ActionButton variant="contained" onClick={() => setDrawerOpen(false)}>
            Continue to checkout
          </ActionButton>
        </Stack>
      </AppDrawer>
    </Box>
  );
}
