import "server-only";

import { DishPricingError, calculateDishPrice, type DishDiscount } from "@/server/modules/dishes";

import { CART_CURRENCY, CART_MAX_MONEY_CENTS, CART_MAX_QUANTITY_PER_LINE } from "../model/cart";

export const CART_FREE_DELIVERY_THRESHOLD_CENTS = 20_000;
export const CART_TAX_POLICY = "disabled_mvp" as const;

export const CART_PRICING_ERROR_CODES = [
  "invalid_evaluation_time",
  "invalid_line",
  "duplicate_dish",
  "dish_not_found",
  "invalid_dish_source",
  "invalid_delivery_policy",
  "delivery_distance_unsupported",
  "invalid_adjustment",
  "money_limit_exceeded",
  "negative_total",
] as const;

export type CartPricingErrorCode = (typeof CART_PRICING_ERROR_CODES)[number];
export type CartFulfillment =
  Readonly<{ method: "pickup" }> | Readonly<{ distanceMeters: number; method: "delivery" }>;

export type CartPricingLineInput = Readonly<{
  dishId: string;
  quantity: number;
}>;

export type CartPricingAdjustment = Readonly<{
  amountCents: number;
  code: string;
}>;

export type DeliveryPriceBand = Readonly<{
  feeCents: number;
  maxDistanceMeters: number;
}>;

export type CartPricingDishSource = Readonly<{
  basePriceCents: number;
  discount: DishDiscount;
  id: string;
}>;

export type CartPricedLine = Readonly<{
  baseUnitPriceCents: number;
  dishId: string;
  effectiveUnitPriceCents: number;
  lineBaseSubtotalCents: number;
  lineDiscountCents: number;
  lineSubtotalCents: number;
  quantity: number;
  unitDiscountCents: number;
}>;

export type CartPricingResult = Readonly<{
  adjustments: readonly CartPricingAdjustment[];
  currency: typeof CART_CURRENCY;
  delivery: Readonly<{
    appliedBand: DeliveryPriceBand | null;
    distanceMeters: number | null;
    feeCents: number;
    freeDeliveryApplied: boolean;
    method: CartFulfillment["method"];
  }>;
  lines: readonly CartPricedLine[];
  pricedAt: string;
  summary: Readonly<{
    adjustmentsCents: number;
    calculatedAt: string;
    deliveryFeeCents: number;
    discountCents: number;
    subtotalCents: number;
    taxCents: 0;
    totalCents: number;
  }>;
  tax: Readonly<{ amountCents: 0; policy: typeof CART_TAX_POLICY }>;
}>;

export type CalculateCartPricingInput = Readonly<{
  adjustments?: readonly CartPricingAdjustment[];
  at: Date;
  deliveryBands: readonly DeliveryPriceBand[];
  fulfillment: CartFulfillment;
  lines: readonly CartPricingLineInput[];
}>;

export type CartPricingDependencies = Readonly<{
  loadDishesByIds: (dishIds: readonly string[]) => Promise<readonly CartPricingDishSource[]>;
}>;

export type CartPricingIssue = Readonly<{
  code: CartPricingErrorCode;
  message: string;
  path: string;
}>;

export class CartPricingError extends Error {
  constructor(readonly issues: readonly CartPricingIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "CartPricingError";
  }
}

const issue = (code: CartPricingErrorCode, path: string, message: string): CartPricingIssue => ({
  code,
  path,
  message,
});

function isCents(value: unknown, allowNegative = false): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value <= CART_MAX_MONEY_CENTS &&
    value >= (allowNegative ? -CART_MAX_MONEY_CENTS : 0)
  );
}

function isDishId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/iu.test(value);
}

function boundedCents(value: bigint, path: string): number {
  if (value < BigInt(0) || value > BigInt(CART_MAX_MONEY_CENTS)) {
    throw new CartPricingError([
      issue("money_limit_exceeded", path, "Calculated money exceeds the supported cart range."),
    ]);
  }
  return Number(value);
}

function validateLines(lines: readonly CartPricingLineInput[]): void {
  const issues: CartPricingIssue[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (!line || !isDishId(line.dishId)) {
      issues.push(issue("invalid_line", `lines.${index}.dishId`, "Cart dish ID is invalid."));
    } else if (seen.has(line.dishId.toLowerCase())) {
      issues.push(
        issue("duplicate_dish", `lines.${index}.dishId`, "Cart dish lines must be unique."),
      );
    } else {
      seen.add(line.dishId.toLowerCase());
    }
    if (
      !Number.isSafeInteger(line?.quantity) ||
      line.quantity < 1 ||
      line.quantity > CART_MAX_QUANTITY_PER_LINE
    ) {
      issues.push(
        issue(
          "invalid_line",
          `lines.${index}.quantity`,
          `Cart quantity must be an integer from 1 through ${CART_MAX_QUANTITY_PER_LINE}.`,
        ),
      );
    }
  });
  if (issues.length > 0) throw new CartPricingError(issues);
}

