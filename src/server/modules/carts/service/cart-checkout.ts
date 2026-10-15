import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { getCartModel } from "../model/cart";

export type CheckoutCart = Readonly<{
  id: string;
  version: number;
  lines: readonly Readonly<{ dishId: string; quantity: number }>[];
  selectedAddressId: string | null;
  pickupConfirmed: boolean;
  notes: string | null;
  pricing: Readonly<{
    subtotalCents: number;
    discountCents: number;
    deliveryFeeCents: number;
    taxCents: number;
    adjustmentsCents: number;
    totalCents: number;
  }>;
  expiresAt: Date;
}>;

export async function loadCustomerCartForCheckout(
  connection: Connection,
  customerId: string,
  session: ClientSession,
): Promise<CheckoutCart | null> {
  const cart = await getCartModel(connection)
    .findOne({ customerId: new Types.ObjectId(customerId), status: "active" })
    .session(session);
  if (!cart) return null;
  return {
    id: cart._id.toHexString(),
    version: cart.version,
    lines: cart.lines.map((line) => ({
      dishId: line.dishId.toHexString(),
      quantity: line.quantity,
    })),
    selectedAddressId: cart.selectedAddressId?.toHexString() ?? null,
    pickupConfirmed: cart.pickupConfirmed,
    notes: cart.notes,
    pricing: {
      subtotalCents: cart.pricing.subtotalCents,
      discountCents: cart.pricing.discountCents,
      deliveryFeeCents: cart.pricing.deliveryFeeCents,
      taxCents: cart.pricing.taxCents,
      adjustmentsCents: cart.pricing.adjustmentsCents,
      totalCents: cart.pricing.totalCents,
    },
    expiresAt: cart.expiresAt,
  };
}

export async function convertCustomerCartForCheckout(
  connection: Connection,
  input: Readonly<{ cartId: string; customerId: string; expectedVersion: number; at: Date }>,
  session: ClientSession,
): Promise<void> {
  const result = await getCartModel(connection).updateOne(
    {
      _id: new Types.ObjectId(input.cartId),
      customerId: new Types.ObjectId(input.customerId),
      status: "active",
      version: input.expectedVersion,
    },
    {
      $set: { status: "converted", purgeAt: new Date(input.at.getTime() + 30 * 24 * 60 * 60_000) },
      $inc: { version: 1 },
    },
    { session },
  );
  if (result.modifiedCount !== 1) throw new Error("checkout_cart_conflict");
}
