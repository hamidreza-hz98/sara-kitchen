export const CART_SYNC_STORAGE_KEY = "sara-cart-invalidation";
export const CART_SYNC_EVENT = "sara-cart-change";

export type CartClientLine = Readonly<{
  availability: Readonly<{
    available: boolean;
    issueCodes: readonly string[];
    leadTimeMinutes: number | null;
    maxAllowedQuantity: number;
  }> | null;
  dishId: string;
  image: Readonly<{ alt: string; url: string }> | null;
  name: string | null;
  pricing: Readonly<{
    baseUnitPriceCents: number;
    effectiveUnitPriceCents: number;
    lineDiscountCents: number;
    lineSubtotalCents: number;
  }> | null;
  quantity: number;
  slug: string | null;
}>;

export type CartClientPricing = Readonly<{
  adjustmentsCents: number;
  calculatedAt: string | null;
  deliveryFeeCents: number;
  discountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}>;

export type CartClientSnapshot = Readonly<{
  availability: Readonly<{
    earliestReadyAt: string | null;
    orderLeadTimeMinutes: number;
    valid: boolean;
  }>;
  currency: "EUR";
  id: string | null;
  lines: readonly CartClientLine[];
  notes: string | null;
  pricing: CartClientPricing;
  pricingChanged: boolean;
  selectedAddressId: string | null;
  pickupConfirmed?: boolean;
  version: number | null;
}>;

export type CartMutationInput = Readonly<{
  dishId: string;
  expectedVersion: number | null;
  quantity?: number;
}>;

export interface CartClientTransport {
  add(input: CartMutationInput, signal: AbortSignal): Promise<CartClientSnapshot>;
  clear(
    input: Readonly<{ expectedVersion: number }>,
    signal: AbortSignal,
  ): Promise<CartClientSnapshot | null>;
  get(signal: AbortSignal): Promise<CartClientSnapshot | null>;
  remove(input: CartMutationInput, signal: AbortSignal): Promise<CartClientSnapshot>;
  update(input: CartMutationInput, signal: AbortSignal): Promise<CartClientSnapshot>;
  setNotes(
    input: Readonly<{ expectedVersion: number; notes: string | null }>,
    signal: AbortSignal,
  ): Promise<CartClientSnapshot | null>;
}

export class CartClientError extends Error {
  constructor(
    readonly code: "aborted" | "conflict" | "identity_changed" | "network" | "rejected" | "unknown",
    readonly current: CartClientSnapshot | null = null,
  ) {
    super(code);
    this.name = "CartClientError";
  }
}

