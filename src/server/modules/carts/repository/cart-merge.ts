import "server-only";

import { Types } from "mongoose";
import type { ClientSession, Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";
import { withMongoTransaction } from "@/server/database/transaction-boundary";

import {
  CART_GUEST_TOKEN_HASH_PATTERN,
  getCartModel,
  type CartPricingSummary,
} from "../model/cart";
import { mapCartSnapshot, type CartSnapshot } from "./cart";

export type CartMergePlan = Readonly<{
  customerExpiresAt: Date;
  lines: readonly Readonly<{ dishId: string; quantity: number }>[];
  notes: string | null;
  pricing: CartPricingSummary;
}>;

export type CartMergeTransactionState = Readonly<{
  customer: CartSnapshot;
  guest: CartSnapshot;
  session: ClientSession;
}>;

export type CartMergeRepositoryResult = Readonly<{
  customer: CartSnapshot;
  guestCartId: string;
  idempotent: boolean;
}>;

export class CartMergeRepositoryError extends Error {
  constructor(
    readonly code: "conflict" | "guest_expired" | "guest_not_found" | "target_not_found",
  ) {
    super(code);
    this.name = "CartMergeRepositoryError";
  }
}

export interface CartMergeRepository {
  merge(
    input: Readonly<{
      customerId: string;
      guestTokenHash: string;
      now: Date;
      purgeAt: Date;
    }>,
    prepare: (state: CartMergeTransactionState) => Promise<CartMergePlan>,
  ): Promise<CartMergeRepositoryResult>;
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError") ||
      ("errorLabels" in error &&
        Array.isArray(error.errorLabels) &&
        error.errorLabels.includes("TransientTransactionError")))
  );
}

export function createCartMergeRepository(connection: Connection): CartMergeRepository {
  const Cart = getCartModel(connection);

  return {
    async merge(input, prepare) {
      if (
        !Types.ObjectId.isValid(input.customerId) ||
        !CART_GUEST_TOKEN_HASH_PATTERN.test(input.guestTokenHash) ||
        !Number.isFinite(input.now.getTime()) ||
        !Number.isFinite(input.purgeAt.getTime()) ||
        input.purgeAt.getTime() <= input.now.getTime()
      ) {
        throw new TypeError("Invalid cart merge repository input.");
      }
      try {
        return await withMongoTransaction(connection, async (session) => {
          const guest = await Cart.findOne({ guestTokenHash: input.guestTokenHash })
            .select("+guestTokenHash")
            .session(session);
          if (!guest) throw new CartMergeRepositoryError("guest_not_found");

          if (guest.status === "merged") {
            if (!guest.mergedIntoCartId) throw new CartMergeRepositoryError("target_not_found");
            const target = await Cart.findOne({
              _id: guest.mergedIntoCartId,
              customerId: new Types.ObjectId(input.customerId),
            }).session(session);
            if (!target) throw new CartMergeRepositoryError("target_not_found");
            return Object.freeze({
              customer: mapCartSnapshot(target),
              guestCartId: guest._id.toHexString(),
              idempotent: true,
            });
          }
          if (guest.status !== "active") throw new CartMergeRepositoryError("guest_not_found");
          if (
            guest.expiresAt.getTime() <= input.now.getTime() ||
            (guest.absoluteExpiresAt && guest.absoluteExpiresAt.getTime() <= input.now.getTime())
          ) {
            throw new CartMergeRepositoryError("guest_expired");
          }

          let customer = await Cart.findOne({
            status: "active",
            customerId: new Types.ObjectId(input.customerId),
          }).session(session);
          const customerWasCreated = !customer;
          if (!customer) {
            customer = new Cart({
              customerId: new Types.ObjectId(input.customerId),
              expiresAt: input.now,
              createdBy: createActorMetadata("customer", input.customerId),
              updatedBy: createActorMetadata("customer", input.customerId),
            });
            // Establish timestamps and the unique active-customer claim inside this transaction. A
            // later planning failure rolls the insert back with the guest transition.
            await customer.save({ session });
          }

          const plan = await prepare({
            customer: mapCartSnapshot(customer),
            guest: mapCartSnapshot(guest),
            session,
          });
          customer.lines = plan.lines.map(({ dishId, quantity }) => ({
            dishId: new Types.ObjectId(dishId),
            quantity,
          }));
          customer.notes = plan.notes;
          customer.pricing = { ...plan.pricing };
          customer.expiresAt = plan.customerExpiresAt;
          if (!customerWasCreated) customer.version += 1;
          customer.updatedBy = createActorMetadata("customer", input.customerId);
          await customer.save({ session });

          guest.status = "merged";
          guest.mergedIntoCartId = customer._id;
          guest.purgeAt = input.purgeAt;
          guest.version += 1;
          guest.updatedBy = createActorMetadata("system");
          await guest.save({ session });

          return Object.freeze({
            customer: mapCartSnapshot(customer),
            guestCartId: guest._id.toHexString(),
            idempotent: false,
          });
        });
      } catch (error) {
        if (error instanceof CartMergeRepositoryError) throw error;
        if (isConflict(error)) throw new CartMergeRepositoryError("conflict");
        throw error;
      }
    },
  };
}
