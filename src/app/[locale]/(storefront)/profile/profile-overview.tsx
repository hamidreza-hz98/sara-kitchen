import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";

import styles from "./profile-overview.module.css";

type Labels = Readonly<{
  title: string;
  intro: string;
  totalOrders: string;
  totalSpent: string;
  lastOrder: string;
  noOrders: string;
  latestOrderStatus: string;
  viewOrder: string;
  specialOffer: string;
  exploreOffer: string;
  shortcuts: string;
  orders: string;
  addresses: string;
  information: string;
  menu: string;
}>;

export type ProfileOverviewProps = Readonly<{
  labels: Labels;
  totalOrders: string;
  totalSpent: string;
  latestOrder: Readonly<{ code: string; date: string; price: string }> | null;
  offer: Readonly<{
    slug: string;
    name: string;
    price: string;
    originalPrice: string | null;
  }> | null;
}>;

const cardSx = {
  p: { xs: 4, sm: 5 },
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 4,
  bgcolor: "background.paper",
} as const;

export function ProfileOverview({
  labels,
  totalOrders,
  totalSpent,
  latestOrder,
  offer,
}: ProfileOverviewProps) {
  return (
    <Stack spacing={5}>
      <Box>
        <Typography component="h1" variant="h2">
          {labels.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {labels.intro}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
          gap: 3,
        }}
      >
        <Paper component="section" elevation={0} sx={cardSx}>
          <Typography color="text.secondary" variant="body2">
            {labels.totalOrders}
          </Typography>
          <Typography component="p" variant="h3" sx={{ mt: 2 }}>
            {totalOrders}
          </Typography>
        </Paper>
        <Paper component="section" elevation={0} sx={cardSx}>
          <Typography color="text.secondary" variant="body2">
            {labels.totalSpent}
          </Typography>
          <Typography component="p" variant="h3" sx={{ mt: 2 }}>
            {totalSpent}
          </Typography>
        </Paper>
      </Box>
      <Paper component="section" elevation={0} sx={cardSx}>
        <Typography component="h2" variant="h5">
          {labels.lastOrder}
        </Typography>
        {latestOrder ? (
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Typography sx={{ fontWeight: 700 }}>{latestOrder.code}</Typography>
            <Typography color="text.secondary">
              {latestOrder.date} · {labels.latestOrderStatus}
            </Typography>
            <Typography>{latestOrder.price}</Typography>
            <Link className={styles.actionLink} href="/profile/orders">
              {labels.viewOrder}
            </Link>
          </Stack>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {labels.noOrders}
          </Typography>
        )}
      </Paper>
      {offer && (
        <Paper component="section" elevation={0} sx={{ ...cardSx, bgcolor: "primary.light" }}>
          <Typography component="h2" variant="h5">
            {labels.specialOffer}
          </Typography>
          <Typography sx={{ mt: 2, fontWeight: 700 }}>{offer.name}</Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: "baseline", mt: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>{offer.price}</Typography>
            {offer.originalPrice && (
              <Typography color="text.secondary" sx={{ textDecoration: "line-through" }}>
                {offer.originalPrice}
              </Typography>
            )}
          </Stack>
          <Link className={styles.actionLink} href={`/menu/${encodeURIComponent(offer.slug)}`}>
            {labels.exploreOffer}
          </Link>
        </Paper>
      )}
      <Box component="section" aria-labelledby="profile-shortcuts-title">
        <Typography component="h2" id="profile-shortcuts-title" variant="h5" sx={{ mb: 2 }}>
          {labels.shortcuts}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {(
            [
              ["/profile/orders", labels.orders],
              ["/profile/addresses", labels.addresses],
              ["/profile/information", labels.information],
              ["/menu", labels.menu],
            ] as const
          ).map(([href, label]) => (
            <Link className={styles.shortcut} href={href} key={href}>
              {label}
            </Link>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}
