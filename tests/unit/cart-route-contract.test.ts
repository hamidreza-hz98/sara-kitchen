import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  addItem: vi.fn(),
  context: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
}));

vi.mock("@/app/api/cart/route-helper", () => ({
  appendGuestCookie(response: Response, token: string | null) {
    if (token) response.headers.append("set-cookie", `sk_guest_cart=${token}; HttpOnly; Path=/`);
    return response;
  },
  cartRequestContext: state.context,
  resolveCartCrud: () => ({
    addItem: state.addItem,
    create: state.create,
    get: state.get,
    removeItem: state.removeItem,
    updateQuantity: state.updateQuantity,
  }),
  translateCartError(error: unknown): never {
    throw error;
  },
}));

import { GET } from "@/app/api/cart/route";
import { POST } from "@/app/api/cart/items/route";
import { DELETE, PATCH } from "@/app/api/cart/items/[dishId]/route";

const DISH = "1".repeat(24);
const identity = { kind: "guest" as const, guestTokenHash: "a".repeat(64) };
const cart = { cart: { id: "2".repeat(24), lines: [], version: 2 } };

function request(path: string, method = "GET", body?: unknown) {
  return new Request(`https://sarakitchen.pt${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.context.mockResolvedValue({
    connection: {},
    identity,
    issuedGuestToken: null,
  });
  state.get.mockResolvedValue(cart);
  state.create.mockResolvedValue(cart);
  state.addItem.mockResolvedValue(cart);
  state.updateQuantity.mockResolvedValue(cart);
  state.removeItem.mockResolvedValue(cart);
});

describe("cart Route Handler contract", () => {
  it("reads the identity-scoped authoritative cart without creating guest state", async () => {
    const response = await GET(request("/api/cart"));
    expect(response.status).toBe(200);
    expect(state.context).toHaveBeenCalledWith(expect.anything(), {
      createGuest: false,
      mutation: false,
    });
    expect(state.get).toHaveBeenCalledWith(identity);
    await expect(response.json()).resolves.toMatchObject({ data: cart, ok: true });
  });

  it("creates lazily, adds with the winning version, and returns an HTTP-only guest cookie", async () => {
    state.context.mockResolvedValueOnce({
      connection: {},
      identity,
      issuedGuestToken: "raw-token",
    });
    const response = await POST(
      request("/api/cart/items", "POST", {
        dishId: DISH,
        expectedVersion: null,
        quantity: 2,
      }),
    );
    expect(state.create).toHaveBeenCalledWith(identity);
    expect(state.addItem).toHaveBeenCalledWith(identity, 2, DISH, 2);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.status).toBe(200);
  });

  it("updates and removes through one versioned identity-scoped service", async () => {
    const routeContext = { params: Promise.resolve({ dishId: DISH }) };
    const patched = await PATCH(
      request(`/api/cart/items/${DISH}`, "PATCH", { expectedVersion: 4, quantity: 3 }),
      routeContext,
    );
    expect(patched.status).toBe(200);
    expect(state.updateQuantity).toHaveBeenCalledWith(identity, 4, DISH, 3);

    const removed = await DELETE(
      request(`/api/cart/items/${DISH}`, "DELETE", { expectedVersion: 5 }),
      routeContext,
    );
    expect(removed.status).toBe(200);
    expect(state.removeItem).toHaveBeenCalledWith(identity, 5, DISH);
  });

  it("returns null without creating a guest identity for an empty browser", async () => {
    state.context.mockResolvedValueOnce({ connection: {}, identity: null, issuedGuestToken: null });
    const response = await GET(request("/api/cart"));
    await expect(response.json()).resolves.toMatchObject({ data: null, ok: true });
    expect(state.get).not.toHaveBeenCalled();
  });
});
