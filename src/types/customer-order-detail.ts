import type { OrderStatus } from "@/constants/order-status";

export type CustomerPaymentStatus =
  | "created"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"
  | "partially-refunded"
  | "refunded"
  | "unknown";

export type CustomerOrderDetail = Readonly<{
  code: string;
  status: OrderStatus;
  revision: number;
  createdAt: string;
  currency: "EUR";
  customerName: string;
  notes: string | null;
  address: Readonly<{
    name: string;
    recipientName: string;
    recipientMobile: string;
    formattedAddress: string;
    postalCode: string;
    deliveryNotes: string | null;
  }> | null;
  items: readonly Readonly<{
    slug: string;
    name: string;
    quantity: number;
    portionAmount: number;
    portionUnit: "serving" | "piece" | "gram" | "millilitre";
    baseUnitPriceCents: number;
    effectiveUnitPriceCents: number;
    lineDiscountCents: number;
    lineSubtotalCents: number;
  }>[];
  pricing: Readonly<{
    subtotalCents: number;
    discountCents: number;
    deliveryFeeCents: number;
    taxCents: number;
    adjustmentsCents: number;
    totalCents: number;
    freeDeliveryApplied: boolean;
  }>;
  fulfillment: Readonly<{
    method: "pickup" | "delivery";
    leadTimeMinutes: number;
    earliestReadyAt: string;
    completedAt: string | null;
  }>;
  paymentStatus: CustomerPaymentStatus;
  canCancel: boolean;
  canStartNewOrder: boolean;
  history: readonly Readonly<{
    status: OrderStatus;
    paymentStatus: CustomerPaymentStatus;
    occurredAt: string;
  }>[];
}>;