function validateDeliveryBands(bands: readonly DeliveryPriceBand[]): void {
  const issues: CartPricingIssue[] = [];
  let previousMaximum = 0;
  bands.forEach((band, index) => {
    if (
      !band ||
      !Number.isSafeInteger(band.maxDistanceMeters) ||
      band.maxDistanceMeters <= previousMaximum
    ) {
      issues.push(
        issue(
          "invalid_delivery_policy",
          `deliveryBands.${index}.maxDistanceMeters`,
          "Delivery bands must have strictly increasing positive integer distances.",
        ),
      );
    }
    if (!isCents(band?.feeCents)) {
      issues.push(
        issue(
          "invalid_delivery_policy",
          `deliveryBands.${index}.feeCents`,
          "Delivery band fee must be nonnegative integer cents.",
        ),
      );
    }
    if (band && Number.isSafeInteger(band.maxDistanceMeters)) {
      previousMaximum = band.maxDistanceMeters;
    }
  });
  if (issues.length > 0) throw new CartPricingError(issues);
}

function normalizeAdjustments(
  adjustments: readonly CartPricingAdjustment[],
): readonly CartPricingAdjustment[] {
  const issues: CartPricingIssue[] = [];
  const seen = new Set<string>();
  const normalized = adjustments.map((adjustment, index) => {
    const code = adjustment?.code?.trim().toLowerCase() ?? "";
    if (!/^[a-z][a-z0-9._-]{1,63}$/u.test(code) || seen.has(code)) {
      issues.push(
        issue(
          "invalid_adjustment",
          `adjustments.${index}.code`,
          "Adjustment code must be safe and unique.",
        ),
      );
    } else {
      seen.add(code);
    }
    if (!isCents(adjustment?.amountCents, true)) {
      issues.push(
        issue(
          "invalid_adjustment",
          `adjustments.${index}.amountCents`,
          "Adjustment must be signed integer cents within the cart limit.",
        ),
      );
    }
    return Object.freeze({ code, amountCents: adjustment?.amountCents ?? 0 });
  });
  if (issues.length > 0) throw new CartPricingError(issues);
  return Object.freeze(normalized);
}

function resolveDelivery(
  fulfillment: CartFulfillment,
  bands: readonly DeliveryPriceBand[],
  discountedMerchandiseSubtotalCents: number,
): CartPricingResult["delivery"] {
  if (fulfillment.method === "pickup") {
    return Object.freeze({
      method: "pickup",
      distanceMeters: null,
      appliedBand: null,
      feeCents: 0,
      freeDeliveryApplied: false,
    });
  }
  if (!Number.isSafeInteger(fulfillment.distanceMeters) || fulfillment.distanceMeters < 0) {
    throw new CartPricingError([
      issue(
        "invalid_delivery_policy",
        "fulfillment.distanceMeters",
        "Delivery distance must be nonnegative integer meters.",
      ),
    ]);
  }
  const band = bands.find(
    ({ maxDistanceMeters }) => fulfillment.distanceMeters <= maxDistanceMeters,
  );
  if (!band) {
    throw new CartPricingError([
      issue(
        "delivery_distance_unsupported",
        "fulfillment.distanceMeters",
        "Delivery distance is outside the configured pricing bands.",
      ),
    ]);
  }
  const freeDeliveryApplied =
    discountedMerchandiseSubtotalCents >= CART_FREE_DELIVERY_THRESHOLD_CENTS;
  return Object.freeze({
    method: "delivery",
    distanceMeters: fulfillment.distanceMeters,
    appliedBand: Object.freeze({ ...band }),
    feeCents: freeDeliveryApplied ? 0 : band.feeCents,
    freeDeliveryApplied,
  });
}

/**
 * Price a cart exclusively from server-loaded dish records and server-owned policies. Unknown fields
 * on browser line objects are deliberately ignored; only dish identity and quantity cross this API.
 */
