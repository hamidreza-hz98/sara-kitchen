import { ThemeProvider } from "@mui/material/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PaymentResultView,
  type PaymentResultViewModel,
} from "@/app/[locale]/(storefront)/payment-result/payment-result-view";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const pending: PaymentResultViewModel = {
  orderCode: "SK-1234-5678-9ABC-DEFG",
  orderStatus: "pending_payment",
  paymentStatus: "pending",
  state: "pending",
  amountCents: 1_800,
  currency: "EUR",
  updatedAt: "2026-10-16T08:00:00.000Z",
  pollAfterMs: 2_500,
  canStartNewOrder: false,
};

function renderResult(result = pending) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <PaymentResultView initialResult={result} />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("payment result view", () => {
  it("polls the authenticated endpoint and resolves a delayed webhook to success", async () => {
    const success = {
      ...pending,
      state: "success" as const,
      orderStatus: "confirmed",
      paymentStatus: "paid",
      pollAfterMs: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: success }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    renderResult();
    expect(screen.getByRole("heading", { name: "Payment is being confirmed" })).toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(2_500));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Payment confirmed" })).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith(
      `/api/profile/payment-result?order=${encodeURIComponent(pending.orderCode)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
  });

  it("offers a safe new-order path only after a terminal failure", () => {
    vi.stubGlobal("fetch", vi.fn());
    const view = renderResult();
    expect(screen.queryByRole("link", { name: "Start a new order" })).not.toBeInTheDocument();
    view.unmount();
    renderResult({
      ...pending,
      state: "failed",
      paymentStatus: "failed",
      orderStatus: "payment_failed",
      pollAfterMs: null,
      canStartNewOrder: true,
    });
    expect(screen.getByRole("link", { name: "Start a new order" })).toHaveAttribute(
      "href",
      "/menu",
    );
  });
});
