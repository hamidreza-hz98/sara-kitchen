import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";
import type { Connection } from "mongoose";

import { PROJECT_TIME_ZONE, type SupportedLocale } from "@/constants";
import { LOCALE_COOKIE_NAME, resolveLocalePreference } from "@/locales/routing";
import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";
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
  createCartRecommendationLoader,
  createCartRepository,
  type CartIdentity,
  type CartOperationResult,
} from "@/server/modules/carts";
import { createAddressRepository, evaluatePortoDelivery } from "@/server/modules/addresses";
import { createSettingsRuntime } from "@/server/modules/settings";
import {
  createDishRecommendationRepository,
  createDishRecommendationService,
  loadDishCartPresentations,
  loadDishCartSources,
} from "@/server/modules/dishes";
import { createIngredientAllergenCatalog } from "@/server/modules/ingredients";
import { createMinioStorageProvider, resolveSeoMediaImage } from "@/server/modules/media";

const GUEST_CART_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const PORTO_DELIVERY_BANDS = Object.freeze([
  { maxDistanceMeters: 5_000, feeCents: 400 },
  { maxDistanceMeters: 10_000, feeCents: 600 },
  { maxDistanceMeters: 20_000, feeCents: 800 },
]);

export function guestCartCookieName(): string {
  return process.env.NODE_ENV === "production" ? "__Host-sk_guest_cart" : "sk_guest_cart";
}

export function cartRequestLocale(request: NextRequest): SupportedLocale {
  return resolveLocalePreference(request.cookies.get(LOCALE_COOKIE_NAME)?.value);
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
  const addresses = createAddressRepository(connection);
  const contactSettings = () =>
    createSettingsRuntime(connection, { requestId }).getPublic("contact", "en");
  return createCartCrudServices({
    repository: createCartRepository(connection),
    now: () => new Date(),
    loadPolicies: async () => {
      const contact = await contactSettings();
      return {
        servicePolicy: {
          mode: "always" as const,
          timeZone: PROJECT_TIME_ZONE,
          cutoffMinutesBeforeClose: 0,
        },
        deliveryBands: contact?.deliveryBands ?? PORTO_DELIVERY_BANDS,
      };
    },
    availability: {
      loadDishesByIds: async (dishIds) =>
        (await sources(dishIds)).map(({ availability }) => availability),
    },
    pricing: {
      loadDishesByIds: async (dishIds) => (await sources(dishIds)).map(({ pricing }) => pricing),
    },
    resolveDelivery: async (customerId, addressId) => {
      const address = await addresses.findOwnedById(customerId, addressId);
      if (!address) return { eligible: false, reason: "unverified_address" };
      const environment = getServerEnvironment();
      const contact = await contactSettings();
      const decision = evaluatePortoDelivery(address.location, {
        latitude: contact?.location.latitude ?? environment.KITCHEN_LATITUDE,
        longitude: contact?.location.longitude ?? environment.KITCHEN_LONGITUDE,
      });
      if (!decision.eligible) return decision;
      if (
        contact?.serviceArea.mode === "radius" &&
        contact.serviceArea.radiusKm !== null &&
        decision.distanceMeters > contact.serviceArea.radiusKm * 1_000
      )
        return { eligible: false, reason: "outside_service_area" };
      return decision;
    },
    audit: createCartAuditSink(connection, { requestId, ...(userAgent ? { userAgent } : {}) }),
  });
}

