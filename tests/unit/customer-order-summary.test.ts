// @vitest-environment node

import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { summarizeOrdersForCustomers } from "@/server/modules/orders";

describe("customer order summary", () => {
  it("counts orders, sums only paid/completed totals, and tracks the latest order", async () => {
    const first = "507f1f77bcf86cd799439011";
    const second = "507f1f77bcf86cd799439012";
    const rows = [
      {
        customerId: new Types.ObjectId(first),
        status: "paid",
        totalCents: 2_500,
        createdAt: new Date("2026-09-01T10:00:00Z"),
      },
      {
        customer: { id: first },
        status: "pending",
        pricing: { totalCents: 9_999 },
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        customer: { ref: new Types.ObjectId(second) },
        status: "completed",
        price: { totalCents: 1_250 },
        createdAt: "2026-08-01T10:00:00Z",
      },
    ];
    const toArray = vi.fn().mockResolvedValue(rows);
    const find = vi.fn().mockReturnValue({ toArray });
    const connection = { collection: vi.fn().mockReturnValue({ find }) };

    await expect(
      summarizeOrdersForCustomers(connection as never, [first, second, first]),
    ).resolves.toEqual({
      [first]: { orderCount: 2, totalSpentCents: 2_500, lastOrderAt: "2026-10-01T10:00:00.000Z" },
      [second]: { orderCount: 1, totalSpentCents: 1_250, lastOrderAt: "2026-08-01T10:00:00.000Z" },
    });
    expect(find).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ projection: expect.objectContaining({ status: 1, createdAt: 1 }) }),
    );
  });

  it("returns zero summaries without querying for valid customers that have no orders", async () => {
    const id = "507f1f77bcf86cd799439011";
    const connection = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    };
    await expect(
      summarizeOrdersForCustomers(connection as never, [id, "invalid"]),
    ).resolves.toEqual({
      [id]: { orderCount: 0, totalSpentCents: 0, lastOrderAt: null },
    });
  });
});
