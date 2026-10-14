import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  context: vi.fn(),
  getCart: vi.fn(),
  getAddress: vi.fn(),
  getPolicies: vi.fn(),
}));
vi.mock("@/app/api/cart/route-helper", () => ({
  cartRequestContext: state.context,
  cartRequestLocale: () => "en",
  resolveCartCrud: () => ({ get: state.getCart }),
  cartClientProjection: vi.fn(async (_connection: unknown, result: unknown) => result),
  translateCartError(error: unknown): never {
    throw error;
  },
}));
vi.mock("@/server/modules/addresses", () => ({
  createAddressRepository: () => ({ findOwnedById: state.getAddress }),
}));
vi.mock("@/server/modules/settings", () => ({ getCheckoutPolicies: state.getPolicies }));

import { GET } from "@/app/api/checkout/review/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.context.mockResolvedValue({
    connection: {},
    identity: { kind: "customer", customerId: "1".repeat(24) },
  });
  state.getCart.mockResolvedValue({ cart: { selectedAddressId: "2".repeat(24) } });
  state.getAddress.mockResolvedValue({
    id: "2".repeat(24),
    name: "Home",
    recipientName: "Sara",
    recipientMobile: "+351912345678",
    formattedAddress: "Porto",
    postalCode: "4000-001",
    deliveryNotes: null,
    customerId: "1".repeat(24),
    location: { type: "Point", coordinates: [-8.6, 41.15] },
    validation: { status: "unverified" },
  });
  state.getPolicies.mockResolvedValue([]);
});

describe("checkout review boundary", () => {
  it("requires a customer session", async () => {
    state.context.mockResolvedValueOnce({
      connection: {},
      identity: { kind: "guest", guestTokenHash: "x" },
    });
    const response = await GET(new Request("https://sarakitchen.pt/api/checkout/review") as never);
    expect(response.status).toBe(401);
  });

  it("returns only owned address fields and never enables unfinished payment", async () => {
    const response = await GET(new Request("https://sarakitchen.pt/api/checkout/review") as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.getAddress).toHaveBeenCalledWith("1".repeat(24), "2".repeat(24));
    const body = await response.json();
    expect(body.data).toMatchObject({
      address: { name: "Home", formattedAddress: "Porto" },
      submissionAvailable: false,
      paymentMethods: [{ type: "mbway", enabled: false }],
    });
    expect(body.data.address).not.toHaveProperty("location");
    expect(body.data.address).not.toHaveProperty("customerId");
  });
});
