"use client";

import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import LocalDiningRounded from "@mui/icons-material/LocalDiningRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import Alert from "@mui/material/Alert";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { useState } from "react";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const isDark = mode === "dark";

  return (
    <Box
      data-hydrated={mode !== undefined}
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
            <LocalDiningRounded />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography component="p" variant="h5">
              Sara Kitchen
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Design system · v1
            </Typography>
          </Box>
          <Tooltip title={isDark ? "Use light theme" : "Use dark theme"}>
            <span>
              <IconButton
                aria-label={isDark ? "Use light theme" : "Use dark theme"}
                disabled={mode === undefined}
                onClick={() => setMode(isDark ? "light" : "dark")}
              >
                {isDark ? <LightModeRounded /> : <DarkModeRounded />}
              </IconButton>
            </span>
          </Tooltip>
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
              right: { xs: -70, md: -80 },
              bottom: { xs: -90, md: -130 },
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
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Total</TableCell>
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
                    <TableCell align="right">{row.quantity}</TableCell>
                    <TableCell align="right">{row.total}</TableCell>
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
                    <Box sx={{ textAlign: "right" }}>
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

      <Dialog fullWidth maxWidth="xs" open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle sx={{ pr: 14 }}>
          Preview order
          <IconButton
            aria-label="Close order preview"
            onClick={() => setDialogOpen(false)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Dialog shape, elevation, spacing, and controls all inherit the global theme.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setDialogOpen(false)}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
