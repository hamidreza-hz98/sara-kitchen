import { afterEach, describe, expect, it, vi } from "vitest";

import { cartClientTransport } from "@/lib/cart-client";

const DISH = "1".repeat(24);

function body(quantity = 2, version = 3) {
  return {
    data: {
      cart: {
        currency: "EUR",
        id: "a".repeat(24),
        lines: [{ dishId: DISH, quantity }],
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
      },
    },
    ok: true,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("cart HTTP transport", () => {
  it("uses versioned item endpoints and accepts only the sanitized server projection", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify(body()), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = await cartClientTransport.add(
      { dishId: DISH, expectedVersion: 2, quantity: 1 },
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({
        body: JSON.stringify({ dishId: DISH, expectedVersion: 2, quantity: 1 }),
        cache: "no-store",
        credentials: "same-origin",
        method: "POST",
      }),
    );
    expect(result).toMatchObject({ lines: [{ dishId: DISH, quantity: 2 }], version: 3 });
    expect(result).not.toHaveProperty("customerId");
    expect(result).not.toHaveProperty("guestToken");
  });

  it("maps conflict responses to their authoritative current cart", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "CONFLICT", details: { current: body(4, 8).data } },
            ok: false,
          }),
          { headers: { "content-type": "application/json" }, status: 409 },
        ),
      ),
    );
    await expect(
      cartClientTransport.update(
        { dishId: DISH, expectedVersion: 2, quantity: 4 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "conflict",
      current: expect.objectContaining({ version: 8 }),
    });
  });

  it("turns invalid or failed responses into safe client errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data: { injected: true }, ok: true }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
    );
    await expect(cartClientTransport.get(new AbortController().signal)).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("persists notes and clears the cart through versioned root operations", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify(body()), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await cartClientTransport.setNotes({ expectedVersion: 3, notes: "Ring the bell" }, signal);
    await cartClientTransport.clear({ expectedVersion: 4 }, signal);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/cart",
      expect.objectContaining({
        body: JSON.stringify({ expectedVersion: 3, notes: "Ring the bell" }),
        method: "PATCH",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/cart",
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 4 }), method: "DELETE" }),
    );
  });
});
