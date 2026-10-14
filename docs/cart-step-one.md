# Cart step one

SK-0144 implements `/cart` as the first checkout step. The supplied Stitch screen is the visual
source; the production page uses the existing MUI theme, logical CSS, and shared storefront shell so
the same structure works in English, Portuguese, and Persian.

## Authoritative data

`CartProvider` remains the only browser mutation boundary. Quantity changes, removal, clearing, and
notes are optimistic in memory, serialized against the latest cart version, and rolled back to the
server result on failure. The browser never submits prices, availability, customer identity, or guest
identity.

Cart Route Handlers enrich the Carts-owned snapshot with a Dishes-owned public presentation
projection:

- localized dish name and slug;
- current base/effective unit and line prices;
- per-line availability, maximum quantity, and lead time;
- a short-lived URL for the first approved dish image; and
- a `pricingChanged` flag comparing persisted and freshly calculated totals.

The projection omits customer references, guest-token hashes, persistence timestamps, actor metadata,
and raw models. Conflict responses use the same restricted cart fields. GET tolerates recoverable
unavailable dish states so customers can see and remove affected lines; mutations and checkout still
fail closed until availability is valid.

## Page behavior

- Loading uses stable skeleton geometry.
- Empty state links back to the menu.
- A failed initial read retains a retry action.
- Failed mutations show an error and restore authoritative values.
- Stale prices are highlighted while the summary immediately shows current server totals.
- Unavailable lines explain the condition, disable invalid quantity controls, and block progression.
- Clear uses an explicit destructive confirmation.
- Notes are bounded to 1,000 characters and saved explicitly.
- The summary displays integer-cent EUR values through the shared locale formatter.
- Checkout remains disabled until the cart availability projection is valid.

Recommendations load through `/api/cart/recommendations` after the cart itself renders. The endpoint
derives source dish IDs from server cart identity, uses the deterministic SK-0142 loader, excludes
current/unavailable dishes, caps the response at four, and fails open. A recommendation timeout or
failure never blocks the cart.

## Accessibility and responsive behavior

Quantity and removal controls have dish-specific accessible labels, mutation state is announced,
errors use alert semantics, the checkout stepper marks the current step, and the confirmation dialog
manages focus. Mobile uses compact cards and the existing floating navigation; desktop uses a two-column
layout with a sticky summary. Directional layout relies on logical properties and the existing RTL
theme pipeline.
