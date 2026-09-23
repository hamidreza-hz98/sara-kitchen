import "server-only";

import type { DishDiscount, DishDiscountType } from "../model/dish";

export const DISH_PRICE_CURRENCY = "EUR" as const;
export const DISH_PERCENTAGE_BASIS_POINTS = 10_000;

export const DISH_PRICING_ERROR_CODES = [
  "invalid_base_price",
  "invalid_discount_type",
  "discount_on_zero_price",
  "none_discount_has_values",
  "invalid_fixed_discount",
  "fixed_discount_exceeds_price",
  "fixed_discount_has_percentage",
  "invalid_percentage_discount",
  "percentage_discount_has_amount",
  "invalid_discount_start",
  "invalid_discount_end",
  "invalid_discount_schedule",
  "invalid_evaluation_time",
] as const;

export type DishPricingErrorCode = (typeof DISH_PRICING_ERROR_CODES)[number];
export type DishDiscountState = "none" | "scheduled" | "active" | "expired";

export type DishPricingIssue = {
  code: DishPricingErrorCode;
  message: string;
  path: "basePriceCents" | `discount.${keyof DishDiscount}` | "discount" | "at";
};

export type DishDiscountMetadata = {
  amountCents: number | null;
  basisPoints: number | null;
  endsAt: string | null;
  startsAt: string | null;
  state: DishDiscountState;
  type: Exclude<DishDiscountType, "none">;
};

export type DishPriceBadge =
  { amountCents: number; kind: "fixed" } | { basisPoints: number; kind: "percentage" };

export type DishPriceResult = {
  basePriceCents: number;
  currency: typeof DISH_PRICE_CURRENCY;
  discountCents: number;
  discountMetadata: DishDiscountMetadata | null;
  discountState: DishDiscountState;
  display: {
    badge: DishPriceBadge | null;
    compareAtPriceCents: number | null;
    showOriginalPrice: boolean;
  };
  effectivePriceCents: number;
};

export type CalculateDishPriceInput = {
  at?: Date;
  basePriceCents: number;
  discount: DishDiscount;
};

export class DishPricingError extends Error {
  readonly issues: readonly DishPricingIssue[];

  constructor(issues: readonly DishPricingIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "DishPricingError";
    this.issues = issues;
  }
}

const issue = (
  code: DishPricingErrorCode,
  path: DishPricingIssue["path"],
  message: string,
): DishPricingIssue => ({ code, path, message });

function isNonnegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
  );
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** Validate the persisted pricing definition without deciding whether its schedule is active. */
export function validateDishPricingDefinition(
  basePriceCents: number,
  discount: DishDiscount,
): readonly DishPricingIssue[] {
  const issues: DishPricingIssue[] = [];
  if (!isNonnegativeSafeInteger(basePriceCents)) {
    issues.push(
      issue(
        "invalid_base_price",
        "basePriceCents",
        "Dish base price must be a nonnegative safe integer number of cents.",
      ),
    );
  }

  if (!discount || !["none", "fixed", "percentage"].includes(discount.type)) {
    issues.push(issue("invalid_discount_type", "discount.type", "Dish discount type is invalid."));
    return issues;
  }

  if (discount.startsAt !== null && !isValidDate(discount.startsAt)) {
    issues.push(
      issue("invalid_discount_start", "discount.startsAt", "Discount start must be a valid date."),
    );
  }
  if (discount.endsAt !== null && !isValidDate(discount.endsAt)) {
    issues.push(
      issue("invalid_discount_end", "discount.endsAt", "Discount end must be a valid date."),
    );
  }
  if (
    isValidDate(discount.startsAt) &&
    isValidDate(discount.endsAt) &&
    discount.endsAt.getTime() <= discount.startsAt.getTime()
  ) {
    issues.push(
      issue(
        "invalid_discount_schedule",
        "discount.endsAt",
        "Discount end must be later than its start.",
      ),
    );
  }

  if (discount.type === "none") {
    if (
      discount.amountCents !== null ||
      discount.basisPoints !== null ||
      discount.startsAt !== null ||
      discount.endsAt !== null
    ) {
      issues.push(
        issue(
          "none_discount_has_values",
          "discount",
          "A none discount cannot contain value or schedule fields.",
        ),
      );
    }
    return issues;
  }

  if (basePriceCents === 0) {
    issues.push(
      issue("discount_on_zero_price", "discount", "A zero-price dish cannot have a discount."),
    );
  }

  if (discount.type === "fixed") {
    if (!isNonnegativeSafeInteger(discount.amountCents) || discount.amountCents === 0) {
      issues.push(
        issue(
          "invalid_fixed_discount",
          "discount.amountCents",
          "Fixed discount must be a positive safe integer number of cents.",
        ),
      );
    } else if (isNonnegativeSafeInteger(basePriceCents) && discount.amountCents > basePriceCents) {
      issues.push(
        issue(
          "fixed_discount_exceeds_price",
          "discount.amountCents",
          "Fixed discount cannot exceed the dish base price.",
        ),
      );
    }
    if (discount.basisPoints !== null) {
      issues.push(
        issue(
          "fixed_discount_has_percentage",
          "discount.basisPoints",
          "Fixed discount cannot contain percentage basis points.",
        ),
      );
    }
    return issues;
  }

  if (
    !isNonnegativeSafeInteger(discount.basisPoints) ||
    discount.basisPoints < 1 ||
    discount.basisPoints > DISH_PERCENTAGE_BASIS_POINTS
  ) {
    issues.push(
      issue(
        "invalid_percentage_discount",
        "discount.basisPoints",
        "Percentage discount must be an integer from 1 through 10,000 basis points.",
      ),
    );
  }
  if (discount.amountCents !== null) {
    issues.push(
      issue(
        "percentage_discount_has_amount",
        "discount.amountCents",
        "Percentage discount cannot contain a fixed amount.",
      ),
    );
  }
  return issues;
}

