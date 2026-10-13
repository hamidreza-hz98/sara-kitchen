import "server-only";

import {
  DISH_MAX_LEAD_TIME_MINUTES,
  DISH_MAX_QUANTITY_PER_ORDER,
  type DishAvailability,
  type DishStatus,
} from "@/server/modules/dishes";

export const CART_AVAILABILITY_STAGES = ["cart_mutation", "checkout"] as const;
export const CART_SERVICE_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type CartAvailabilityStage = (typeof CART_AVAILABILITY_STAGES)[number];
export type CartServiceWeekday = (typeof CART_SERVICE_WEEKDAYS)[number];

export type CartAvailabilityLineInput = Readonly<{
  dishId: string;
  expectedLeadTimeMinutes?: number;
  quantity: number;
}>;

export type CartAvailabilityDishSource = Readonly<{
  availability: DishAvailability;
  deletedAt: Date | null;
  id: string;
  leadTimeMinutes: number;
  maxQuantityPerOrder: number;
  /** `null`/omitted means made-to-order with no quantitative inventory policy. */
  stockQuantity?: number | null;
  status: DishStatus;
}>;

export type CartServicePeriod = Readonly<{
  closesAt: string;
  opensAt: string;
}>;

export type CartServicePolicy =
  | Readonly<{
      cutoffMinutesBeforeClose: number;
      mode: "always";
      timeZone: string;
    }>
  | Readonly<{
      cutoffMinutesBeforeClose: number;
      days: readonly Readonly<{
        day: CartServiceWeekday;
        periods: readonly CartServicePeriod[];
      }>[];
      mode: "weekly";
      timeZone: string;
    }>;

export type CartAvailabilityFulfillment =
  | Readonly<{ method: "pickup" }>
  | Readonly<{
      deliveryArea: Readonly<{
        eligible: boolean;
        reason?: "outside_service_area" | "unverified_address";
      }>;
      method: "delivery";
    }>;

export type CartAvailabilityCorrection =
  | Readonly<{ action: "remove_line" }>
  | Readonly<{ action: "set_quantity"; quantity: number }>
  | Readonly<{
      action: "accept_lead_time";
      earliestReadyAt: string;
      leadTimeMinutes: number;
    }>
  | Readonly<{ action: "retry_at"; at: string }>
  | Readonly<{ action: "retry_when_service_opens" }>
  | Readonly<{ action: "select_delivery_address" }>
  | Readonly<{ action: "choose_pickup_or_address" }>;

export const CART_AVAILABILITY_ISSUE_CODES = [
  "dish_not_found",
  "dish_not_active",
  "dish_unavailable",
  "dish_schedule_not_started",
  "dish_schedule_ended",
  "quantity_exceeds_limit",
  "stock_unavailable",
  "stock_insufficient",
  "lead_time_changed",
  "service_closed",
  "order_cutoff_passed",
  "delivery_address_unverified",
  "outside_delivery_area",
] as const;

export type CartAvailabilityIssueCode = (typeof CART_AVAILABILITY_ISSUE_CODES)[number];
export type CartAvailabilityIssue = Readonly<{
  code: CartAvailabilityIssueCode;
  correction: CartAvailabilityCorrection;
  dishId: string | null;
  lineIndex: number | null;
  messageKey: `cart.availability.${CartAvailabilityIssueCode}`;
  scope: "line" | "order" | "fulfillment";
}>;

export type CartAvailabilityLineResult = Readonly<{
  available: boolean;
  dishId: string;
  leadTimeMinutes: number | null;
  maxAllowedQuantity: number;
  quantity: number;
}>;

export type CartAvailabilityResult = Readonly<{
  earliestReadyAt: string;
  evaluatedAt: string;
  issues: readonly CartAvailabilityIssue[];
  lines: readonly CartAvailabilityLineResult[];
  orderLeadTimeMinutes: number;
  stage: CartAvailabilityStage;
  valid: boolean;
}>;

export type ValidateCartAvailabilityInput = Readonly<{
  at: Date;
  fulfillment: CartAvailabilityFulfillment;
  lines: readonly CartAvailabilityLineInput[];
  servicePolicy: CartServicePolicy;
  stage: CartAvailabilityStage;
}>;

