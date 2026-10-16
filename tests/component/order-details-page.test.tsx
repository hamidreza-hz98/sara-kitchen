import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  connect: vi.fn(),
  getOrder: vi.fn(),
  getTransaction: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/server/auth/page-guards", () => ({ requireAdminPage: mocks.guard }));
vi.mock("@/server/database", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/server/modules/orders", () => ({
  createOrderManagement: () => ({ get: mocks.getOrder }),
  orderCodeParametersSchema: {
    safeParse: (value: { orderCode: string }) =>
      Object.keys(value).length === 1 &&
      /^SK-(?:[0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/u.test(value.orderCode)
        ? { success: true, data: value }
        : { success: false },
  },
  OrderManagementError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
}));
vi.mock("@/server/modules/transactions", () => ({
  createTransactionManagement: () => ({ get: mocks.getTransaction }),
}));
vi.mock("@/app/[locale]/(dashboard)/dashboard/orders/[orderCode]/order-details", () => ({
  OrderDetails: () => null,
}));

import DashboardOrderDetailsPage from "@/app/[locale]/(dashboard)/dashboard/orders/[orderCode]/page";

const code = "SK-1234-5678-9ABC-DEFG";
const order = {
  id: "507f1f77bcf86cd799439011",
  code,
  transactionIds: ["507f1f77bcf86cd799439012"],
  customer: { firstName: "Sara", lastName: "Kazemi" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({
    id: "507f1f77bcf86cd799439013",
    role: "super-admin",
    permissions: ["orders:read", "orders:read-sensitive", "transactions:read"],
  });
  mocks.connect.mockResolvedValue({});
  mocks.getOrder.mockResolvedValue(order);
  mocks.getTransaction.mockResolvedValue({
    id: order.transactionIds[0],
    orderId: order.id,
    method: "mbway",
    provider: "mbway-sandbox",
    status: "paid",
    amounts: { requestedCents: 1000, authorizedCents: 1000, capturedCents: 1000, refundedCents: 0 },
    responseCode: null,
    events: [],
    createdAt: new Date(),
  });
});

describe("direct dashboard order details", () => {
  it("does not query order data when the dashboard guard denies access", async () => {
    mocks.guard.mockRejectedValue(new Error("DENIED"));
    await expect(
      DashboardOrderDetailsPage({ params: Promise.resolve({ orderCode: code }) }),
    ).rejects.toThrow("DENIED");
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });

  it("loads a valid code after the page permission check", async () => {
    const element = await DashboardOrderDetailsPage({
      params: Promise.resolve({ locale: "en", orderCode: code }),
    });
    expect(mocks.guard).toHaveBeenCalledWith("orders:read");
    expect(mocks.getOrder).toHaveBeenCalledWith(expect.objectContaining({ active: true }), code);
    expect(element.props.initialOrder.code).toBe(code);
    expect(element.props.initialTransactions).toHaveLength(1);
  });

  it("returns not-found for malformed codes without querying an order", async () => {
    await expect(
      DashboardOrderDetailsPage({ params: Promise.resolve({ orderCode: "bad-code" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });

  it("returns not-found for an unknown order", async () => {
    const { OrderManagementError } = await import("@/server/modules/orders");
    mocks.getOrder.mockRejectedValue(new OrderManagementError("not_found"));
    await expect(
      DashboardOrderDetailsPage({ params: Promise.resolve({ orderCode: code }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("does not load transactions without their read permission", async () => {
    mocks.guard.mockResolvedValue({
      id: "507f1f77bcf86cd799439013",
      role: "viewer",
      permissions: ["orders:read"],
    });
    const element = await DashboardOrderDetailsPage({
      params: Promise.resolve({ orderCode: code }),
    });
    expect(element.props.capabilities.readSensitive).toBe(false);
    expect(element.props.initialTransactions).toEqual([]);
    expect(mocks.getTransaction).not.toHaveBeenCalled();
  });

  it("rejects a transaction reference that belongs to another order", async () => {
    mocks.getTransaction.mockResolvedValue({ id: order.transactionIds[0], orderId: "other" });
    await expect(
      DashboardOrderDetailsPage({ params: Promise.resolve({ orderCode: code }) }),
    ).rejects.toThrow("did not match");
  });
});
