# Dish domain rules (SK-0091)

This document is the implementation contract for dishes, catalog reads, carts, checkout, and order
snapshots. The supplied menu, dish-detail, cart, and dish-editor exports are product evidence only.
They show one price per dish, whole-number quantity controls, an `Available Now` switch, and waiting
time in minutes; they do not override the rules below.

## Resolved contract

| Concern          | MVP decision                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sellable unit    | A dish has one configured, indivisible sellable unit. Cart quantity is a positive whole-number count of that unit.                                                                  |
| Portion          | Store a positive integer `portionAmount` and a `portionUnit` of `serving`, `piece`, `gram`, or `millilitre`; render the label through locale messages.                              |
| Price            | `basePriceCents` is the EUR price for exactly one configured sellable unit. Discounts follow ADR-0005 and never change the unit.                                                    |
| Availability     | Commerce availability is `available`, `unavailable`, or `scheduled`, separate from content status.                                                                                  |
| Scheduling       | A scheduled dish uses an inclusive `availableFrom` and exclusive `availableUntil`, entered in Europe/Lisbon time and persisted as UTC instants. Either boundary may be open.        |
| Stock            | Sara Kitchen is made-to-order for MVP. There is no ingredient inventory, stock counter, reservation, or automatic decrement. Manual/scheduled availability is the sell-out control. |
| Tax              | Every MVP dish uses the global `prepared_food` tax category. VAT calculation remains disabled and `taxCents` is zero; the category is not editable per dish.                        |
| Allergens        | `contains` is the union of allergen tags on linked ingredients. A dish may add explicit `mayContain` tags but cannot remove an ingredient-derived tag.                              |
| Dietary claims   | The allow-list is `vegetarian`, `vegan`, and `halal`. Claims are explicit owner-approved facts, not guesses from names or descriptions.                                             |
| Maximum quantity | `maxQuantityPerOrder` is configurable per dish, defaults to 10, and is an integer from 1 through 99.                                                                                |
| Waiting time     | `leadTimeMinutes` is a duration from accepted order time, not a clock time or earliest-order timestamp. It is an integer from 0 through 10,080 minutes.                             |

## Sellable unit and portion

One dish record represents one price and one purchasable package. `portionAmount` describes the
contents of that package; it does not make cart quantity fractional. Examples are one serving, six
pieces, 500 grams, or 1,000 grams. The historical “per kg” soup offering is represented as a dish
whose unit contains `1_000 gram`; the cart still adds one or more whole 1 kg packages.

The storefront displays a locale-aware generated label such as “1 serving” or “1 kg”. Numeric values
and unit enums remain outside `translations`. A genuinely different package size or price is a
separate dish for MVP. Variants, add-ons, half-portions, arbitrary weights, and customer-entered
quantities are out of scope until a variant model is approved.

The server rejects zero, negative, fractional, unsafe, or above-maximum cart quantities. If the same
dish reaches a cart through multiple requests, the limit applies to the combined line quantity.
Clients may disable controls at the bounds, but client controls are not enforcement.

## Publication and availability

Content lifecycle and ordering state are independent:

- `draft` is visible only to authorized dashboard previews and is never orderable;
- `published` may appear publicly and is orderable only when its commerce availability resolves true;
- `archived` is absent from the public catalog and cannot be added to or retained through checkout;
- `available` is immediately orderable;
- `unavailable` may remain visible with a localized unavailable state, but add-to-cart is disabled;
- `scheduled` is orderable only when the current server instant is at or after `availableFrom`, when
  present, and before `availableUntil`, when present.

A scheduled window must contain at least one boundary, and when both exist the end must be later than
the start. Admin input uses the business timezone `Europe/Lisbon`; APIs and MongoDB exchange UTC ISO
instants. Availability boundaries are evaluated on the server. A schedule controls when an order can
be submitted, not a future pickup/delivery slot. Pre-orders and recurring weekday schedules are not
part of MVP.

The catalog may show a published but unavailable dish so customers can discover the menu. Search,
category, featured, related-dish, and discounted sections must expose the resolved availability and
render a disabled order action consistently. Draft and archived dishes never appear in those public
sections.

Cart contents are not reservations. Adding an item does not guarantee its price, discount, schedule,
or availability. The server revalidates the dish and recomputes price and lead time whenever the cart
is read after mutation and again atomically during checkout. An invalid line blocks checkout with a
field-safe explanation; it is never silently removed or repriced without showing the customer.

## Made-to-order stock policy

No `stockQuantity`, ingredient consumption, low-stock threshold, or stock reservation is stored in
the MVP Dish model. `sold` is an analytics counter and must never be treated as inventory. When the
kitchen reaches capacity or an ingredient sells out, an authorized operator changes the dish to
`unavailable` or closes its schedule. That mutation is audited and invalidates catalog caches.