export type CartAvailabilityDependencies = Readonly<{
  loadDishesByIds(dishIds: readonly string[]): Promise<readonly CartAvailabilityDishSource[]>;
}>;

export class CartAvailabilityPolicyError extends Error {
  constructor(readonly code: "invalid_input" | "invalid_policy" | "invalid_source") {
    super(code);
    this.name = "CartAvailabilityPolicyError";
  }
}

const DISH_ID_PATTERN = /^[a-f\d]{24}$/iu;
const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const WEEKDAY_BY_SHORT_NAME: Readonly<Record<string, CartServiceWeekday>> = {
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday",
  Sun: "sunday",
};

function clockMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validateServicePolicy(policy: CartServicePolicy): void {
  if (
    !policy ||
    !Number.isSafeInteger(policy.cutoffMinutesBeforeClose) ||
    policy.cutoffMinutesBeforeClose < 0 ||
    policy.cutoffMinutesBeforeClose > 1_440
  ) {
    throw new CartAvailabilityPolicyError("invalid_policy");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: policy.timeZone }).format(new Date(0));
  } catch {
    throw new CartAvailabilityPolicyError("invalid_policy");
  }
  if (policy.mode === "always") return;
  if (policy.mode !== "weekly" || policy.days.length !== CART_SERVICE_WEEKDAYS.length) {
    throw new CartAvailabilityPolicyError("invalid_policy");
  }
  const seen = new Set<CartServiceWeekday>();
  for (const day of policy.days) {
    if (!CART_SERVICE_WEEKDAYS.includes(day.day) || seen.has(day.day) || day.periods.length > 3) {
      throw new CartAvailabilityPolicyError("invalid_policy");
    }
    seen.add(day.day);
    let previousClose = -1;
    for (const period of day.periods) {
      if (!CLOCK_PATTERN.test(period.opensAt) || !CLOCK_PATTERN.test(period.closesAt)) {
        throw new CartAvailabilityPolicyError("invalid_policy");
      }
      const opens = clockMinutes(period.opensAt);
      const closes = clockMinutes(period.closesAt);
      if (
        opens >= closes ||
        opens < previousClose ||
        policy.cutoffMinutesBeforeClose >= closes - opens
      ) {
        throw new CartAvailabilityPolicyError("invalid_policy");
      }
      previousClose = closes;
    }
  }
}

function localWeekdayAndMinute(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = WEEKDAY_BY_SHORT_NAME[values.weekday ?? ""];
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new CartAvailabilityPolicyError("invalid_policy");
  }
  return { weekday, minuteOfDay: hour * 60 + minute };
}

function serviceIssue(
  at: Date,
  policy: CartServicePolicy,
): "service_closed" | "order_cutoff_passed" | null {
  if (policy.mode === "always") return null;
  const local = localWeekdayAndMinute(at, policy.timeZone);
  const day = policy.days.find(({ day: value }) => value === local.weekday);
  const period = day?.periods.find(({ opensAt, closesAt }) => {
    const opens = clockMinutes(opensAt);
    const closes = clockMinutes(closesAt);
    return local.minuteOfDay >= opens && local.minuteOfDay < closes;
  });
  if (!period) return "service_closed";
  const latestAcceptedMinute = clockMinutes(period.closesAt) - policy.cutoffMinutesBeforeClose;
  return local.minuteOfDay >= latestAcceptedMinute ? "order_cutoff_passed" : null;
}

function availabilityIssue(source: CartAvailabilityDishSource, at: Date) {
  if (source.status !== "published" || source.deletedAt !== null) {
    return { code: "dish_not_active", correction: { action: "remove_line" } } as const;
  }
  if (source.availability.mode === "unavailable") {
    return { code: "dish_unavailable", correction: { action: "remove_line" } } as const;
  }
  if (source.availability.mode === "available") return null;
  const from = source.availability.availableFrom;
  const until = source.availability.availableUntil;
  if (from && at.getTime() < from.getTime()) {
    return {
      code: "dish_schedule_not_started",
      correction: { action: "retry_at", at: from.toISOString() },
    } as const;
  }
  if (until && at.getTime() >= until.getTime()) {
    return { code: "dish_schedule_ended", correction: { action: "remove_line" } } as const;
  }
  return null;
}

