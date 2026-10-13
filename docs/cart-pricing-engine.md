# Cart pricing engine

## Purpose

`calculateCartPricing` is the single server-only calculation boundary for cart and checkout totals.
Callers provide dish IDs and quantities; the engine obtains current base prices and discount definitions
through the Dishes module public API. Price-like fields arriving from a browser are outside the input
contract and are ignored at runtime.

The engine is pure apart from its injected authoritative dish lookup. It returns an immutable snapshot
that can be persisted on a cart and recalculated before checkout or order creation.

## Calculation order

All monetary values are integer euro cents under ADR-0005.

1. Validate unique dish IDs and whole quantities from 1 through 99.
2. Load each requested dish's authoritative base price and discount definition.
3. Resolve the discount at one explicit pricing instant. Schedule starts are inclusive and ends are
   exclusive; percentage discounts use half-up rounding once per unit.
4. Multiply unit base and discount values by quantity. The merchandise subtotal is the sum of base line
   subtotals; `discountCents` is reported separately.
5. Resolve fulfillment. Pickup costs zero. Delivery uses the first configured band whose inclusive
   maximum distance contains the server-calculated distance.
6. Waive delivery when the discounted merchandise subtotal is at least `20_000` cents (€200).
7. Set tax to zero under the approved MVP no-VAT policy.
8. Add allow-listed server-authored signed adjustments and calculate the total:

   `total = subtotal - discount + delivery + tax + adjustments`

Negative totals and values beyond the Cart money limit are rejected instead of clamped.

## Trust boundaries

- Browser data may identify a dish and quantity only. It cannot supply price, discount, delivery fee,
  tax, adjustment, currency, or total.
- Delivery distance must be calculated by the server-side delivery eligibility service. The engine
  accepts integer meters, never a customer-supplied fee.
- Delivery bands and adjustments are server-owned policy inputs. Adjustment codes are normalized,
  bounded, and unique so downstream invoices and audit records have stable identifiers.
- An invalid, duplicate, missing, or unrequested record returned by the dish adapter fails pricing.
- The same `at` instant is used for every line so a discount cannot cross a schedule boundary midway
  through one calculation.

## Tax policy

`tax.policy` is `disabled_mvp` and `tax.amountCents` is always zero. The explicit field prevents an
implicit tax assumption from leaking into invoice or payment code. Enabling tax later requires a new
versioned policy and golden fixtures; it must not be introduced as an adjustment.

## Failure contract

`CartPricingError` returns stable internal issue codes and field paths for validation mapping. It does
not expose persistence data. Distance outside all configured bands is rejected as
`delivery_distance_unsupported`; checkout must not turn that condition into a zero delivery fee.

## Verification

`tests/unit/cart-pricing.test.ts` contains golden fixtures for mixed fixed and percentage discounts,
quantity multiplication, delivery-band edges, the €200 threshold, free pickup, zero tax, adjustments,
discount schedule boundaries, immutable snapshots, malformed source data, and spoofed client prices.
