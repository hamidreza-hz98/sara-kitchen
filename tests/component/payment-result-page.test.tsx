import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  connect: vi.fn(),
  result: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/server/auth/page-guards", () => ({ requireCustomerPage: mocks.guard }));
vi.mock("@/server/database", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/server/modules/orders", () => ({
  getCustomerPaymentResult: mocks.result,
  paymentResultQuerySchema: {
    safeParse: (value: { order?: string }) =>
      value.order && /^SK-(?:[0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/u.test(value.order)
        ? { success: true, data: { order: value.order } }
        : { success: false },
  },
  PaymentResultError: class extends Error {},
}));
vi.mock("@/app/[locale]/(storefront)/payment-result/payment-result-view", () => ({
  PaymentResultView: () => null,
}));

import PaymentResultPage from "@/app/[locale]/(storefront)/payment-result/page";

const order = "SK-1234-5678-9ABC-DEFG";
const pending = { orderCode: order, state: "pending" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ id: "507f1f77bcf86cd799439011" });
  mocks.connect.mockResolvedValue({});
  mocks.result.mockResolvedValue(pending);
});

describe("payment result server page", () => {
  it("ignores forged status parameters and renders the server result", async () => {
    const element = await PaymentResultPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ order, status: "success" }),
    });
    expect(mocks.result).toHaveBeenCalledWith({}, "507f1f77bcf86cd799439011", order);
    expect(element.props.initialResult).toEqual(pending);
  });

  it("authenticates before querying payment data", async () => {
    mocks.guard.mockRejectedValue(new Error("LOGIN"));
    await expect(
      PaymentResultPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ order }),
      }),
    ).rejects.toThrow("LOGIN");
    expect(mocks.result).not.toHaveBeenCalled();
  });

  it("returns not-found for a missing or malformed order key", async () => {
    await expect(
      PaymentResultPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ status: "success" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.result).not.toHaveBeenCalled();
  });
});
