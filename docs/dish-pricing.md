# Dish pricing rules (SK-0093)

`calculateDishPrice()` is the authoritative unit-price resolver for catalog, cart, checkout, order
snapshots, invoices, and API mappers. Callers supply the persisted integer-cent base price, the Dish
discount definition, and an explicit evaluation instant for deterministic work. Omitting `at` uses
the current server time and is suitable only when a reproducible instant is not already available.

## Money and discount representation

- Currency is always `EUR` for MVP.
- `basePriceCents`, `discountCents`, and `effectivePriceCents` are nonnegative safe integers.
- Negative zero, fractional cents, `NaN`, infinity, and unsafe integers are invalid.
- A zero-price dish is valid only with `type: none`; it cannot advertise a meaningless discount.
- `none` requires null amount, percentage, and schedule fields.
- `fixed` requires a positive integer `amountCents`, no `basisPoints`, and cannot exceed the base
  price. A fixed discount equal to the base price is valid and produces a free effective price.
- `percentage` requires integer `basisPoints` from 1 through 10,000, no `amountCents`, and may produce
  a free effective price at 10,000 basis points.

Fixed and percentage values are mutually exclusive. `validateDishPricingDefinition()` returns stable
codes and field paths for schema, request, and form error mapping. `calculateDishPrice()` repeats that
validation and throws `DishPricingError` rather than calculating from malformed or conflicting data.
The Dish model calls the same validator during document validation, so persistence and runtime pricing
cannot drift.

## Schedule semantics

Discount start is inclusive and discount end is exclusive:

- before `startsAt`: `scheduled`;
- at or after `startsAt`, and before `endsAt`: `active`;
- at or after `endsAt`: `expired`.

Either boundary may be null. If both exist, end must be strictly later than start. Invalid dates and
invalid evaluation instants are rejected. Instants are persisted and exchanged in UTC; admin
conversion from `Europe/Lisbon` is an input concern.

Only an active discount changes price. Scheduled and expired definitions remain in metadata for
transparent UI state but resolve to the base price.

## Percentage rounding

Percentage discount cents use ADR-0005 half-up rounding at one unit-price line:

```text
discountCents = floor((basePriceCents × basisPoints + 5,000) / 10,000)
```

The implementation performs this intermediate calculation with `BigInt`, then converts the bounded
result back to `number`. This preserves the formula for a base price as large as
`Number.MAX_SAFE_INTEGER` without overflowing the multiplication. The result is capped at the base
price as a final defense, and effective price is `basePriceCents - discountCents`.

Cart quantity multiplication and order-line rounding are later pricing-engine concerns. They must use
the already resolved unit values and must not recalculate percentage discounts with a different
rounding level.

## Display metadata

The result supplies numeric and structural metadata, never preformatted or translated strings:

- `currency`, base, discount, and effective cents;
- `discountState` plus the complete normalized definition with ISO schedule boundaries;
- `display.showOriginalPrice` and `display.compareAtPriceCents`;
- a fixed-amount or percentage badge payload when the active definition produces at least one cent of
  actual reduction.

A valid percentage that rounds to zero cents remains `active` for business diagnostics, but it emits
no badge or strike-through metadata. Presentation layers format cents and badge text with the locale
helpers; they never parse display strings back into money.

## Required consumers

Catalog cards/details, cart refresh/mutation, authoritative checkout, immutable order snapshots,
invoices, payment amount checks, and analytics must consume this resolver or a higher-level pricing
service that delegates to it. Clients may display the returned result but cannot submit trusted price
totals.

Tests cover no-discount and zero-price behavior, fixed and percentage exclusivity, full-discount
boundaries, half-cent rounding, maximum safe integers, one/two-sided schedules, exact start/end
instants, expired/future discounts, malformed values/dates, and display metadata.
