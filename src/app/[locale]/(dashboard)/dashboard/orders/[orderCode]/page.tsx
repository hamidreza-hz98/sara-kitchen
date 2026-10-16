import { notFound } from "next/navigation";

import { requireAdminPage } from "@/server/auth/page-guards";
import { connectToDatabase } from "@/server/database";
import {
  createOrderManagement,
  orderCodeParametersSchema,
  OrderManagementError,
} from "@/server/modules/orders";
import { createTransactionManagement } from "@/server/modules/transactions";

import { OrderDetails, type DetailOrder, type DetailTransaction } from "./order-details";

type PageProps = { params: Promise<{ locale?: string; orderCode: string }> };

export default async function DashboardOrderDetailsPage({ params }: PageProps) {
  const admin = await requireAdminPage("orders:read");
  const { orderCode } = await params;
  const parsed = orderCodeParametersSchema.safeParse({ orderCode });
  if (!parsed.success) notFound();

  const connection = await connectToDatabase();
  const actor = { id: admin.id, role: admin.role, active: true as const };
  const context = { requestId: "dashboard-order-details", userAgent: null };
  let order: Awaited<ReturnType<ReturnType<typeof createOrderManagement>["get"]>>;
  try {
    order = await createOrderManagement(connection, context).get(actor, parsed.data.orderCode);
  } catch (error) {
    if (error instanceof OrderManagementError && error.code === "not_found") notFound();
    throw error;
  }

  const permissions = new Set(admin.permissions);
  const canReadTransactions = permissions.has("transactions:read");
  const transactions = canReadTransactions
    ? await Promise.all(
        order.transactionIds.map((id) =>
          createTransactionManagement(connection, context).get(actor, id),
        ),
      )
    : [];
  if (transactions.some((transaction) => transaction.orderId !== order.id)) {
    throw new Error("An order transaction reference did not match its order.");
  }
  const transactionViews: DetailTransaction[] = transactions.map((transaction) => ({
    id: transaction.id,
    orderId: transaction.orderId,
    method: transaction.method,
    provider: transaction.provider,
    status: transaction.status,
    amounts: transaction.amounts,
    responseCode: transaction.responseCode,
    events: transaction.events.map((event) => ({
      status: event.status,
      source: event.source,
      amountCents: event.amountCents,
      responseCode: event.responseCode,
      occurredAt: event.occurredAt,
    })),
    createdAt: transaction.createdAt,
  }));

  return (
    <OrderDetails
      initialOrder={JSON.parse(JSON.stringify(order)) as DetailOrder}
      initialTransactions={JSON.parse(JSON.stringify(transactionViews)) as DetailTransaction[]}
      capabilities={{
        readSensitive: permissions.has("orders:read-sensitive"),
        readTransactions: canReadTransactions,
        update: permissions.has("orders:update"),
        cancel: permissions.has("orders:cancel"),
      }}
    />
  );
}