function isValidDateOrNull(value: unknown): value is Date | null {
  return value === null || (value instanceof Date && Number.isFinite(value.getTime()));
}

function isValidAvailability(value: DishAvailability): boolean {
  if (
    !value ||
    !["available", "unavailable", "scheduled"].includes(value.mode) ||
    !isValidDateOrNull(value.availableFrom) ||
    !isValidDateOrNull(value.availableUntil)
  ) {
    return false;
  }
  if (value.mode !== "scheduled") {
    return value.availableFrom === null && value.availableUntil === null;
  }
  if (value.availableFrom === null && value.availableUntil === null) return false;
  return !(
    value.availableFrom &&
    value.availableUntil &&
    value.availableUntil.getTime() <= value.availableFrom.getTime()
  );
}

function lineIssue(
  code: CartAvailabilityIssueCode,
  correction: CartAvailabilityCorrection,
  dishId: string,
  lineIndex: number,
): CartAvailabilityIssue {
  return Object.freeze({
    code,
    correction: Object.freeze(correction),
    dishId,
    lineIndex,
    messageKey: `cart.availability.${code}`,
    scope: "line",
  });
}

function nonLineIssue(
  code: CartAvailabilityIssueCode,
  scope: "order" | "fulfillment",
  correction: CartAvailabilityCorrection,
): CartAvailabilityIssue {
  return Object.freeze({
    code,
    correction: Object.freeze(correction),
    dishId: null,
    lineIndex: null,
    messageKey: `cart.availability.${code}`,
    scope,
  });
}

function validateInput(input: ValidateCartAvailabilityInput): void {
  if (
    !input ||
    !(input.at instanceof Date) ||
    !Number.isFinite(input.at.getTime()) ||
    !CART_AVAILABILITY_STAGES.includes(input.stage) ||
    !Array.isArray(input.lines) ||
    !input.fulfillment ||
    !["pickup", "delivery"].includes(input.fulfillment.method) ||
    (input.fulfillment.method === "delivery" &&
      (!input.fulfillment.deliveryArea ||
        typeof input.fulfillment.deliveryArea.eligible !== "boolean" ||
        (input.fulfillment.deliveryArea.reason !== undefined &&
          !["outside_service_area", "unverified_address"].includes(
            input.fulfillment.deliveryArea.reason,
          ))))
  ) {
    throw new CartAvailabilityPolicyError("invalid_input");
  }
  const seen = new Set<string>();
  for (const line of input.lines) {
    const normalizedId = line?.dishId?.toLowerCase();
    if (
      !line ||
      !DISH_ID_PATTERN.test(line.dishId) ||
      seen.has(normalizedId) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > DISH_MAX_QUANTITY_PER_ORDER ||
      (line.expectedLeadTimeMinutes !== undefined &&
        (!Number.isSafeInteger(line.expectedLeadTimeMinutes) ||
          line.expectedLeadTimeMinutes < 0 ||
          line.expectedLeadTimeMinutes > DISH_MAX_LEAD_TIME_MINUTES))
    ) {
      throw new CartAvailabilityPolicyError("invalid_input");
    }
    seen.add(normalizedId);
  }
}

/**
 * Revalidate orderability from authoritative dish/service/zone data. The result never mutates a cart;
 * every failure carries the explicit customer correction required before retrying.
 */
