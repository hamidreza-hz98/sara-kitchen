import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { PROJECT_TIME_ZONE, type SupportedLocale } from "@/constants";
import { ApiError } from "@/server/http";
import { evaluatePortoDelivery, loadOwnedAddressForCheckout } from "@/server/modules/addresses";
import {
  calculateCartPricing,
  convertCustomerCartForCheckout,
  loadCustomerCartForCheckout,
  validateCartAvailability,
  type DeliveryPriceBand,
} from "@/server/modules/carts";
import {
  loadCustomerIdentityForCheckout,
  normalizeCustomerMobile,
} from "@/server/modules/customers";
import { loadDishCartSources, loadDishCheckoutSnapshots } from "@/server/modules/dishes";
import {
  getCheckoutContactSettings,
  getCheckoutPolicies,
  recordPolicyConsent,
} from "@/server/modules/settings";
import {
  createCheckoutTransaction,
  persistMbWaySandboxInitiation,
  runIdempotentOperation,
  type PaymentProvider,
} from "@/server/modules/transactions";

import { getCheckoutInitiationModel } from "../model/checkout-initiation";
import { getOrderModel, type OrderItemSnapshot } from "../model/order";

const RETENTION_MS = 30 * 24 * 60 * 60_000;

export type CheckoutSubmission = Readonly<{
  expectedCartVersion: number;
  paymentMethod: "mbway";
  paymentPhone: string;
  acceptedPolicies: readonly Readonly<{ id: string; version: number }>[];
}>;

export type CheckoutResult = Readonly<{
  orderCode: string;
  orderId: string;
  transactionId: string;
  paymentStatus: "pending" | "needs_reconciliation";
  replayed: boolean;
}>;

