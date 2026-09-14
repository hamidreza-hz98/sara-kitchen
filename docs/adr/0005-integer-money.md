# ADR-0005 — Represent money as integer EUR cents

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

Dish prices, fixed/percentage discounts, delivery fees, carts, MB Way transactions, orders, refunds,
sales analytics, and generated invoices must agree exactly. JavaScript binary floating-point arithmetic
cannot exactly represent many decimal currency values. Recomputing historical orders from mutable dish
prices would also corrupt financial history.

The MVP charges in euros, includes no VAT for now, has no minimum order, grants free delivery when the
discounted merchandise subtotal reaches €200, and derives the cart/order lead time separately from
money.

## Decision

Represent every EUR monetary amount as a non-negative integer number of cents and label persisted
financial documents with currency `EUR`.

- Use names that expose the unit: `unitPriceCents`, `subtotalCents`, `discountCents`,
  `deliveryFeeCents`, `taxCents`, `totalCents`, and `refundedCents`. Do not use ambiguous `price` fields
  in new persistence or public contracts.
- Validate values with `Number.isSafeInteger`, domain-specific non-negative bounds, and Zod integer
  schemas. Never persist `NaN`, infinity, negative zero, or fractional cents.
- Model a discount as a discriminated union: fixed amount in cents or percentage in integer basis
  points, where 10,000 basis points equals 100%. Constrain percentage discounts to 0–10,000.
- Calculate percentage discounts using one documented half-up rounding operation at the line level:
  `floor((grossCents * basisPoints + 5_000) / 10_000)`. Cap discount at the applicable gross amount.
- Cart/order arithmetic occurs only on the server from authoritative dish data. Clients may display
  estimates but never submit trusted totals.
- The free-delivery threshold is 20,000 cents of discounted merchandise subtotal, before delivery and
  tax, preventing a circular fee calculation. Pickup always has a zero delivery fee.
- Store quantity, unit price, discount definition/result, line subtotal, delivery fee, tax, currency,
  and final totals as immutable order and transaction snapshots. Invoices render those snapshots.
- VAT remains zero for MVP, but retain an explicit `taxCents` and tax-policy snapshot so later legal
  requirements do not require reinterpreting old orders.
- Format money only at presentation boundaries with locale-aware `Intl.NumberFormat`; never parse a
  formatted string for business arithmetic.
- Payment-provider adapters translate cents to the provider's required minor-unit representation and
  reject a response whose currency or expected amount does not match the transaction snapshot.

## Alternatives considered

### JavaScript floating-point euros

Rejected because repeated addition, percentage calculations, and equality checks can produce rounding
errors that are unacceptable for payments and invoices.

### MongoDB Decimal128

Rejected for the single-currency MVP because it adds driver/domain conversion complexity and still
requires an explicit scale/rounding contract. It may be appropriate for currencies or calculations with
non-cent precision later.

### Decimal strings

Rejected as the internal representation because sorting, aggregation, validation, and arithmetic become
more error-prone. Strings remain suitable only at human/provider boundaries when required.

### Recalculate orders from current dish prices

Rejected because catalog changes must not alter historical orders, transactions, refunds, analytics, or
invoices.

## Consequences

### Positive

- Arithmetic, comparisons, thresholds, and MongoDB aggregation are deterministic.
- Provider reconciliation and invoice totals share one minor-unit representation.
- Field names make units visible during review and reduce accidental euro/cent mixing.
- Immutable snapshots preserve auditable historical values.

### Costs and risks

- Every external/display boundary needs explicit conversion and formatting.
- Percentage rounding must occur at the documented level and cannot vary by screen.
- Large analytics totals must remain within JavaScript's safe-integer range or use a larger aggregate
  representation.
- Future zero-decimal or three-decimal currencies would require currency metadata rather than assuming
  two decimals globally.

## Revisit when

- Sara Kitchen accepts a currency whose minor-unit exponent is not two.
- Accounting, tax, or provider rules require sub-cent precision or a different rounding mode.
- Aggregated financial totals can approach `Number.MAX_SAFE_INTEGER`.

## References

- [MDN Number.isSafeInteger](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isSafeInteger)
- [ECMAScript internationalization currency formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
