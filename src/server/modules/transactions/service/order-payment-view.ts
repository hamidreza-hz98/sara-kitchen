import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { getTransactionModel, type TransactionStatus } from "../model/transaction";

/** Financial facts exposed to Orders without leaking provider credentials or event payloads. */
export async function getOrderPaymentView(
  connection: Connection,
  transactionId: string,
  session?: ClientSession,
): Promise<Readonly<{
  id: string;
  orderId: string;
  customerId: string;
  currency: "EUR";
  requestedCents: number;
  status: TransactionStatus;
}> | null> {
  if (!Types.ObjectId.isValid(transactionId)) return null;
  let query = getTransactionModel(connection)
    .findById(transactionId)
    .select("orderId customerId currency amounts.requestedCents status");
  if (session) query = query.session(session);
  const transaction = await query.lean();
  if (!transaction) return null;
  return {
    id: transaction._id.toString(),
    orderId: transaction.orderId.toString(),
    customerId: transaction.customerId.toString(),
    currency: transaction.currency,
    requestedCents: transaction.amounts.requestedCents,
    status: transaction.status,
  };
}
