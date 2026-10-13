# Global cart state adapter

SK-0143 adds one storefront-wide client adapter over the server-owned cart. `CartProvider` wraps the
public storefront shell, and `useCart()` is the only UI integration point for the header badge, dish
actions, and the three cart steps. It exposes the sanitized cart, total item quantity, load/error state,
pending dish IDs, refresh, add, update, and remove operations. It never stores a cart ID, guest token,
customer ID, prices, or cart contents in browser storage.

## Authority and optimistic projection

The last successful response is the authoritative base. A user action adds a small in-memory intent and
immediately projects its quantity effect over that base, making the count badge and every mounted consumer
responsive in the same render. Intents are sent sequentially with the latest authoritative cart version.
Each response replaces the base, and any later pending intents are projected again over that response.
This prevents rapid actions from sending the same stale version or letting one page overwrite another.

The client never calculates authoritative prices, discounts, availability, delivery, tax, or lead time.
While an intent is pending, monetary fields remain the last server values and `pendingDishIds` lets the UI
show a pending affordance. The response replaces all server-owned fields.

On an ordinary failure, only the rejected intent is removed, revealing the prior authoritative state plus
any later queued work. A conflict carrying `details.current` adopts that server winner before rebasing the
queue. Safe error codes are exposed for localized presentation, while server error prose and internals are
not trusted as UI content.

## HTTP contract

The default transport uses same-origin, no-store requests and accepts only the sanitized cart projection:

- `GET /api/cart` refreshes or returns `null`;
- `POST /api/cart/items` adds a dish with quantity and the observed version (or `null` for no cart);
- `PATCH /api/cart/items/:dishId` replaces quantity with the observed version;
- `DELETE /api/cart/items/:dishId` removes the line with the observed version.

The adapter also accepts an injected transport for deterministic tests and alternate server boundaries.
Every decoded result is shape-checked before entering React state; customer IDs and guest credentials are
not part of the client contract.

Thin Route Handlers implement this contract over the SK-0140 CRUD service. Reads do not create a cart or
guest credential. The first guest add generates a 256-bit opaque HTTP-only SameSite cookie, hashes it before
the repository boundary, and returns the cookie even when authoritative dish validation rejects the add so
the lazily created empty cart is not orphaned. Authenticated identity is resolved only from the customer
session cookie. Mutations enforce same-origin policy and Zod input limits; prices and identity claims are not
accepted from the browser. The Dishes module supplies a dedicated public pricing/availability projection, so
Carts and Route Handlers never access its model.

## Tabs, focus, and authentication

Successful mutations write only a random invalidation nonce under `sara-cart-invalidation`. Other tabs
respond to the storage event by fetching the server cart; no cart payload crosses tabs. A focused window
also refreshes to cover suspended tabs and authenticated multi-device changes.

Customer authentication broadcasts the existing `sara-customer-auth-change` invalidation after the server
login/merge boundary finishes. The cart provider increments its identity epoch, aborts in-flight guest-era
requests, rejects queued guest intents with `identity_changed`, clears the projected state, and fetches the
authoritative customer cart. Logout follows the same invalidation path and therefore never copies a
customer cart into guest state.

## Verification

Component tests mount header-, dish-, and cart-style consumers beneath one provider and cover optimistic
add, update rollback, sequential add/remove version rebasing, conflict adoption, cross-tab refresh, normal
authentication refresh, and cancellation of an in-flight guest mutation in favor of the merged customer
cart. Transport tests cover endpoint/version payloads, safe projection decoding, conflict snapshots, and
malformed response rejection.
