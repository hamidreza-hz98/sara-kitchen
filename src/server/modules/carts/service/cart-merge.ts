import "server-only";

import type { ClientSession } from "mongoose";

import {
  validateCartAvailability,
  type CartAvailabilityDishSource,
  type CartAvailabilityIssue,
  type CartAvailabilityResult,
} from "../availability/cart-availability";
import { CART_MAX_QUANTITY_PER_LINE, type CartPricingSummary } from "../model/cart";
import {
  calculateCartPricing,
  type CartPricingDishSource,
  type CartPricingResult,
} from "../pricing/cart-pricing";
import {
  CartMergeRepositoryError,
  type CartMergeRepository,
  type CartMergeTransactionState,
} from "../repository/cart-merge";
import type { CartRuntimePolicies, CartDeliveryResolution } from "./cart-crud";
import { CART_CUSTOMER_IDLE_TTL_MS, CART_TERMINAL_RETENTION_MS } from "./cart-crud";

export type CartMergeNotice =
  | Readonly<{
      code: "quantity_capped";
      dishId: string;
      quantity: number;
      requestedQuantity: number;
    }>
  | Readonly<{
      code: "unavailable_item_skipped";
      dishId: string;
      reason: CartAvailabilityIssue["code"];
      requestedQuantity: number;
    }>
  | Readonly<{ code: "guest_notes_ignored" }>
  | Readonly<{ code: "already_merged" }>;

export type CartMergeAuditEvent = Readonly<{
  cartId: string | null;
  customerId: string;
  guestCartId: string | null;
  idempotent: boolean;
  outcome: "conflict" | "failure" | "success";
}>;

export type CartMergeResult = Readonly<{
  availability: CartAvailabilityResult;
  cart: CartMergeTransactionState["customer"];
  guestCartId: string;
  idempotent: boolean;
  notices: readonly CartMergeNotice[];
  pricing: CartPricingResult;
}>;

export type CartMergeDependencies = Readonly<{
  audit(event: CartMergeAuditEvent): Promise<void>;
  loadAvailabilitySources(
    dishIds: readonly string[],
    session: ClientSession | null,
  ): Promise<readonly CartAvailabilityDishSource[]>;
  loadPolicies(session: ClientSession | null): Promise<CartRuntimePolicies>;
  loadPricingSources(
    dishIds: readonly string[],
    session: ClientSession | null,
  ): Promise<readonly CartPricingDishSource[]>;
  now(): Date;
  repository: CartMergeRepository;
  resolveDelivery(
    customerId: string,
    addressId: string,
    session: ClientSession | null,
  ): Promise<CartDeliveryResolution>;
}>;

export class CartMergeError extends Error {
  constructor(
    readonly code: "availability_changed" | "conflict" | "guest_expired" | "not_found",
    readonly availability?: CartAvailabilityResult,
  ) {
    super(code);
    this.name = "CartMergeError";
  }
}

type CombinedLine = {
  customerQuantity: number;
  dishId: string;
  guestQuantity: number;
  quantity: number;
};

const ITEM_FAILURE_CODES = new Set<CartAvailabilityIssue["code"]>([
  "dish_not_found",
  "dish_not_active",
  "dish_unavailable",
  "dish_schedule_not_started",
  "dish_schedule_ended",
  "stock_unavailable",
]);

function combineLines(state: CartMergeTransactionState): CombinedLine[] {
  const combined = new Map<string, CombinedLine>();
  for (const line of state.customer.lines) {
    combined.set(line.dishId, {
      dishId: line.dishId,
      customerQuantity: line.quantity,
      guestQuantity: 0,
      quantity: line.quantity,
    });
  }
  for (const line of state.guest.lines) {
    const current = combined.get(line.dishId);
    if (current) {
      current.guestQuantity += line.quantity;
      current.quantity += line.quantity;
    } else {
      combined.set(line.dishId, {
        dishId: line.dishId,
        customerQuantity: 0,
        guestQuantity: line.quantity,
        quantity: line.quantity,
      });
    }
  }
  return [...combined.values()];
}