export async function calculateCartPricing(
  input: CalculateCartPricingInput,
  dependencies: CartPricingDependencies,
): Promise<CartPricingResult> {
  if (!(input.at instanceof Date) || !Number.isFinite(input.at.getTime())) {
    throw new CartPricingError([
      issue("invalid_evaluation_time", "at", "Cart pricing time must be a valid date."),
    ]);
  }
  validateLines(input.lines);
  validateDeliveryBands(input.deliveryBands);
  const adjustments = normalizeAdjustments(input.adjustments ?? []);

  const requestedIds = input.lines.map(({ dishId }) => dishId.toLowerCase());
  const loaded = await dependencies.loadDishesByIds(Object.freeze([...requestedIds]));
  const sources = new Map<string, CartPricingDishSource>();
  for (const [index, source] of loaded.entries()) {
    if (
      !source ||
      !isDishId(source.id) ||
      !requestedIds.includes(source.id.toLowerCase()) ||
      sources.has(source.id.toLowerCase())
    ) {
      throw new CartPricingError([
        issue(
          "invalid_dish_source",
          `dishSources.${index}`,
          "Authoritative dish pricing source is invalid or duplicated.",
        ),
      ]);
    }
    sources.set(source.id.toLowerCase(), source);
  }

  const pricedLines: CartPricedLine[] = [];
  let subtotal = BigInt(0);
  let discount = BigInt(0);
  for (const [index, line] of input.lines.entries()) {
    const source = sources.get(line.dishId.toLowerCase());
    if (!source) {
      throw new CartPricingError([
        issue("dish_not_found", `lines.${index}.dishId`, "Cart dish pricing source was not found."),
      ]);
    }
    let unit: ReturnType<typeof calculateDishPrice>;
    try {
      unit = calculateDishPrice({
        at: input.at,
        basePriceCents: source.basePriceCents,
        discount: source.discount,
      });
    } catch (error) {
      if (!(error instanceof DishPricingError)) throw error;
      throw new CartPricingError([
        issue(
          "invalid_dish_source",
          `dishSources.${index}`,
          "Authoritative dish pricing data is invalid.",
        ),
      ]);
    }
    const lineBaseSubtotalCents = boundedCents(
      BigInt(unit.basePriceCents) * BigInt(line.quantity),
      `lines.${index}.lineBaseSubtotalCents`,
    );
    const lineDiscountCents = boundedCents(
      BigInt(unit.discountCents) * BigInt(line.quantity),
      `lines.${index}.lineDiscountCents`,
    );
    const lineSubtotalCents = lineBaseSubtotalCents - lineDiscountCents;
    subtotal += BigInt(lineBaseSubtotalCents);
    discount += BigInt(lineDiscountCents);
    pricedLines.push(
      Object.freeze({
        dishId: line.dishId.toLowerCase(),
        quantity: line.quantity,
        baseUnitPriceCents: unit.basePriceCents,
        unitDiscountCents: unit.discountCents,
        effectiveUnitPriceCents: unit.effectivePriceCents,
        lineBaseSubtotalCents,
        lineDiscountCents,
        lineSubtotalCents,
      }),
    );
  }

  const subtotalCents = boundedCents(subtotal, "summary.subtotalCents");
  const discountCents = boundedCents(discount, "summary.discountCents");
  const discountedMerchandiseSubtotalCents = subtotalCents - discountCents;
  const delivery = resolveDelivery(
    input.fulfillment,
    input.deliveryBands,
    discountedMerchandiseSubtotalCents,
  );
  const adjustmentsCentsBig = adjustments.reduce(
    (sum, adjustment) => sum + BigInt(adjustment.amountCents),
    BigInt(0),
  );
  if (
    adjustmentsCentsBig < BigInt(-CART_MAX_MONEY_CENTS) ||
    adjustmentsCentsBig > BigInt(CART_MAX_MONEY_CENTS)
  ) {
    throw new CartPricingError([
      issue(
        "money_limit_exceeded",
        "summary.adjustmentsCents",
        "Combined adjustments exceed the supported cart range.",
      ),
    ]);
  }
  const total =
    BigInt(discountedMerchandiseSubtotalCents) + BigInt(delivery.feeCents) + adjustmentsCentsBig;
  if (total < BigInt(0)) {
    throw new CartPricingError([
      issue("negative_total", "summary.totalCents", "Cart adjustments cannot make total negative."),
    ]);
  }
  const totalCents = boundedCents(total, "summary.totalCents");
  const adjustmentsCents = Number(adjustmentsCentsBig);
  const calculatedAt = input.at.toISOString();

  return Object.freeze({
    currency: CART_CURRENCY,
    pricedAt: calculatedAt,
    lines: Object.freeze(pricedLines),
    delivery,
    adjustments,
    tax: Object.freeze({ policy: CART_TAX_POLICY, amountCents: 0 }),
    summary: Object.freeze({
      subtotalCents,
      discountCents,
      deliveryFeeCents: delivery.feeCents,
      taxCents: 0,
      adjustmentsCents,
      totalCents,
      calculatedAt,
    }),
  });
}
