import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import { PROJECT_TIME_ZONE } from "@/constants";
import { connectToDatabase } from "@/server/database";
import { ApiError } from "@/server/http";
import {
  customerCookieName,
  isSameOriginMutation,
  resolveCustomerActor,
} from "@/server/modules/auth";
import {
  CartAvailabilityPolicyError,
  CartCrudError,
  CartPricingError,
  CartRepositoryConflictError,
  createCartAuditSink,
  createCartCrudServices,
  createCartRepository,
  type CartIdentity,
} from "@/server/modules/carts";
import { loadDishCartSources } from "@/server/modules/dishes";

const GUEST_CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function guestCartCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-sk_guest_cart" : "sk_guest_cart";
}

function hashGuestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function issueGuestIdentity(): Readonly<{ identity: CartIdentity; token: string }> {
  const token = randomBytes(32).toString("base64url");
  return { identity: { kind: "guest", guestTokenHash: hashGuestToken(token) }, token };
}

export function serializeGuestCartCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${guestCartCookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_CART_COOKIE_MAX_AGE_SECONDS}${secure}`;
}

export type CartRequestContext = Readonly<{
  connection: Connection;
  identity: CartIdentity | null;
  issuedGuestToken: string | null;
}>;

export async function cartRequestContext(
  request: NextRequest,
  options: Readonly<{ createGuest: boolean; mutation: boolean }>,
): Promise<CartRequestContext> {
  if (options.mutation && !isSameOriginMutation(request)) throw ApiError.authorization();
  const connection = await connectToDatabase();
  const customerToken = request.cookies.get(customerCookieName())?.value;
  const customer = await resolveCustomerActor(connection, customerToken);
  if (customer) {
    return {
      connection,
      identity: { kind: "customer", customerId: customer.id },
      issuedGuestToken: null,
    };
  }
  const guestToken = request.cookies.get(guestCartCookieName())?.value;
  if (guestToken) {
    return {
      connection,
      identity: { kind: "guest", guestTokenHash: hashGuestToken(guestToken) },
      issuedGuestToken: null,
    };
  }
  if (!options.createGuest) return { connection, identity: null, issuedGuestToken: null };
  const issued = issueGuestIdentity();
  return { connection, identity: issued.identity, issuedGuestToken: issued.token };
}

export function resolveCartCrud(
  connection: Connection,
  requestId: string,
  userAgent?: string | null,
) {
  const sources = (dishIds: readonly string[]) => loadDishCartSources(connection, dishIds);
  return createCartCrudServices({
    repository: createCartRepository(connection),
    now: () => new Date(),
    loadPolicies: async () => ({
      servicePolicy: {
        mode: "always",
        timeZone: PROJECT_TIME_ZONE,
        cutoffMinutesBeforeClose: 0,
      },
      deliveryBands: [],
    }),
    availability: {
      loadDishesByIds: async (dishIds) =>
        (await sources(dishIds)).map(({ availability }) => availability),
    },
    pricing: {
      loadDishesByIds: async (dishIds) => (await sources(dishIds)).map(({ pricing }) => pricing),
    },
    // Address selection and configured distance bands are introduced by the checkout-address step.
    resolveDelivery: async () => ({ eligible: false, reason: "unverified_address" }),
    audit: createCartAuditSink(connection, { requestId, ...(userAgent ? { userAgent } : {}) }),
  });
}

export function translateCartError(error: unknown): never {
  if (error instanceof CartCrudError) {
    if (error.code === "not_found") throw ApiError.notFound("cart");
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "conflict") {
      throw ApiError.conflict({
        resource: "cart",
        ...(error.details.current ? { current: error.details.current } : {}),
      });
    }
    if (error.code === "availability_changed") {
      throw ApiError.conflict({ resource: "cart", availability: error.details.availability });
    }
    throw ApiError.validation([
      { code: error.code, message: "The cart request is not accepted.", path: [] },
    ]);
  }
  if (error instanceof CartRepositoryConflictError) throw ApiError.conflict({ resource: "cart" });
  if (error instanceof CartPricingError || error instanceof CartAvailabilityPolicyError) {
    throw ApiError.validation([
      { code: "invalid_cart", message: "The cart request is not accepted.", path: [] },
    ]);
  }
  throw error;
}

export function appendGuestCookie(response: Response, token: string | null): Response {
  if (token) response.headers.append("set-cookie", serializeGuestCartCookie(token));
  return response;
}
