import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  orderCancelSchema,
  orderInternalNoteSchema,
  orderListQuerySchema,
  orderTransactionSchema,
  orderTransitionSchema,
} from "@/server/modules/orders";

describe("order management input policy", () => {
  it("bounds listing and rejects unsafe filters", () => {
    expect(orderListQuerySchema.parse({}).pageSize).toBe(20);
    expect(orderListQuerySchema.safeParse({ pageSize: 5_000 }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ search: { $ne: "" } }).success).toBe(false);
  });

  it("allows only an internal note as a generic order edit", () => {
    expect(
      orderInternalNoteSchema.safeParse({
        expectedRevision: 1,
        expectedManagementRevision: 0,
        internalNote: null,
        pricing: { totalCents: 1 },
      }).success,
    ).toBe(false);
    expect(
      orderInternalNoteSchema.safeParse({
        expectedRevision: 1,
        expectedManagementRevision: 0,
        internalNote: "Kitchen callback",
      }).success,
    ).toBe(true);
  });

  it("requires a reason for cancellation and blocks snapshot edits on other actions", () => {
    expect(orderCancelSchema.safeParse({ expectedRevision: 1 }).success).toBe(false);
    expect(
      orderTransitionSchema.safeParse({
        expectedRevision: 1,
        status: "preparing",
        reasonCode: null,
        customerId: "507f1f77bcf86cd799439011",
      }).success,
    ).toBe(false);
    expect(
      orderTransactionSchema.safeParse({
        expectedRevision: 1,
        expectedManagementRevision: 0,
        transactionId: "507f1f77bcf86cd799439011",
        requestedCents: 1,
      }).success,
    ).toBe(false);
  });
});