export async function validateCartAvailability(
  input: ValidateCartAvailabilityInput,
  dependencies: CartAvailabilityDependencies,
): Promise<CartAvailabilityResult> {
  validateInput(input);
  validateServicePolicy(input.servicePolicy);

  const ids = Object.freeze(input.lines.map(({ dishId }) => dishId.toLowerCase()));
  const loaded = await dependencies.loadDishesByIds(ids);
  const requested = new Set(ids);
  const sources = new Map<string, CartAvailabilityDishSource>();
  for (const source of loaded) {
    const id = source?.id?.toLowerCase();
    if (
      !source ||
      !DISH_ID_PATTERN.test(source.id) ||
      !requested.has(id) ||
      sources.has(id) ||
      !["draft", "published", "archived"].includes(source.status) ||
      !isValidDateOrNull(source.deletedAt) ||
      !isValidAvailability(source.availability) ||
      !Number.isSafeInteger(source.leadTimeMinutes) ||
      source.leadTimeMinutes < 0 ||
      source.leadTimeMinutes > DISH_MAX_LEAD_TIME_MINUTES ||
      !Number.isSafeInteger(source.maxQuantityPerOrder) ||
      source.maxQuantityPerOrder < 1 ||
      source.maxQuantityPerOrder > DISH_MAX_QUANTITY_PER_ORDER ||
      (source.stockQuantity !== undefined &&
        source.stockQuantity !== null &&
        (!Number.isSafeInteger(source.stockQuantity) || source.stockQuantity < 0))
    ) {
      throw new CartAvailabilityPolicyError("invalid_source");
    }
    sources.set(id, source);
  }

  const issues: CartAvailabilityIssue[] = [];
  const lineResults: CartAvailabilityLineResult[] = [];
  let orderLeadTimeMinutes = 0;

  input.lines.forEach((line, lineIndex) => {
    const dishId = line.dishId.toLowerCase();
    const source = sources.get(dishId);
    if (!source) {
      issues.push(lineIssue("dish_not_found", { action: "remove_line" }, dishId, lineIndex));
      lineResults.push(
        Object.freeze({
          available: false,
          dishId,
          leadTimeMinutes: null,
          maxAllowedQuantity: 0,
          quantity: line.quantity,
        }),
      );
      return;
    }

    const availability = availabilityIssue(source, input.at);
    if (availability) {
      issues.push(lineIssue(availability.code, availability.correction, dishId, lineIndex));
    }
    const stockQuantity = source.stockQuantity ?? null;
    const maxAllowedQuantity = Math.min(
      source.maxQuantityPerOrder,
      stockQuantity ?? source.maxQuantityPerOrder,
    );
    if (stockQuantity === 0) {
      issues.push(lineIssue("stock_unavailable", { action: "remove_line" }, dishId, lineIndex));
    } else if (line.quantity > maxAllowedQuantity) {
      issues.push(
        lineIssue(
          stockQuantity !== null ? "stock_insufficient" : "quantity_exceeds_limit",
          { action: "set_quantity", quantity: maxAllowedQuantity },
          dishId,
          lineIndex,
        ),
      );
    }

    orderLeadTimeMinutes = Math.max(orderLeadTimeMinutes, source.leadTimeMinutes);
    if (
      input.stage === "checkout" &&
      line.expectedLeadTimeMinutes !== undefined &&
      line.expectedLeadTimeMinutes !== source.leadTimeMinutes
    ) {
      issues.push(
        lineIssue(
          "lead_time_changed",
          {
            action: "accept_lead_time",
            leadTimeMinutes: source.leadTimeMinutes,
            earliestReadyAt: new Date(
              input.at.getTime() + source.leadTimeMinutes * 60_000,
            ).toISOString(),
          },
          dishId,
          lineIndex,
        ),
      );
    }
    lineResults.push(
      Object.freeze({
        available: !availability && stockQuantity !== 0 && line.quantity <= maxAllowedQuantity,
        dishId,
        leadTimeMinutes: source.leadTimeMinutes,
        maxAllowedQuantity,
        quantity: line.quantity,
      }),
    );
  });

  const serviceCode = serviceIssue(input.at, input.servicePolicy);
  if (serviceCode) {
    issues.push(nonLineIssue(serviceCode, "order", { action: "retry_when_service_opens" }));
  }
  if (input.fulfillment.method === "delivery" && !input.fulfillment.deliveryArea.eligible) {
    const unverified = input.fulfillment.deliveryArea.reason === "unverified_address";
    issues.push(
      nonLineIssue(
        unverified ? "delivery_address_unverified" : "outside_delivery_area",
        "fulfillment",
        unverified ? { action: "select_delivery_address" } : { action: "choose_pickup_or_address" },
      ),
    );
  }

  const evaluatedAt = input.at.toISOString();
  const earliestReadyAt = new Date(
    input.at.getTime() + orderLeadTimeMinutes * 60_000,
  ).toISOString();
  return Object.freeze({
    stage: input.stage,
    evaluatedAt,
    orderLeadTimeMinutes,
    earliestReadyAt,
    valid: issues.length === 0,
    lines: Object.freeze(lineResults),
    issues: Object.freeze(issues),
  });
}