export async function cartClientProjection(
  connection: Connection,
  result: CartOperationResult,
  locale: SupportedLocale,
) {
  const dishIds = result.cart.lines.map(({ dishId }) => dishId);
  const presentations = await loadDishCartPresentations(connection, dishIds, locale);
  const presentationById = new Map(presentations.map((item) => [item.id, item]));
  const pricingById = new Map(result.pricing.lines.map((line) => [line.dishId, line]));
  const availabilityById = new Map(result.availability.lines.map((line) => [line.dishId, line]));
  const issuesById = new Map<string, string[]>();
  for (const issue of result.availability.issues) {
    if (!issue.dishId) continue;
    const issues = issuesById.get(issue.dishId) ?? [];
    issues.push(issue.code);
    issuesById.set(issue.dishId, issues);
  }
  const storage = createMinioStorageProvider();
  const imageEntries = await Promise.all(
    presentations.map(async (item) => {
      if (!item.imageMediaId) return [item.id, null] as const;
      const image = await resolveSeoMediaImage(
        connection,
        storage,
        item.imageMediaId,
        locale,
      ).catch(() => null);
      return [item.id, image] as const;
    }),
  );
  const imageById = new Map(imageEntries);
  return {
    currency: result.cart.currency,
    id: result.cart.id,
    notes: result.cart.notes,
    lines: result.cart.lines.map((line) => {
      const presentation = presentationById.get(line.dishId);
      const pricing = pricingById.get(line.dishId);
      const availability = availabilityById.get(line.dishId);
      const image = imageById.get(line.dishId) ?? null;
      return {
        dishId: line.dishId,
        quantity: line.quantity,
        name: presentation?.name ?? null,
        slug: presentation?.slug ?? null,
        image: image ? { alt: image.alt ?? presentation?.name ?? "", url: image.url } : null,
        pricing: pricing
          ? {
              baseUnitPriceCents: pricing.baseUnitPriceCents,
              effectiveUnitPriceCents: pricing.effectiveUnitPriceCents,
              lineDiscountCents: pricing.lineDiscountCents,
              lineSubtotalCents: pricing.lineSubtotalCents,
            }
          : null,
        availability: availability
          ? {
              available: availability.available,
              issueCodes: issuesById.get(line.dishId) ?? [],
              leadTimeMinutes: availability.leadTimeMinutes,
              maxAllowedQuantity: availability.maxAllowedQuantity,
            }
          : {
              available: false,
              issueCodes: ["dish_not_found"],
              leadTimeMinutes: null,
              maxAllowedQuantity: 0,
            },
      };
    }),
    pricing: result.cart.pricing,
    pricingChanged: result.pricingChanged,
    availability: {
      earliestReadyAt: result.availability.earliestReadyAt,
      orderLeadTimeMinutes: result.availability.orderLeadTimeMinutes,
      valid: result.availability.valid,
    },
    selectedAddressId: result.cart.selectedAddressId,
    pickupConfirmed: result.cart.pickupConfirmed === true,
    version: result.cart.version,
  } as const;
}

export async function cartRecommendationProjection(
  connection: Connection,
  dishIds: readonly string[],
  locale: SupportedLocale,
) {
  const load = createCartRecommendationLoader({
    load: createDishRecommendationService({
      repository: createDishRecommendationRepository(connection),
      ingredients: createIngredientAllergenCatalog(connection),
    }),
  });
  const result = await load({ currentDishIds: dishIds, locale, limit: 4 });
  const storage = createMinioStorageProvider();
  const items = await Promise.all(
    result.items.map(async (item) => {
      const mediaId = item.mediaIds[0];
      const image = mediaId
        ? await resolveSeoMediaImage(connection, storage, mediaId, locale).catch(() => null)
        : null;
      return {
        id: item.id,
        slug: item.slug,
        name: item.name.value,
        image: image ? { alt: image.alt ?? item.name.value, url: image.url } : null,
        effectivePriceCents: item.price.effectivePriceCents,
        basePriceCents: item.price.basePriceCents,
        reason: item.reason.kind,
      };
    }),
  );
  return { degraded: result.degraded, items } as const;
}

export function translateCartError(error: unknown): never {
  if (error instanceof CartCrudError) {
    if (error.code === "not_found") throw ApiError.notFound("cart");
    if (error.code === "forbidden") throw ApiError.authorization();
    if (error.code === "conflict") {
      throw ApiError.conflict({
        resource: "cart",
        ...(error.details.current
          ? {
              current: {
                availability: {
                  earliestReadyAt: error.details.current.availability.earliestReadyAt,
                  orderLeadTimeMinutes: error.details.current.availability.orderLeadTimeMinutes,
                  valid: error.details.current.availability.valid,
                },
                currency: error.details.current.cart.currency,
                id: error.details.current.cart.id,
                lines: error.details.current.cart.lines,
                notes: error.details.current.cart.notes,
                pricing: error.details.current.cart.pricing,
                pricingChanged: error.details.current.pricingChanged,
                selectedAddressId: error.details.current.cart.selectedAddressId,
                pickupConfirmed: error.details.current.cart.pickupConfirmed === true,
                version: error.details.current.cart.version,
              },
            }
          : {}),
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
