import "server-only";

import { Types } from "mongoose";

import {
  calculateCartPricing,
  type CartPricingAdjustment,
  type CartPricingDependencies,
  type CartPricingResult,
  type DeliveryPriceBand,
} from "../pricing/cart-pricing";
import {
  validateCartAvailability,
  type CartAvailabilityDependencies,
  type CartAvailabilityResult,
  type CartServicePolicy,
} from "../availability/cart-availability";
import {
  CART_MAX_DISTINCT_LINES,
  CART_MAX_NOTES_LENGTH,
  CART_MAX_QUANTITY_PER_LINE,
  type CartPricingSummary,
} from "../model/cart";
import {
  CartRepositoryConflictError,
  type CartIdentity,
  type CartRepository,
  type CartSnapshot,
  type CartWrite,
} from "../repository/cart";

export const CART_GUEST_IDLE_TTL_MS = 30 * 24 * 60 * 60_000;
export const CART_GUEST_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60_000;
export const CART_CUSTOMER_IDLE_TTL_MS = 180 * 24 * 60 * 60_000;
export const CART_TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60_000;

export const CART_CRUD_ACTIONS = [
  "get",
  "create",
  "add_item",
  "update_quantity",
  "remove_item",
  "clear",
  "set_notes",
  "select_address",
  "recalculate",
  "expire",
] as const;

export type CartCrudAction = (typeof CART_CRUD_ACTIONS)[number];
export type CartCrudAuditEvent = Readonly<{
  action: CartCrudAction;
  actorRef: string | null;
  cartId: string | null;
  identityKind: CartIdentity["kind"];
  outcome: "success" | "failure" | "conflict";
}>;

export type CartRuntimePolicies = Readonly<{
  adjustments?: readonly CartPricingAdjustment[];
  deliveryBands: readonly DeliveryPriceBand[];
  servicePolicy: CartServicePolicy;
}>;

export type CartDeliveryResolution = Readonly<{
  distanceMeters?: number;
  eligible: boolean;
  reason?: "outside_service_area" | "unverified_address";
}>;

export type CartOperationResult = Readonly<{
  availability: CartAvailabilityResult;
  cart: CartSnapshot;
  pricing: CartPricingResult;
  pricingChanged: boolean;
}>;

export type CartExpirationResult = Readonly<{
  cartId: string;
  pricing: CartSnapshot["pricing"];
  version: number;
}>;

export type CartCrudDependencies = Readonly<{
  audit(event: CartCrudAuditEvent): Promise<void>;
  availability: CartAvailabilityDependencies;
  loadPolicies(): Promise<CartRuntimePolicies>;
  now(): Date;
  pricing: CartPricingDependencies;
  repository: CartRepository;
  resolveDelivery(customerId: string, addressId: string): Promise<CartDeliveryResolution>;
}>;

export class CartCrudError extends Error {
  constructor(
    readonly code:
      "availability_changed" | "conflict" | "expired" | "forbidden" | "invalid_input" | "not_found",
    readonly details: Readonly<{
      availability?: CartAvailabilityResult;
      current?: CartOperationResult;
    }> = {},
  ) {
    super(code);
    this.name = "CartCrudError";
  }
}

type MutableCartState = {
  lines: { dishId: string; quantity: number }[];
  notes: string | null;
  selectedAddressId: string | null;
};

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

function validDishId(value: string): boolean {
  return Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/iu.test(value);
}

function expiryFor(identity: CartIdentity, now: Date, absoluteExpiresAt?: string | null) {
  if (identity.kind === "customer") {
    return {
      expiresAt: new Date(now.getTime() + CART_CUSTOMER_IDLE_TTL_MS),
      absoluteExpiresAt: null,
    };
  }
  const absolute = absoluteExpiresAt
    ? new Date(absoluteExpiresAt)
    : new Date(now.getTime() + CART_GUEST_ABSOLUTE_TTL_MS);
  return {
    absoluteExpiresAt: absolute,
    expiresAt: new Date(Math.min(now.getTime() + CART_GUEST_IDLE_TTL_MS, absolute.getTime())),
  };
}

