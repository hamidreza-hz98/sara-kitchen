import "server-only";

import { createHash } from "node:crypto";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { getTransactionModel } from "../model/transaction";

export async function createCheckoutTransaction(
  connection: Connection,
  input: Readonly<{
    id: string;
    orderId: string;
    customerId: string;
    amountCents: number;
    providerKey: string;
    at: Date;
  }>,
  session: ClientSession,
): Promise<void> {
  await getTransactionModel(connection).create(
    [
      {
        _id: new Types.ObjectId(input.id),
        orderId: new Types.ObjectId(input.orderId),
        customerId: new Types.ObjectId(input.customerId),
        method: "mbway",
        provider: "mbway-sandbox",
        currency: "EUR",
        amounts: {
          requestedCents: input.amountCents,
          authorizedCents: 0,
          capturedCents: 0,
          refundedCents: 0,
        },
        status: "created",
        providerReferences: { paymentId: null, requestId: null },
        idempotencyKeyHash: createHash("sha256").update(input.providerKey).digest("hex"),
        responseCode: null,
        events: [
          {
            eventKey: `checkout:${input.id}`,
            source: "system",
            status: "created",
            amountCents: null,
            responseCode: null,
            providerEventId: null,
            occurredAt: input.at,
            recordedAt: input.at,
          },
        ],
      },
    ],
    { session },
  );
}
