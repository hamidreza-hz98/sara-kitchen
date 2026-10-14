import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import {
  CART_GUEST_TOKEN_HASH_PATTERN,
  getCartModel,
  type CART_CURRENCY,
  type CartPricingSummary,
} from "../model/cart";

export type CartIdentity =
  | Readonly<{ customerId: string; kind: "customer" }>
  | Readonly<{ guestTokenHash: string; kind: "guest" }>;

export type CartSnapshot = Readonly<{
  absoluteExpiresAt: string | null;
  createdAt: string;
  currency: typeof CART_CURRENCY;
  customerId: string | null;
  expiresAt: string;
  id: string;
  lines: readonly Readonly<{ dishId: string; quantity: number }>[];
  notes: string | null;
  pricing: Readonly<{
    adjustmentsCents: number;
    calculatedAt: string | null;
    deliveryFeeCents: number;
    discountCents: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  }>;
  selectedAddressId: string | null;
  pickupConfirmed?: boolean;
  updatedAt: string;
  version: number;
}>;

export type CartWrite = Readonly<{
  expiresAt: Date;
  lines: readonly Readonly<{ dishId: string; quantity: number }>[];
  notes: string | null;
  pricing: CartPricingSummary;
  selectedAddressId: string | null;
  pickupConfirmed?: boolean;
}>;

export class CartRepositoryConflictError extends Error {
  constructor() {
    super("cart_conflict");
    this.name = "CartRepositoryConflictError";
  }
}

export interface CartRepository {
  create(
    identity: CartIdentity,
    expiry: Readonly<{ absoluteExpiresAt: Date | null; expiresAt: Date }>,
  ): Promise<CartSnapshot>;
  expire(current: CartSnapshot, expectedVersion: number, purgeAt: Date): Promise<void>;
  findActive(identity: CartIdentity): Promise<CartSnapshot | null>;
  save(current: CartSnapshot, expectedVersion: number, value: CartWrite): Promise<CartSnapshot>;
}

export function mapCartSnapshot(
  document: InstanceType<ReturnType<typeof getCartModel>>,
): CartSnapshot {
  return Object.freeze({
    id: document._id.toHexString(),
    customerId: document.customerId?.toHexString() ?? null,
    lines: Object.freeze(
      document.lines.map(({ dishId, quantity }) =>
        Object.freeze({ dishId: dishId.toHexString(), quantity }),
      ),
    ),
    selectedAddressId: document.selectedAddressId?.toHexString() ?? null,
    pickupConfirmed: document.pickupConfirmed,
    notes: document.notes,
    pricing: Object.freeze({
      subtotalCents: document.pricing.subtotalCents,
      discountCents: document.pricing.discountCents,
      deliveryFeeCents: document.pricing.deliveryFeeCents,
      taxCents: document.pricing.taxCents,
      adjustmentsCents: document.pricing.adjustmentsCents,
      totalCents: document.pricing.totalCents,
      calculatedAt: document.pricing.calculatedAt?.toISOString() ?? null,
    }),
    currency: document.currency,
    version: document.version,
    expiresAt: document.expiresAt.toISOString(),
    absoluteExpiresAt: document.absoluteExpiresAt?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  });
}

function identityFilter(identity: CartIdentity) {
  if (identity.kind === "customer") {
    if (!Types.ObjectId.isValid(identity.customerId))
      throw new TypeError("Invalid customer identity.");
    return { customerId: new Types.ObjectId(identity.customerId) };
  }
  if (!CART_GUEST_TOKEN_HASH_PATTERN.test(identity.guestTokenHash)) {
    throw new TypeError("Invalid guest identity digest.");
  }
  return { guestTokenHash: identity.guestTokenHash };
}

function actor(identity: CartIdentity) {
  return identity.kind === "customer"
    ? createActorMetadata("customer", identity.customerId)
    : createActorMetadata("system");
}

function isPersistenceConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

export function createCartRepository(connection: Connection): CartRepository {
  const Cart = getCartModel(connection);

  async function load(current: CartSnapshot, expectedVersion: number) {
    const document = await Cart.findOne({
      _id: new Types.ObjectId(current.id),
      status: "active",
      version: expectedVersion,
    }).select("+guestTokenHash");
    if (!document) throw new CartRepositoryConflictError();
    return document;
  }

  async function persist(document: InstanceType<typeof Cart>) {
    try {
      await document.save();
      return mapCartSnapshot(document);
    } catch (error) {
      if (isPersistenceConflict(error)) throw new CartRepositoryConflictError();
      throw error;
    }
  }

  return {
    async findActive(identity) {
      const document = await Cart.findOne({ status: "active", ...identityFilter(identity) });
      return document ? mapCartSnapshot(document) : null;
    },
    async create(identity, expiry) {
      const metadata = actor(identity);
      const document = new Cart({
        ...identityFilter(identity),
        expiresAt: expiry.expiresAt,
        absoluteExpiresAt: expiry.absoluteExpiresAt,
        createdBy: metadata,
        updatedBy: metadata,
      });
      return persist(document);
    },
    async save(current, expectedVersion, value) {
      const document = await load(current, expectedVersion);
      document.lines = value.lines.map(({ dishId, quantity }) => ({
        dishId: new Types.ObjectId(dishId),
        quantity,
      }));
      document.selectedAddressId = value.selectedAddressId
        ? new Types.ObjectId(value.selectedAddressId)
        : null;
      document.pickupConfirmed = value.pickupConfirmed ?? false;
      document.notes = value.notes;
      document.pricing = { ...value.pricing };
      document.expiresAt = value.expiresAt;
      document.version += 1;
      document.updatedBy = document.customerId
        ? createActorMetadata("customer", document.customerId)
        : createActorMetadata("system");
      return persist(document);
    },
    async expire(current, expectedVersion, purgeAt) {
      const document = await load(current, expectedVersion);
      document.status = "expired";
      document.purgeAt = purgeAt;
      document.version += 1;
      document.updatedBy = document.customerId
        ? createActorMetadata("customer", document.customerId)
        : createActorMetadata("system");
      await persist(document);
    },
  };
}
