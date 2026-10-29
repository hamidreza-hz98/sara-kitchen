import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionList } from "@/app/[locale]/(dashboard)/dashboard/transactions/transaction-list";
import messages from "@/locales/messages/en";

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TransactionList />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("dashboard transactions", () => {
  it("shows an empty state without requiring a connected payment provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { pagination: { totalPages: 0, totalItems: 0 } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    show();
    expect(await screen.findByText("No transactions yet")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/transactions?"),
      expect.any(Object),
    );
  });

  it("renders stored transaction data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "transaction-1",
              orderId: "order-1",
              method: "mbway",
              provider: "mbway-sandbox",
              status: "paid",
              amounts: { requestedCents: 2500, capturedCents: 2500, refundedCents: 0 },
              createdAt: "2026-01-01T12:00:00Z",
            },
          ],
          meta: { pagination: { totalPages: 1, totalItems: 1 } },
        }),
      }),
    );
    show();
    expect(await screen.findByText("transaction-1")).toBeInTheDocument();
    expect(screen.getByText("order-1")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText(/MB WAY/)).toBeInTheDocument();
  });

  it("offers a retry when the transaction request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    show();
    expect(await screen.findByText("Transactions unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