type ApiSuccess = Readonly<{ data?: unknown; ok?: boolean }>;
type ApiFailure = Readonly<{
  error?: Readonly<{ code?: string; details?: Readonly<{ current?: unknown }> }>;
  ok?: boolean;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSnapshot(value: unknown): CartClientSnapshot {
  const candidate = isObject(value) && isObject(value.cart) ? value.cart : value;
  if (!isObject(candidate) || !Array.isArray(candidate.lines) || !isObject(candidate.pricing)) {
    throw new CartClientError("unknown");
  }
  const lines = candidate.lines.map((line) => {
    if (
      !isObject(line) ||
      typeof line.dishId !== "string" ||
      !Number.isSafeInteger(line.quantity) ||
      Number(line.quantity) < 1
    ) {
      throw new CartClientError("unknown");
    }
    const availability = isObject(line.availability)
      ? {
          available: line.availability.available === true,
          issueCodes: Array.isArray(line.availability.issueCodes)
            ? line.availability.issueCodes.filter(
                (code): code is string => typeof code === "string",
              )
            : [],
          leadTimeMinutes: Number.isSafeInteger(line.availability.leadTimeMinutes)
            ? Number(line.availability.leadTimeMinutes)
            : null,
          maxAllowedQuantity: Number.isSafeInteger(line.availability.maxAllowedQuantity)
            ? Number(line.availability.maxAllowedQuantity)
            : 0,
        }
      : null;
    const linePricing = isObject(line.pricing)
      ? {
          baseUnitPriceCents: Number(line.pricing.baseUnitPriceCents),
          effectiveUnitPriceCents: Number(line.pricing.effectiveUnitPriceCents),
          lineDiscountCents: Number(line.pricing.lineDiscountCents),
          lineSubtotalCents: Number(line.pricing.lineSubtotalCents),
        }
      : null;
    if (
      linePricing &&
      Object.values(linePricing).some((amount) => !Number.isSafeInteger(amount) || amount < 0)
    ) {
      throw new CartClientError("unknown");
    }
    return {
      availability,
      dishId: line.dishId,
      image:
        isObject(line.image) && typeof line.image.url === "string"
          ? { alt: typeof line.image.alt === "string" ? line.image.alt : "", url: line.image.url }
          : null,
      name: typeof line.name === "string" ? line.name : null,
      pricing: linePricing,
      quantity: Number(line.quantity),
      slug: typeof line.slug === "string" ? line.slug : null,
    };
  });
  const pricing = candidate.pricing;
  const cents = (field: string) => {
    const amount = pricing[field];
    if (!Number.isSafeInteger(amount)) throw new CartClientError("unknown");
    return Number(amount);
  };
  const version = candidate.version;
  if (version !== null && (!Number.isSafeInteger(version) || Number(version) < 1)) {
    throw new CartClientError("unknown");
  }
  return {
    availability: isObject(candidate.availability)
      ? {
          earliestReadyAt:
            typeof candidate.availability.earliestReadyAt === "string"
              ? candidate.availability.earliestReadyAt
              : null,
          orderLeadTimeMinutes: Number.isSafeInteger(candidate.availability.orderLeadTimeMinutes)
            ? Number(candidate.availability.orderLeadTimeMinutes)
            : 0,
          valid: candidate.availability.valid !== false,
        }
      : { earliestReadyAt: null, orderLeadTimeMinutes: 0, valid: true },
    currency: "EUR",
    id: typeof candidate.id === "string" ? candidate.id : null,
    lines,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    pricing: {
      adjustmentsCents: cents("adjustmentsCents"),
      calculatedAt: typeof pricing.calculatedAt === "string" ? pricing.calculatedAt : null,
      deliveryFeeCents: cents("deliveryFeeCents"),
      discountCents: cents("discountCents"),
      subtotalCents: cents("subtotalCents"),
      taxCents: cents("taxCents"),
      totalCents: cents("totalCents"),
    },
    pricingChanged: candidate.pricingChanged === true,
    selectedAddressId:
      typeof candidate.selectedAddressId === "string" ? candidate.selectedAddressId : null,
    pickupConfirmed: candidate.pickupConfirmed === true,
    version: version === null ? null : Number(version),
  };
}

async function request(
  url: string,
  init: RequestInit & Readonly<{ signal: AbortSignal }>,
): Promise<CartClientSnapshot | null> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CartClientError("aborted");
    }
    throw new CartClientError("network");
  }
  let payload: ApiSuccess | ApiFailure;
  try {
    payload = (await response.json()) as ApiSuccess | ApiFailure;
  } catch {
    throw new CartClientError(response.ok ? "unknown" : "rejected");
  }
  if (!response.ok) {
    const failure = payload as ApiFailure;
    const current = failure.error?.details?.current;
    throw new CartClientError(
      response.status === 409 ? "conflict" : "rejected",
      current === undefined ? null : parseSnapshot(current),
    );
  }
  const data = (payload as ApiSuccess).data;
  return data === null ? null : parseSnapshot(data);
}

function mutationBody(input: CartMutationInput): string {
  return JSON.stringify({
    expectedVersion: input.expectedVersion,
    ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
  });
}

export const cartClientTransport: CartClientTransport = {
  get: (signal) => request("/api/cart", { method: "GET", signal }),
  clear: (input, signal) =>
    request("/api/cart", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    }),
  async add(input, signal) {
    const result = await request("/api/cart/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!result) throw new CartClientError("unknown");
    return result;
  },
  async update(input, signal) {
    const result = await request(`/api/cart/items/${encodeURIComponent(input.dishId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: mutationBody(input),
      signal,
    });
    if (!result) throw new CartClientError("unknown");
    return result;
  },
  async remove(input, signal) {
    const result = await request(`/api/cart/items/${encodeURIComponent(input.dishId)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: mutationBody(input),
      signal,
    });
    if (!result) throw new CartClientError("unknown");
    return result;
  },
  setNotes: (input, signal) =>
    request("/api/cart", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    }),
};

/** Cross-tab invalidation only. Cart data and identity remain server-owned. */
export function broadcastCartInvalidation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_SYNC_STORAGE_KEY, crypto.randomUUID());
  } catch {
    // Storage can be disabled; the current provider already holds the successful response.
  }
}
