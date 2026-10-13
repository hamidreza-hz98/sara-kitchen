import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCart } from "@/hooks";
import {
  CART_SYNC_STORAGE_KEY,
  CartClientError,
  type CartClientSnapshot,
  type CartClientTransport,
} from "@/lib/cart-client";
import { CUSTOMER_AUTH_SYNC_KEY } from "@/lib/customer-auth-sync";
import { CartProvider } from "@/providers/cart-provider";

const DISH = "1".repeat(24);

function snapshot(quantity: number, version: number): CartClientSnapshot {
  return {
    currency: "EUR",
    id: "a".repeat(24),
    lines: quantity > 0 ? [{ dishId: DISH, quantity }] : [],
    pricing: {
      adjustmentsCents: 0,
      calculatedAt: "2026-10-13T12:00:00.000Z",
      deliveryFeeCents: 0,
      discountCents: 0,
      subtotalCents: quantity * 1_000,
      taxCents: 0,
      totalCents: quantity * 1_000,
    },
    selectedAddressId: null,
    version,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function transport(overrides: Partial<CartClientTransport> = {}): CartClientTransport {
  return {
    add: vi.fn(async () => snapshot(2, 2)),
    get: vi.fn(async () => snapshot(1, 1)),
    remove: vi.fn(async () => snapshot(0, 2)),
    update: vi.fn(async () => snapshot(3, 2)),
    ...overrides,
  };
}

function SharedConsumers() {
  const cart = useCart();
  const pending = cart.pendingDishIds.has(DISH);
  return (
    <>
      <output data-testid="header-count">{cart.itemCount}</output>
      <output data-testid="cart-count">{cart.itemCount}</output>
      <output data-testid="status">{cart.status}</output>
      <output data-testid="pending">{String(pending)}</output>
      <output data-testid="error">{cart.error?.code ?? "none"}</output>
      <button
        onClick={() => {
          cart.addItem(DISH).catch(() => undefined);
        }}
      >
        dish-add
      </button>
      <button
        onClick={() => {
          cart.updateQuantity(DISH, 3).catch(() => undefined);
        }}
      >
        cart-update
      </button>
      <button
        onClick={() => {
          cart.removeItem(DISH).catch(() => undefined);
        }}
      >
        cart-remove
      </button>
    </>
  );
}

describe("global cart provider", () => {
  it("projects pending add state to every consumer and then accepts the server response", async () => {
    const response = deferred<CartClientSnapshot>();
    const api = transport({ add: vi.fn(() => response.promise) });
    render(
      <CartProvider autoLoad={false} initialCart={snapshot(1, 1)} transport={api}>
        <SharedConsumers />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dish-add" }));
    expect(screen.getByTestId("header-count")).toHaveTextContent("2");
    expect(screen.getByTestId("cart-count")).toHaveTextContent("2");
    expect(screen.getByTestId("pending")).toHaveTextContent("true");
    expect(api.add).toHaveBeenCalledWith(
      { dishId: DISH, expectedVersion: 1, quantity: 1 },
      expect.any(AbortSignal),
    );

    response.resolve(snapshot(2, 2));
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
    expect(screen.getByTestId("header-count")).toHaveTextContent("2");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("rolls back only the rejected optimistic update and exposes a safe error", async () => {
    const response = deferred<CartClientSnapshot>();
    const api = transport({ update: vi.fn(() => response.promise) });
    render(
      <CartProvider autoLoad={false} initialCart={snapshot(1, 1)} transport={api}>
        <SharedConsumers />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "cart-update" }));
    expect(screen.getByTestId("header-count")).toHaveTextContent("3");
    response.reject(new CartClientError("network"));

    await waitFor(() => expect(screen.getByTestId("header-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("pending")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("network");
  });

  it("rebases later queued work on each authoritative version", async () => {
    const addResponse = deferred<CartClientSnapshot>();
    const removeResponse = deferred<CartClientSnapshot>();
    const api = transport({
      add: vi.fn(() => addResponse.promise),
      remove: vi.fn(() => removeResponse.promise),
    });
    render(
      <CartProvider autoLoad={false} initialCart={snapshot(1, 1)} transport={api}>
        <SharedConsumers />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dish-add" }));
    fireEvent.click(screen.getByRole("button", { name: "cart-remove" }));
    expect(screen.getByTestId("header-count")).toHaveTextContent("0");
    expect(api.remove).not.toHaveBeenCalled();

    addResponse.resolve(snapshot(2, 2));
    await waitFor(() =>
      expect(api.remove).toHaveBeenCalledWith(
        { dishId: DISH, expectedVersion: 2 },
        expect.any(AbortSignal),
      ),
    );
    removeResponse.resolve(snapshot(0, 3));
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
    expect(screen.getByTestId("header-count")).toHaveTextContent("0");
  });

  it("adopts the server winner on a version conflict", async () => {
    const api = transport({
      update: vi.fn(async () => {
        throw new CartClientError("conflict", snapshot(4, 7));
      }),
    });
    render(
      <CartProvider autoLoad={false} initialCart={snapshot(1, 1)} transport={api}>
        <SharedConsumers />
      </CartProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "cart-update" }));
    await waitFor(() => expect(screen.getByTestId("header-count")).toHaveTextContent("4"));
    expect(screen.getByTestId("error")).toHaveTextContent("conflict");
  });

  it("refreshes from server-only data after cross-tab and authentication invalidations", async () => {
    const get = vi
      .fn<CartClientTransport["get"]>()
      .mockResolvedValueOnce(snapshot(4, 4))
      .mockResolvedValueOnce(snapshot(6, 6));
    render(
      <CartProvider autoLoad={false} initialCart={snapshot(1, 1)} transport={transport({ get })}>
        <SharedConsumers />
      </CartProvider>,
    );

    window.dispatchEvent(
      new StorageEvent("storage", { key: CART_SYNC_STORAGE_KEY, newValue: "opaque-event-id" }),
    );
    await waitFor(() => expect(screen.getByTestId("header-count")).toHaveTextContent("4"));

    await act(async () => {
      window.dispatchEvent(new Event(CUSTOMER_AUTH_SYNC_KEY));
    });
    await waitFor(() => expect(screen.getByTestId("header-count")).toHaveTextContent("6"));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("cancels guest-era optimistic work and loads the merged customer cart after login", async () => {
    const add = vi.fn<CartClientTransport["add"]>(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new CartClientError("aborted")), {
            once: true,
          });
        }),
    );
    const get = vi.fn<CartClientTransport["get"]>().mockResolvedValue(snapshot(5, 9));
    render(
      <CartProvider
        autoLoad={false}
        initialCart={snapshot(1, 1)}
        transport={transport({ add, get })}
      >
        <SharedConsumers />
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dish-add" }));
    expect(screen.getByTestId("header-count")).toHaveTextContent("2");
    await act(async () => {
      window.dispatchEvent(new Event(CUSTOMER_AUTH_SYNC_KEY));
    });

    await waitFor(() => expect(screen.getByTestId("header-count")).toHaveTextContent("5"));
    expect(screen.getByTestId("pending")).toHaveTextContent("false");
    expect(get).toHaveBeenCalledOnce();
  });
});