If quantitative inventory is added later, it requires a separate reservation/expiry design tied to
idempotent checkout and payment state. A bare counter decrement is not an acceptable extension.

## Tax and monetary behavior

All dishes inherit the system tax category `prepared_food`. It is recorded in immutable order/invoice
tax-policy snapshots even though the MVP tax amount is zero. There is no per-dish tax selector because
the current catalog has no second approved tax treatment. Before real production payments, Portuguese
tax and invoice requirements remain a launch review gate.

`basePriceCents`, discount computation, line rounding, currency, delivery threshold behavior, and
historical snapshots follow [ADR-0005](./adr/0005-integer-money.md). The server is authoritative; the
client never submits trusted totals.

## Allergens and dietary claims

The Ingredient module's supported allergen tags are the source of truth for definite containment. A
dish's effective allergen set is:

`contains = unique(sorted(linkedIngredient.allergenTags))`

The dish may separately store `mayContainAllergenTags` from the same allow-list for cross-contact
warnings. Public allergen display and exclusion filters use the union of `contains` and `mayContain`,
while preserving the distinction in labels and API output. An admin cannot suppress a linked
ingredient's allergen. Ingredient/allergen changes must invalidate affected dish/catalog caches; any
denormalized effective set is derived data and must not become an independent editing surface.

Dietary claims use the fixed `vegetarian`, `vegan`, and `halal` allow-list. They require explicit human
confirmation during publishing. `vegan` implies `vegetarian`; saving vegan without vegetarian adds the
implied `vegetarian` value during shared input normalization and returns the canonical tag set.
The system does not infer halal, vegan, or vegetarian status from prose, dish name, AI output, or the
absence of known allergens. “Gluten-free”, “dairy-free”, and “nut-free” are allergen-query results,
not dietary claims. Spice level and other characteristics belong to translated specifications, not
the dietary allow-list.

Allergen and dietary information is advisory product data owned by the super admin. The storefront
must show a localized cross-contact disclaimer and a contact path; it must not promise a medically
safe kitchen environment.

## Lead time and order readiness

`leadTimeMinutes` is the kitchen preparation duration for a currently accepted order. Zero means no
additional preparation lead time; it does not bypass normal checkout or fulfillment rules. Values
above seven days are rejected for MVP. The editor may present convenient hour/day input, but the API
and persistence unit is always integer minutes.

At authoritative order creation:

1. revalidate each dish and snapshot its `leadTimeMinutes`;
2. calculate `orderLeadTimeMinutes = max(line lead times)`, never the sum;
3. calculate `earliestReadyAt = acceptedAt + orderLeadTimeMinutes`;
4. retain the duration and resulting instant in the immutable order snapshot.

The maximum is independent of quantity for MVP because the configured per-dish maximum is the
kitchen-approved capacity assumption. Pickup and delivery use the same kitchen-ready instant.
Delivery travel/dispatch time, if later displayed, is a separate estimate and must not be folded into
the dish's preparation duration.

## Publication requirements

A dish may be saved as a draft with incomplete optional content. Publishing requires all of the
following in addition to shared translation rules:

- complete required translations for every enabled storefront locale;
- a valid unique slug, category, at least one ready image, and at least one linked active ingredient;
- valid base price, discount, portion, maximum quantity, lead time, and availability configuration;
- reviewed allergen data for every linked ingredient plus explicit review of dietary claims;
- no archived category, ingredient, media, related dish, or related blog dependency;
- SEO synchronization and the normal authorization, audit, and cache-invalidating mutation path.

## Required boundary tests

Schema/service/catalog/cart tests must cover:

- each portion unit, invalid/fractional quantities, and combined-line maximum enforcement;
- draft/published/archived visibility and all availability modes at exact start/end instants;
- Europe/Lisbon daylight-saving conversion with UTC persistence;
- cart-to-checkout availability or price changes without silent mutation;
- ingredient-derived allergens, `mayContain`, duplicate removal, and attempted suppression;
- dietary allow-list, vegan implication, and explicit-approval publication failure;
- maximum quantities 1, 10, 99 and rejection of 0/100;
- lead times 0 and 10,080, rejection above the limit, maximum-across-lines calculation, and immutable
  order snapshots;
- zero-tax prepared-food snapshots and existing integer-money discount boundaries.

These decisions replace ambiguous UI labels such as “In Stock” with the resolved made-to-order
availability contract. Changing portion variants, quantitative inventory, recurring availability,
pre-orders, dietary certification, or tax treatment requires a new product decision before changing
the schema.