function resolveDiscountState(discount: DishDiscount, at: Date): DishDiscountState {
  if (discount.type === "none") return "none";
  if (discount.startsAt && at.getTime() < discount.startsAt.getTime()) return "scheduled";
  if (discount.endsAt && at.getTime() >= discount.endsAt.getTime()) return "expired";
  return "active";
}

function calculatePercentageDiscount(basePriceCents: number, basisPoints: number): number {
  const rounded =
    (BigInt(basePriceCents) * BigInt(basisPoints) + BigInt(DISH_PERCENTAGE_BASIS_POINTS / 2)) /
    BigInt(DISH_PERCENTAGE_BASIS_POINTS);
  return Number(rounded);
}

/**
 * Resolve one authoritative unit price. Schedule start is inclusive and end is exclusive. Percentage
 * discounts use integer half-up rounding from ADR-0005 and never use floating-point euro arithmetic.
 */
export function calculateDishPrice(input: CalculateDishPriceInput): DishPriceResult {
  const at = input.at ?? new Date();
  const issues = [...validateDishPricingDefinition(input.basePriceCents, input.discount)];
  if (!isValidDate(at)) {
    issues.push(issue("invalid_evaluation_time", "at", "Pricing time must be a valid date."));
  }
  if (issues.length > 0) throw new DishPricingError(issues);

  const state = resolveDiscountState(input.discount, at);
  const active = state === "active";
  let discountCents = 0;
  if (active && input.discount.type === "fixed") {
    discountCents = input.discount.amountCents!;
  } else if (active && input.discount.type === "percentage") {
    discountCents = calculatePercentageDiscount(input.basePriceCents, input.discount.basisPoints!);
  }
  discountCents = Math.min(discountCents, input.basePriceCents);
  const effectivePriceCents = input.basePriceCents - discountCents;
  const hasEffectiveDiscount = active && discountCents > 0;

  const discountMetadata: DishDiscountMetadata | null =
    input.discount.type === "none"
      ? null
      : {
          type: input.discount.type,
          state,
          amountCents: input.discount.amountCents,
          basisPoints: input.discount.basisPoints,
          startsAt: input.discount.startsAt?.toISOString() ?? null,
          endsAt: input.discount.endsAt?.toISOString() ?? null,
        };
  const badge: DishPriceBadge | null =
    !hasEffectiveDiscount || input.discount.type === "none"
      ? null
      : input.discount.type === "fixed"
        ? { kind: "fixed", amountCents: discountCents }
        : { kind: "percentage", basisPoints: input.discount.basisPoints! };

  return {
    currency: DISH_PRICE_CURRENCY,
    basePriceCents: input.basePriceCents,
    effectivePriceCents,
    discountCents,
    discountState: state,
    discountMetadata,
    display: {
      badge,
      compareAtPriceCents: hasEffectiveDiscount ? input.basePriceCents : null,
      showOriginalPrice: hasEffectiveDiscount,
    },
  };
}