export async function submitAtomicCheckout(
  input: Readonly<{
    connection: Connection;
    customerId: string;
    locale: SupportedLocale;
    idempotencyKey: string;
    submission: CheckoutSubmission;
    deliveryBands: readonly DeliveryPriceBand[];
    kitchen: Readonly<{ latitude: number; longitude: number }>;
    serviceRadiusKm: number | null;
    provider: PaymentProvider;
    now?: () => Date;
  }>,
): Promise<CheckoutResult> {
  const { connection, customerId, submission } = input;
  const now = input.now ?? (() => new Date());
  const committed = await runIdempotentOperation({
    connection,
    scope: "checkout",
    subject: customerId,
    key: input.idempotencyKey,
    retentionMs: RETENTION_MS,
    request: {
      expectedCartVersion: submission.expectedCartVersion,
      paymentMethod: submission.paymentMethod,
      paymentPhone: submission.paymentPhone,
      acceptedPolicies: submission.acceptedPolicies.map((policy) => ({
        id: policy.id,
        version: policy.version,
      })),
    },
    execute: async (session) => {
      const at = now();
      const cart = await loadCustomerCartForCheckout(connection, customerId, session);
      if (
        !cart ||
        cart.version !== submission.expectedCartVersion ||
        cart.expiresAt <= at ||
        cart.lines.length === 0
      ) {
        throw ApiError.conflict({
          resource: "cart",
          publicMessage: "Your cart changed or expired. Review it before paying.",
        });
      }
      if (cart.selectedAddressId === null && !cart.pickupConfirmed) {
        throw ApiError.conflict({
          resource: "cart",
          publicMessage: "Choose delivery or confirm pickup before paying.",
        });
      }
      const customer = await loadCustomerIdentityForCheckout(connection, customerId, session);
      if (!customer) throw ApiError.authentication();
      // The sandbox only accepts the account's own Portuguese mobile. No separate payer PII is persisted.
      const paymentPhone = normalizeCustomerMobile(submission.paymentPhone);
      if (paymentPhone !== customer.mobile || !/^\+3519\d{8}$/u.test(paymentPhone)) {
        throw ApiError.conflict({
          resource: "payment",
          publicMessage: "Use the Portuguese mobile number registered to your account for MB Way.",
        });
      }
      const policies = await getCheckoutPolicies(connection, input.locale, at, session);
      const contact = await getCheckoutContactSettings(connection, input.locale, session);
      const kitchen = contact?.location ?? input.kitchen;
      const deliveryBands = contact?.deliveryBands ?? input.deliveryBands;
      const serviceRadiusKm = contact
        ? contact.serviceArea.mode === "radius"
          ? contact.serviceArea.radiusKm
          : null
        : input.serviceRadiusKm;
      if (
        policies.length !== 2 ||
        policies.some(
          (policy) =>
            !submission.acceptedPolicies.some(
              (accepted) => accepted.id === policy.id && accepted.version === policy.version,
            ),
        )
      ) {
        throw ApiError.conflict({
          resource: "policies",
          publicMessage:
            "The terms or privacy policy changed. Review and accept the current versions.",
        });
      }
      const address = cart.selectedAddressId
        ? await loadOwnedAddressForCheckout(connection, customerId, cart.selectedAddressId, session)
        : null;
      if (cart.selectedAddressId && !address)
        throw ApiError.conflict({
          resource: "address",
          publicMessage: "The selected delivery address is no longer available.",
        });
      const delivery = address ? evaluatePortoDelivery(address.location, kitchen) : null;
      if (
        delivery &&
        (!delivery.eligible ||
          (serviceRadiusKm !== null && delivery.distanceMeters > serviceRadiusKm * 1_000))
      ) {
        throw ApiError.conflict({
          resource: "address",
          publicMessage: "The selected address is outside the delivery area.",
        });
      }
      const dishIds = cart.lines.map((line) => line.dishId);
      const sources = await loadDishCartSources(connection, dishIds, session);
      const availability = await validateCartAvailability(
        {
          at,
          stage: "checkout",
          lines: cart.lines,
          servicePolicy: {
            mode: "always",
            timeZone: PROJECT_TIME_ZONE,
            cutoffMinutesBeforeClose: 0,
          },
          fulfillment: address
            ? { method: "delivery", deliveryArea: { eligible: true } }
            : { method: "pickup" },
        },
        { loadDishesByIds: async () => sources.map((source) => source.availability) },
      );
      if (!availability.valid)
        throw ApiError.conflict({
          resource: "cart",
          availability,
          publicMessage: "Some dishes are no longer available. Review your cart.",
        });
      const pricing = await calculateCartPricing(
        {
          at,
          lines: cart.lines,
          deliveryBands,
          fulfillment:
            address && delivery
              ? { method: "delivery", distanceMeters: delivery.distanceMeters }
              : { method: "pickup" },
        },
        { loadDishesByIds: async () => sources.map((source) => source.pricing) },
      );
      if (
        (
          [
            "subtotalCents",
            "discountCents",
            "deliveryFeeCents",
            "taxCents",
            "adjustmentsCents",
            "totalCents",
          ] as const
        ).some((key) => cart.pricing[key] !== pricing.summary[key])
      ) {
        throw ApiError.conflict({
          resource: "cart",
          publicMessage: "Prices changed. Review your cart before paying.",
        });
      }
      if (pricing.summary.totalCents < 1)
        throw ApiError.conflict({
          resource: "payment",
          publicMessage: "This order cannot be charged with MB Way. Contact the kitchen.",
        });
      const dishSnapshots = await loadDishCheckoutSnapshots(
        connection,
        dishIds,
        input.locale,
        session,
      );
      if (dishSnapshots.length !== cart.lines.length)
        throw ApiError.conflict({
          resource: "cart",
          publicMessage: "A dish changed. Review your cart.",
        });
      const snapshotById = new Map(dishSnapshots.map((dish) => [dish.id, dish]));
      const items: OrderItemSnapshot[] = pricing.lines.map((line) => {
        const dish = snapshotById.get(line.dishId)!;
        const discount =
          line.unitDiscountCents === 0
            ? { type: "none" as const, amountCents: null, basisPoints: null }
            : dish.discount.type === "fixed"
              ? { type: "fixed" as const, amountCents: line.unitDiscountCents, basisPoints: null }
              : {
                  type: "percentage" as const,
                  amountCents: null,
                  basisPoints: dish.discount.basisPoints,
                };
        return {
          dishId: new Types.ObjectId(line.dishId),
          slug: dish.slug,
          name: dish.name,
          portionAmount: dish.portionAmount,
          portionUnit: dish.portionUnit,
          quantity: line.quantity,
          leadTimeMinutes: dish.leadTimeMinutes,
          baseUnitPriceCents: line.baseUnitPriceCents,
          effectiveUnitPriceCents: line.effectiveUnitPriceCents,
          unitDiscountCents: line.unitDiscountCents,
          lineBaseSubtotalCents: line.lineBaseSubtotalCents,
          lineDiscountCents: line.lineDiscountCents,
          lineSubtotalCents: line.lineSubtotalCents,
          discount,
        };
      });
      const orderId = new Types.ObjectId();
      const transactionId = new Types.ObjectId();
      const providerKey = `sk_checkout_${orderId.toHexString()}`;
      const leadTimeMinutes = availability.orderLeadTimeMinutes;
      const [order] = await getOrderModel(connection).create(
        [
          {
            _id: orderId,
            status: "pending_payment",
            statusHistory: [
              {
                eventKey: `checkout:${orderId.toHexString()}`,
                status: "pending_payment",
                actorKind: "system",
                actorId: null,
                reasonCode: null,
                paymentStatus: "created",
                occurredAt: at,
                recordedAt: at,
              },
            ],
            revision: 1,
            customerId: new Types.ObjectId(customerId),
            customerSnapshot: customer,
            addressId: address ? new Types.ObjectId(address.id) : null,
            addressSnapshot: address
              ? {
                  name: address.name,
                  recipientName: address.recipientName,
                  recipientMobile: address.recipientMobile,
                  formattedAddress: address.formattedAddress,
                  postalCode: address.postalCode,
                  location: address.location,
                  deliveryNotes: address.deliveryNotes,
                }
              : null,
            items,
            transactionIds: [transactionId],
            notes: cart.notes,
            currency: "EUR",
            locale: input.locale,
            pricing: {
              ...pricing.summary,
              calculatedAt: at,
              taxPolicy: "disabled_mvp",
              adjustments: [...pricing.adjustments],
              delivery: {
                distanceMeters: pricing.delivery.distanceMeters,
                baseFeeCents: pricing.delivery.appliedBand?.feeCents ?? 0,
                freeDeliveryApplied: pricing.delivery.freeDeliveryApplied,
              },
            },
            fulfillment: {
              method: address ? "delivery" : "pickup",
              acceptedAt: at,
              leadTimeMinutes,
              earliestReadyAt: new Date(at.getTime() + leadTimeMinutes * 60_000),
              completedAt: null,
            },
          },
        ],
        { session },
      );
      if (!order) throw new Error("checkout_order_not_created");
      await createCheckoutTransaction(
        connection,
        {
          id: transactionId.toHexString(),
          orderId: orderId.toHexString(),
          customerId,
          amountCents: pricing.summary.totalCents,
          providerKey,
          at,
        },
        session,
      );
      for (const policy of policies) {
        await recordPolicyConsent(
          connection,
          {
            subjectKind: "order",
            subjectId: orderId.toHexString(),
            customerId,
            policyVersionId: policy.id,
            acceptedLocale: input.locale,
            acceptedAt: at,
            source: "checkout",
          },
          session,
        );
      }
      await getCheckoutInitiationModel(connection).create(
        [{ orderId, transactionId, state: "ready", attemptedAt: null, completedAt: null }],
        { session },
      );
      await convertCustomerCartForCheckout(
        connection,
        { cartId: cart.id, customerId, expectedVersion: cart.version, at },
        session,
      );
      return {
        orderCode: order.code,
        orderId: orderId.toHexString(),
        transactionId: transactionId.toHexString(),
        amountCents: pricing.summary.totalCents,
      };
    },
  });
  const result = committed.result;
  const Initiation = getCheckoutInitiationModel(connection);
  const claim = await Initiation.findOneAndUpdate(
    { orderId: new Types.ObjectId(result.orderId), state: "ready" },
    { $set: { state: "in_flight", attemptedAt: now() } },
    { returnDocument: "after" },
  );
  if (claim) {
    try {
      const providerKey = `sk_checkout_${result.orderId}`;
      const order = await getOrderModel(connection)
        .findById(result.orderId)
        .select("customerSnapshot.mobile")
        .lean();
      if (!order) throw new Error("checkout_order_missing_after_commit");
      const response = await input.provider.initiate({
        transactionId: result.transactionId,
        orderId: result.orderId,
        amountCents: result.amountCents,
        currency: "EUR",
        idempotencyKey: providerKey,
        payerMobile: order.customerSnapshot.mobile,
      });
      await persistMbWaySandboxInitiation(connection, {
        transactionId: result.transactionId,
        idempotencyKey: providerKey,
        response,
      });
      await Initiation.updateOne(
        { _id: claim._id, state: "in_flight" },
        { $set: { state: "complete", completedAt: now() } },
      );
    } catch {
      // The provider may have charged but lost its response. Never issue a second initiate call.
      await Initiation.updateOne(
        { _id: claim._id, state: "in_flight" },
        { $set: { state: "needs_reconciliation" } },
      ).catch(() => undefined);
    }
  }
  const initiation = await Initiation.findOne(
    { orderId: new Types.ObjectId(result.orderId) },
    { state: 1 },
  ).lean();
  return {
    orderCode: result.orderCode,
    orderId: result.orderId,
    transactionId: result.transactionId,
    paymentStatus: initiation?.state === "complete" ? "pending" : "needs_reconciliation",
    replayed: committed.replayed,
  };
}
