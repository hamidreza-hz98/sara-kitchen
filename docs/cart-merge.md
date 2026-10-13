# Guest-to-customer cart merge

## Login orchestration

After customer authentication succeeds, the login orchestrator hashes the valid guest-cart cookie and
calls `createCartMergeService`. Authentication does not fail if merge fails. The cookie is cleared only
after a successful or idempotently replayed merge; failure preserves it for a later retry. No raw guest
token enters this module, persistence, logs, notices, or response data.

The merge repository owns one MongoDB replica-set transaction. It loads the guest cart by digest and the
customer's active cart, creating the customer cart transactionally when absent. Dish projections,
settings policy, and selected-address delivery eligibility are loaded through session-aware public ports
inside the callback. Customer update and the guest `merged` terminal transition commit together.

## Deterministic merge rules

| Concern                             | Rule                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Line order                          | Existing customer order is preserved; new guest-only dishes follow in guest order.                                   |
| Duplicate dish                      | Quantities are summed, then capped by the current dish maximum, optional stock, and global limit.                    |
| Quantity cap                        | The capped quantity is retained and a `quantity_capped` notice includes requested/current values.                    |
| Guest-only unavailable/missing item | The item is skipped with `unavailable_item_skipped`, dish ID, requested quantity, and reason.                        |
| Invalid existing customer item      | Merge aborts with the full SK-0139 availability result; neither cart changes.                                        |
| Customer notes present              | Preserve trimmed customer notes; differing guest notes produce `guest_notes_ignored`.                                |
| Customer notes empty                | Copy trimmed guest notes.                                                                                            |
| Selected address                    | Preserve only the customer cart address. Guest carts cannot own an address. Current ownership/area is rechecked.     |
| Pricing                             | Recalculate the accepted lines, selected fulfillment, discounts, delivery, tax, and adjustments from server sources. |

The final accepted line set is run through availability again after skips/caps. Service closure, cutoff,
or invalid delivery blocks the merge instead of terminalizing the guest cart. Review notices are bounded
structured data and never silently hide a customer decision.

## Atomicity, conflicts, and idempotency

The transaction updates an existing customer cart with optimistic concurrency and increments its business
version once. A newly created customer cart begins at version one. It then marks the guest cart `merged`,
stores `mergedIntoCartId`, increments its version, and assigns the 30-day terminal purge timestamp.

If any validation, pricing, unique-index, version, or transaction step fails, MongoDB rolls back both
documents. A concurrent customer mutation becomes an explicit merge conflict; the service never retries a
business decision outside the transaction or partially imports lines.

After commit, repeating the same guest credential finds the guest's durable `mergedIntoCartId`, verifies
that it belongs to the authenticated customer, and returns that cart with current authoritative totals and
an `already_merged` notice. It does not execute line combination again. Concurrent identical login retries
therefore produce one actual merge and one idempotent replay.

## Response and audit

The response contains the customer cart, pricing, availability/lead time, merge notices, the non-secret
guest cart record ID, and an `idempotent` flag. The audit event contains customer/cart references and replay
or conflict state only. It never includes the guest digest, cart lines, quantities, notes, address, or
prices.

## Verification

Unit tests cover summed duplicates, maximum caps, unavailable guest items, customer-invalid abort,
customer-first notes, guest-note fallback, address preservation, authoritative totals, replay, repository
error mapping, and audit privacy. A real MongoDB replica-set test launches two concurrent merge calls and
proves one transaction merges, the replay is idempotent, quantities are not doubled, customer preferences
survive, and the guest receives a terminal merge marker.
