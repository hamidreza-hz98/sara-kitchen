import { Types } from "mongoose";

const acceptedAt = new Date("2026-10-14T10:00:00.000Z");

export function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    customerId: new Types.ObjectId(),
    customerSnapshot: {
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "+351912345678",
      email: "sara@example.test",
    },
    addressId: null,
    addressSnapshot: null,
    items: [
      {
        dishId: new Types.ObjectId(),
        slug: "fesenjan",
        name: "Fesenjan",
        portionAmount: 1,
        portionUnit: "serving" as const,
        quantity: 2,
        leadTimeMinutes: 60,
        baseUnitPriceCents: 1_000,
        effectiveUnitPriceCents: 900,
        unitDiscountCents: 100,
        lineBaseSubtotalCents: 2_000,
        lineDiscountCents: 200,
        lineSubtotalCents: 1_800,
        discount: { type: "fixed" as const, amountCents: 100, basisPoints: null },
      },
    ],
    transactionIds: [new Types.ObjectId()],
    notes: "No onions, please",
    currency: "EUR" as const,
    locale: "en" as const,
    pricing: {
      subtotalCents: 2_000,
      discountCents: 200,
      deliveryFeeCents: 0,
      taxCents: 0,
      adjustmentsCents: 0,
      totalCents: 1_800,
      taxPolicy: "disabled_mvp" as const,
      calculatedAt: acceptedAt,
      adjustments: [],
      delivery: { distanceMeters: null, baseFeeCents: 0, freeDeliveryApplied: false },
    },
    fulfillment: {
      method: "pickup" as const,
      acceptedAt,
      leadTimeMinutes: 60,
      earliestReadyAt: new Date("2026-10-14T11:00:00.000Z"),
      completedAt: null,
    },
    status: "pending_payment" as const,
    revision: 1,
    statusHistory: [
      {
        eventKey: "initial",
        status: "pending_payment" as const,
        actorKind: "system" as const,
        actorId: null,
        reasonCode: null,
        occurredAt: acceptedAt,
        recordedAt: acceptedAt,
      },
    ],
    ...overrides,
  };
}