function summary(pricing: CartPricingResult): CartPricingSummary {
  return {
    subtotalCents: pricing.summary.subtotalCents,
    discountCents: pricing.summary.discountCents,
    deliveryFeeCents: pricing.summary.deliveryFeeCents,
    taxCents: pricing.summary.taxCents,
    adjustmentsCents: pricing.summary.adjustmentsCents,
    totalCents: pricing.summary.totalCents,
    calculatedAt: new Date(pricing.summary.calculatedAt),
  };
}

function cartWithPricing(
  cart: CartMergeTransactionState["customer"],
  pricing: CartPricingResult,
): CartMergeTransactionState["customer"] {
  return Object.freeze({
    ...cart,
    pricing: Object.freeze({ ...pricing.summary }),
  });
}

export function createCartMergeService(dependencies: CartMergeDependencies) {
  return async function mergeGuestCart(
    input: Readonly<{
      customerId: string;
      guestTokenHash: string;
    }>,
  ): Promise<CartMergeResult> {
    const now = dependencies.now();
    let committedAvailability: CartAvailabilityResult | undefined;
    let committedPricing: CartPricingResult | undefined;
    let committedNotices: readonly CartMergeNotice[] = [];

    try {
      const repositoryResult = await dependencies.repository.merge(
        {
          ...input,
          now,
          purgeAt: new Date(now.getTime() + CART_TERMINAL_RETENTION_MS),
        },
        async (state) => {
          const policies = await dependencies.loadPolicies(state.session);
          const combined = combineLines(state);
          const ids = Object.freeze(combined.map(({ dishId }) => dishId));
          const [availabilitySources, pricingSources] = await Promise.all([
            dependencies.loadAvailabilitySources(ids, state.session),
            dependencies.loadPricingSources(ids, state.session),
          ]);
          const sourceById = new Map(availabilitySources.map((source) => [source.id, source]));
          const notices: CartMergeNotice[] = [];

          for (const line of combined) {
            const source = sourceById.get(line.dishId);
            if (!source) {
              line.quantity = Math.min(line.quantity, CART_MAX_QUANTITY_PER_LINE);
              continue;
            }
            const maximum = Math.min(
              source.maxQuantityPerOrder,
              source.stockQuantity ?? source.maxQuantityPerOrder,
              CART_MAX_QUANTITY_PER_LINE,
            );
            if (maximum > 0 && line.quantity > maximum) {
              notices.push(
                Object.freeze({
                  code: "quantity_capped",
                  dishId: line.dishId,
                  requestedQuantity: line.quantity,
                  quantity: maximum,
                }),
              );
              line.quantity = maximum;
            } else {
              line.quantity = Math.min(line.quantity, CART_MAX_QUANTITY_PER_LINE);
            }
          }

          let delivery: CartDeliveryResolution | null = null;
          if (state.customer.selectedAddressId) {
            delivery = await dependencies.resolveDelivery(
              input.customerId,
              state.customer.selectedAddressId,
              state.session,
            );
          }
          const fulfillment = delivery
            ? {
                method: "delivery" as const,
                deliveryArea: {
                  eligible: delivery.eligible,
                  ...(delivery.reason ? { reason: delivery.reason } : {}),
                },
              }
            : ({ method: "pickup" } as const);
          const availableFor = (dishIds: readonly string[]) =>
            availabilitySources.filter((source) => dishIds.includes(source.id));
          const validate = (lines: readonly Readonly<{ dishId: string; quantity: number }>[]) =>
            validateCartAvailability(
              {
                at: now,
                stage: "cart_mutation",
                lines,
                servicePolicy: policies.servicePolicy,
                fulfillment,
              },
              { loadDishesByIds: async (dishIds) => availableFor(dishIds) },
            );

          const initial = await validate(combined);
          const rejectedIndexes = new Set<number>();
          for (const issue of initial.issues) {
            if (issue.lineIndex === null || !ITEM_FAILURE_CODES.has(issue.code)) continue;
            const line = combined[issue.lineIndex];
            if (!line) continue;
            if (line.customerQuantity > 0)
              throw new CartMergeError("availability_changed", initial);
            if (!rejectedIndexes.has(issue.lineIndex)) {
              notices.push(
                Object.freeze({
                  code: "unavailable_item_skipped",
                  dishId: line.dishId,
                  requestedQuantity: line.guestQuantity,
                  reason: issue.code,
                }),
              );
              rejectedIndexes.add(issue.lineIndex);
            }
          }
          const accepted = combined
            .filter((_line, index) => !rejectedIndexes.has(index))
            .map(({ dishId, quantity }) => Object.freeze({ dishId, quantity }));
          const availability = await validate(accepted);
          if (!availability.valid) throw new CartMergeError("availability_changed", availability);

          if (
            delivery?.eligible &&
            (!Number.isSafeInteger(delivery.distanceMeters) || delivery.distanceMeters! < 0)
          ) {
            throw new TypeError("Eligible delivery requires an authoritative distance.");
          }
          const pricing = await calculateCartPricing(
            {
              at: now,
              lines: accepted,
              deliveryBands: policies.deliveryBands,
              ...(policies.adjustments ? { adjustments: policies.adjustments } : {}),
              fulfillment:
                accepted.length === 0 || !delivery
                  ? { method: "pickup" }
                  : { method: "delivery", distanceMeters: delivery.distanceMeters! },
            },
            {
              loadDishesByIds: async (dishIds) =>
                pricingSources.filter((source) => dishIds.includes(source.id)),
            },
          );
          const customerNotes = state.customer.notes?.trim() || null;
          const guestNotes = state.guest.notes?.trim() || null;
          if (customerNotes && guestNotes && customerNotes !== guestNotes) {
            notices.push(Object.freeze({ code: "guest_notes_ignored" }));
          }
          committedAvailability = availability;
          committedPricing = pricing;
          committedNotices = Object.freeze(notices);
          return {
            lines: accepted,
            notes: customerNotes ?? guestNotes,
            pricing: summary(pricing),
            customerExpiresAt: new Date(now.getTime() + CART_CUSTOMER_IDLE_TTL_MS),
          };
        },
      );

      if (repositoryResult.idempotent) {
        const policies = await dependencies.loadPolicies(null);
        const ids = repositoryResult.customer.lines.map(({ dishId }) => dishId);
        const [availabilitySources, pricingSources] = await Promise.all([
          dependencies.loadAvailabilitySources(ids, null),
          dependencies.loadPricingSources(ids, null),
        ]);
        const delivery = repositoryResult.customer.selectedAddressId
          ? await dependencies.resolveDelivery(
              input.customerId,
              repositoryResult.customer.selectedAddressId,
              null,
            )
          : null;
        committedAvailability = await validateCartAvailability(
          {
            at: now,
            stage: "cart_mutation",
            lines: repositoryResult.customer.lines,
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
          { loadDishesByIds: async () => availabilitySources },
        );
        if (!committedAvailability.valid) {
          throw new CartMergeError("availability_changed", committedAvailability);
        }
        committedPricing = await calculateCartPricing(
          {
            at: now,
            lines: repositoryResult.customer.lines,
            deliveryBands: policies.deliveryBands,
            ...(policies.adjustments ? { adjustments: policies.adjustments } : {}),
            fulfillment:
              repositoryResult.customer.lines.length === 0 || !delivery
                ? { method: "pickup" }
                : { method: "delivery", distanceMeters: delivery.distanceMeters! },
          },
          { loadDishesByIds: async () => pricingSources },
        );
        committedNotices = Object.freeze([{ code: "already_merged" }]);
      }

      if (!committedAvailability || !committedPricing) {
        throw new CartMergeError("conflict");
      }
      const result = Object.freeze({
        cart: cartWithPricing(repositoryResult.customer, committedPricing),
        guestCartId: repositoryResult.guestCartId,
        idempotent: repositoryResult.idempotent,
        notices: committedNotices,
        availability: committedAvailability,
        pricing: committedPricing,
      });
      await dependencies.audit({
        customerId: input.customerId,
        cartId: result.cart.id,
        guestCartId: result.guestCartId,
        idempotent: result.idempotent,
        outcome: "success",
      });
      return result;
    } catch (error) {
      const mapped =
        error instanceof CartMergeRepositoryError
          ? new CartMergeError(
              error.code === "conflict"
                ? "conflict"
                : error.code === "guest_expired"
                  ? "guest_expired"
                  : "not_found",
            )
          : error;
      await dependencies.audit({
        customerId: input.customerId,
        cartId: null,
        guestCartId: null,
        idempotent: false,
        outcome:
          mapped instanceof CartMergeError && mapped.code === "conflict" ? "conflict" : "failure",
      });
      throw mapped;
    }
  };
}
