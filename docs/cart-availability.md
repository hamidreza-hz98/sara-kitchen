# Cart availability validation

## Boundary

`validateCartAvailability` is the server-only orderability policy shared by cart item add/update and
checkout. It receives only cart identity facts, one evaluation instant, server-owned service policy,
and a current delivery-zone decision. Dish state is loaded through the Dishes module public API.

SK-0140 must call it after every add or quantity update and before returning recalculated cart state.
Checkout must call it again inside the order-creation consistency boundary. A successful earlier cart
check is never a reservation and cannot be reused as checkout authorization.

## Dish rules

A line is orderable only when all of these remain true:

- the dish still exists, is published, and is not soft-deleted;
- availability is `available`, or a scheduled window has started and has not reached its exclusive end;
- quantity is a whole number within both `maxQuantityPerOrder` and optional quantitative stock;
- lead time is an integer from zero through 10,080 minutes.

Quantitative stock is optional. `null` or an omitted `stockQuantity` preserves the approved
made-to-order launch policy and applies only the dish maximum. A numeric stock value activates the same
validator without changing the current Dish schema or pretending that sold-count analytics are stock.

The order lead time is the maximum current lead time across loaded lines. The returned
`earliestReadyAt` is the evaluation instant plus that maximum. At checkout, a changed lead-time
snapshot blocks submission until the customer accepts the new readiness time.

## Service, cutoff, and delivery

The launch policy is `mode: always` in `Europe/Lisbon`, matching the approved 24-hour ordering
decision. The policy contract also supports validated weekly same-day periods for a future settings
change. Weekly evaluation uses the configured IANA timezone, including daylight-saving transitions.
Opening is inclusive and closing is exclusive. A configured cutoff rejects orders at or after
`closesAt - cutoffMinutesBeforeClose`.

Pickup bypasses delivery-area validation. Delivery requires a fresh result from the Addresses module
checkout resolver: an unverified address asks the customer to select an address, while an address
outside the current Porto service area offers pickup or another address. Neither browser coordinates
nor a stored historical eligibility flag are authoritative.

## Recoverable stale-cart contract

The validator never silently edits a cart. It returns stable issue codes, localization keys, line/order
scope, and one typed correction:

| Condition                                                 | Correction                                             |
| --------------------------------------------------------- | ------------------------------------------------------ |
| Missing, inactive, ended, unavailable, or zero-stock dish | `remove_line`                                          |
| Quantity above dish or stock limit                        | `set_quantity` with the current maximum                |
| Scheduled dish not started                                | `retry_at` with the exact UTC start                    |
| Lead time changed at checkout                             | `accept_lead_time` with duration and readiness instant |
| Service closed or cutoff passed                           | `retry_when_service_opens`                             |
| Address not verified                                      | `select_delivery_address`                              |
| Outside delivery area                                     | `choose_pickup_or_address`                             |

The result is immutable. UI and API layers localize `messageKey`; they must not expose persistence
details or replace the returned correction with an automatic destructive change.

## Failure and verification

Malformed caller input, service configuration, or authoritative dish projections throw a policy error
instead of being interpreted as unavailable. Unit fixtures cover both invocation stages, exact schedule
boundaries, Lisbon DST-aware hours, cutoff, 24-hour launch behavior, dish and stock limits, maximum
lead-time derivation, delivery-area failures, stale corrections, malformed sources, and immutable
results.