function mutable(snapshot: CartSnapshot): MutableCartState {
  return {
    lines: snapshot.lines.map(({ dishId, quantity }) => ({ dishId, quantity })),
    notes: snapshot.notes,
    selectedAddressId: snapshot.selectedAddressId,
  };
}

function pricingSummary(result: CartPricingResult): CartPricingSummary {
  return {
    subtotalCents: result.summary.subtotalCents,
    discountCents: result.summary.discountCents,
    deliveryFeeCents: result.summary.deliveryFeeCents,
    taxCents: result.summary.taxCents,
    adjustmentsCents: result.summary.adjustmentsCents,
    totalCents: result.summary.totalCents,
    calculatedAt: new Date(result.summary.calculatedAt),
  };
}

function cartWithPricing(cart: CartSnapshot, result: CartPricingResult): CartSnapshot {
  return Object.freeze({
    ...cart,
    pricing: Object.freeze({
      subtotalCents: result.summary.subtotalCents,
      discountCents: result.summary.discountCents,
      deliveryFeeCents: result.summary.deliveryFeeCents,
      taxCents: result.summary.taxCents,
      adjustmentsCents: result.summary.adjustmentsCents,
      totalCents: result.summary.totalCents,
      calculatedAt: result.summary.calculatedAt,
    }),
  });
}

function validateIdentity(identity: CartIdentity): void {
  if (
    !identity ||
    (identity.kind === "customer" && !Types.ObjectId.isValid(identity.customerId)) ||
    (identity.kind === "guest" && !/^[a-f\d]{64}$/u.test(identity.guestTokenHash))
  ) {
    throw new CartCrudError("invalid_input");
  }
}

