import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSupportedLocale } from "@/constants";
import { formatDate, formatEuro } from "@/locales";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import { getCustomerOrderSummaryByCode } from "@/server/modules/orders";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CustomerOrderSummaryPage({
  params,
}: {
  params: Promise<{ locale: string; orderCode: string }>;
}) {
  const { locale: candidate, orderCode } = await params;
  const locale = isSupportedLocale(candidate) ? candidate : "en";
  const actor = await requireCustomerPage(`/profile/orders/${encodeURIComponent(orderCode)}`);
  const order = await getCustomerOrderSummaryByCode(await connectToDatabase(), actor.id, orderCode);
  if (!order) notFound();
  const t = await getTranslations({ locale, namespace: "profile.orderList" });
  const statusT = await getTranslations({ locale, namespace: "profile.summary.status" });
  return (
    <Stack spacing={3} sx={{ maxWidth: 850 }}>
      <Box>
        <Typography component="h1" variant="h2">
          {t("orderCode", { code: order.code })}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {formatDate(new Date(order.createdAt), locale)}
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
          >
            <Typography component="h2" variant="h5">
              {t("summaryTitle")}
            </Typography>
            <Chip label={statusT(order.status)} />
          </Stack>
          <Typography>
            {t(order.fulfillmentMethod)} · {t("itemCount", { count: order.itemCount })}
          </Typography>
          <Stack component="ul" sx={{ listStyle: "none", m: 0, p: 0, gap: 1 }}>
            {order.items.map((item, index) => (
              <Typography component="li" key={`${index}-${item.name}`}>
                {item.quantity} × {item.name}
              </Typography>
            ))}
          </Stack>
          <Typography sx={{ fontWeight: 700 }}>{formatEuro(order.totalCents, locale)}</Typography>
        </Stack>
      </Paper>
      <NextLink href="/profile/orders">{t("backToOrders")}</NextLink>
    </Stack>
  );
}