export function createCartCrudServices(dependencies: CartCrudDependencies) {
  async function audit(
    action: CartCrudAction,
    identity: CartIdentity,
    cartId: string | null,
    outcome: CartCrudAuditEvent["outcome"],
  ) {
    await dependencies.audit({
      action,
      identityKind: identity.kind,
      actorRef: identity.kind === "customer" ? identity.customerId : null,
      cartId,
      outcome,
    });
  }

  async function calculate(
    cart: CartSnapshot,
    state: MutableCartState,
    at: Date,
    stage: "cart_mutation" | "checkout" = "cart_mutation",
    allowUnavailable = false,
  ): Promise<Readonly<{ availability: CartAvailabilityResult; pricing: CartPricingResult }>> {
    const policies = await dependencies.loadPolicies();
    let delivery: CartDeliveryResolution | null = null;
    if (state.selectedAddressId) {
      if (!cart.customerId) throw new CartCrudError("forbidden");
      delivery = await dependencies.resolveDelivery(cart.customerId, state.selectedAddressId);
    }
    const availability = await validateCartAvailability(
      {
        at,
        stage,
        lines: state.lines,
        servicePolicy: policies.servicePolicy,
        fulfillment: delivery
          ? {
              method: "delivery",
              deliveryArea: {
                eligible: delivery.eligible,
                ...(delivery.reason ? { reason: delivery.reason } : {}),
              },
            }
          : { method: "pickup" },
      },
      dependencies.availability,
    );
    if (!availability.valid && !allowUnavailable) {
      throw new CartCrudError("availability_changed", { availability });
    }

    if (
      delivery?.eligible &&
      (!Number.isSafeInteger(delivery.distanceMeters) || delivery.distanceMeters! < 0)
    ) {
      throw new CartCrudError("invalid_input");
    }
    const pricing = await calculateCartPricing(
      {
        at,
        lines: state.lines,
        ...(policies.adjustments ? { adjustments: policies.adjustments } : {}),
        deliveryBands: policies.deliveryBands,
        fulfillment:
          state.lines.length === 0 || !delivery
            ? { method: "pickup" }
            : { method: "delivery", distanceMeters: delivery.distanceMeters! },
      },
      dependencies.pricing,
    );
    return { availability, pricing };
  }

  async function active(identity: CartIdentity): Promise<CartSnapshot | null> {
    validateIdentity(identity);
    const cart = await dependencies.repository.findActive(identity);
    if (!cart) return null;
    const now = dependencies.now();
    const expired =
      new Date(cart.expiresAt).getTime() <= now.getTime() ||
      (cart.absoluteExpiresAt !== null &&
        new Date(cart.absoluteExpiresAt).getTime() <= now.getTime());
    if (!expired) return cart;
    try {
      await dependencies.repository.expire(
        cart,
        cart.version,
        new Date(now.getTime() + CART_TERMINAL_RETENTION_MS),
      );
    } catch (error) {
      if (!(error instanceof CartRepositoryConflictError)) throw error;
    }
    return null;
  }

  async function currentResult(
    cart: CartSnapshot,
    allowUnavailable = false,
  ): Promise<CartOperationResult> {
    const result = await calculate(
      cart,
      mutable(cart),
      dependencies.now(),
      "cart_mutation",
      allowUnavailable,
    );
    const pricingChanged =
      cart.pricing.subtotalCents !== result.pricing.summary.subtotalCents ||
      cart.pricing.discountCents !== result.pricing.summary.discountCents ||
      cart.pricing.deliveryFeeCents !== result.pricing.summary.deliveryFeeCents ||
      cart.pricing.taxCents !== result.pricing.summary.taxCents ||
      cart.pricing.adjustmentsCents !== result.pricing.summary.adjustmentsCents ||
      cart.pricing.totalCents !== result.pricing.summary.totalCents;
    return Object.freeze({
      cart: cartWithPricing(cart, result.pricing),
      ...result,
      pricingChanged,
    });
  }

  async function conflict(identity: CartIdentity): Promise<never> {
    const fresh = await active(identity);
    let current: CartOperationResult | undefined;
    if (fresh) {
      try {
        current = await currentResult(fresh);
      } catch {
        // A separate availability error is returned by the next explicit refresh.
      }
    }
    throw new CartCrudError("conflict", current ? { current } : {});
  }

  async function mutate(
    action: CartCrudAction,
    identity: CartIdentity,
    expectedVersion: number,
    change: (state: MutableCartState, cart: CartSnapshot) => void | Promise<void>,
  ): Promise<CartOperationResult> {
    validateIdentity(identity);
    if (!validVersion(expectedVersion)) throw new CartCrudError("invalid_input");
    const cart = await active(identity);
    if (!cart) {
      await audit(action, identity, null, "failure");
      throw new CartCrudError("not_found");
    }
    if (cart.version !== expectedVersion) {
      await audit(action, identity, cart.id, "conflict");
      return conflict(identity);
    }
    try {
      const state = mutable(cart);
      await change(state, cart);
      const now = dependencies.now();
      const calculated = await calculate(cart, state, now);
      const expiry = expiryFor(identity, now, cart.absoluteExpiresAt);
      const write: CartWrite = {
        ...state,
        expiresAt: expiry.expiresAt,
        pricing: pricingSummary(calculated.pricing),
      };
      const saved = await dependencies.repository.save(cart, expectedVersion, write);
      const result = Object.freeze({
        cart: cartWithPricing(saved, calculated.pricing),
        ...calculated,
        pricingChanged: false,
      });
      await audit(action, identity, saved.id, "success");
      return result;
    } catch (error) {
      if (error instanceof CartRepositoryConflictError) {
        await audit(action, identity, cart.id, "conflict");
        return conflict(identity);
      }
      await audit(action, identity, cart.id, "failure");
      throw error;
    }
  }

  return {
    async get(identity: CartIdentity): Promise<CartOperationResult | null> {
      validateIdentity(identity);
      const cart = await active(identity);
      if (!cart) return null;
      const result = await currentResult(cart, true);
      await audit("get", identity, cart.id, "success");
      return result;
    },

    async create(identity: CartIdentity): Promise<CartOperationResult> {
      validateIdentity(identity);
      const existing = await active(identity);
      if (existing) return currentResult(existing);
      const now = dependencies.now();
      try {
        const cart = await dependencies.repository.create(identity, expiryFor(identity, now));
        const result = await currentResult(cart);
        await audit("create", identity, cart.id, "success");
        return result;
      } catch (error) {
        if (error instanceof CartRepositoryConflictError) {
          const winner = await active(identity);
          if (winner) return currentResult(winner);
        }
        await audit("create", identity, null, "failure");
        throw error;
      }
    },

    addItem(identity: CartIdentity, expectedVersion: number, dishId: string, quantity: number) {
      if (!validDishId(dishId) || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new CartCrudError("invalid_input");
      }
      return mutate("add_item", identity, expectedVersion, (state) => {
        const normalizedId = dishId.toLowerCase();
        const line = state.lines.find(({ dishId: currentId }) => currentId === normalizedId);
        const nextQuantity = (line?.quantity ?? 0) + quantity;
        if (nextQuantity > CART_MAX_QUANTITY_PER_LINE) throw new CartCrudError("invalid_input");
        if (line) line.quantity = nextQuantity;
        else {
          if (state.lines.length >= CART_MAX_DISTINCT_LINES)
            throw new CartCrudError("invalid_input");
          state.lines.push({ dishId: normalizedId, quantity });
        }
      });
    },

    updateQuantity(
      identity: CartIdentity,
      expectedVersion: number,
      dishId: string,
      quantity: number,
    ) {
      if (
        !validDishId(dishId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > CART_MAX_QUANTITY_PER_LINE
      ) {
        throw new CartCrudError("invalid_input");
      }
      return mutate("update_quantity", identity, expectedVersion, (state) => {
        const line = state.lines.find(
          ({ dishId: currentId }) => currentId === dishId.toLowerCase(),
        );
        if (!line) throw new CartCrudError("not_found");
        line.quantity = quantity;
      });
    },

    removeItem(identity: CartIdentity, expectedVersion: number, dishId: string) {
      if (!validDishId(dishId)) throw new CartCrudError("invalid_input");
      return mutate("remove_item", identity, expectedVersion, (state) => {
        const index = state.lines.findIndex(
          ({ dishId: currentId }) => currentId === dishId.toLowerCase(),
        );
        if (index < 0) throw new CartCrudError("not_found");
        state.lines.splice(index, 1);
      });
    },

    clear(identity: CartIdentity, expectedVersion: number) {
      return mutate("clear", identity, expectedVersion, (state) => {
        state.lines = [];
      });
    },

    setNotes(identity: CartIdentity, expectedVersion: number, notes: string | null) {
      if (notes !== null && typeof notes !== "string") throw new CartCrudError("invalid_input");
      const normalized = notes?.trim() || null;
      if (normalized && normalized.length > CART_MAX_NOTES_LENGTH) {
        throw new CartCrudError("invalid_input");
      }
      return mutate("set_notes", identity, expectedVersion, (state) => {
        state.notes = normalized;
      });
    },

    selectAddress(identity: CartIdentity, expectedVersion: number, addressId: string | null) {
      if (identity.kind !== "customer") throw new CartCrudError("forbidden");
      if (addressId !== null && !Types.ObjectId.isValid(addressId)) {
        throw new CartCrudError("invalid_input");
      }
      return mutate("select_address", identity, expectedVersion, (state) => {
        state.selectedAddressId = addressId?.toLowerCase() ?? null;
      });
    },

    recalculate(identity: CartIdentity, expectedVersion: number) {
      return mutate("recalculate", identity, expectedVersion, () => undefined);
    },

    async expire(identity: CartIdentity, expectedVersion: number): Promise<CartExpirationResult> {
      validateIdentity(identity);
      if (!validVersion(expectedVersion)) throw new CartCrudError("invalid_input");
      const cart = await active(identity);
      if (!cart) throw new CartCrudError("not_found");
      if (cart.version !== expectedVersion) return conflict(identity);
      const current = await currentResult(cart);
      try {
        await dependencies.repository.expire(
          cart,
          expectedVersion,
          new Date(dependencies.now().getTime() + CART_TERMINAL_RETENTION_MS),
        );
      } catch (error) {
        if (error instanceof CartRepositoryConflictError) return conflict(identity);
        await audit("expire", identity, cart.id, "failure");
        throw error;
      }
      await audit("expire", identity, cart.id, "success");
      return Object.freeze({
        cartId: cart.id,
        version: cart.version + 1,
        pricing: current.cart.pricing,
      });
    },
  };
}
