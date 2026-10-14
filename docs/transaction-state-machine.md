# Transaction state machine (SK-0148)

The Transactions module owns the provider-neutral state machine. A provider adapter must authenticate its callback first, map its documented external event to a normalized event, then call `planTransactionTransition`. The MB Way **sandbox fixture vocabulary** below is for local tests only; it is not a claim about any acquirer's production API. Selecting an acquirer requires a separate adapter and verified mapping.

| Current state                                | Allowed next states                                               |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `created`                                    | `pending`, `authorized`, `paid`, `failed`, `cancelled`, `expired` |
| `pending`                                    | `authorized`, `paid`, `failed`, `cancelled`, `expired`            |
| `authorized`                                 | `paid`, `failed`, `cancelled`, `expired`                          |
| `paid`                                       | `partially-refunded`, `refunded`                                  |
| `partially-refunded`                         | `partially-refunded`, `refunded`                                  |
| `failed`, `cancelled`, `expired`, `refunded` | terminal; a new attempt needs a new Transaction                   |

`created` is a system event. Pending/failed/cancelled/expired carry no amount. Authorization and capture events carry the full requested cents; MB Way can capture directly without an authorization event. Refund events carry a positive delta, not a cumulative total. Replaying all events must reproduce both the stored status and monetary snapshots. A partial refund stays partial until cumulative refunds equal the captured amount, when it becomes `refunded`. Over-refunds and refunding before capture fail. The zero-cents case may reach `paid` without a provider charge; refunds still require a positive captured balance.

| Internal normalized event | MB Way sandbox fixture code | Result                                                  |
| ------------------------- | --------------------------- | ------------------------------------------------------- |
| `payment.pending`         | `PENDING`                   | `pending`                                               |
| `payment.authorized`      | `AUTHORIZED`                | `authorized`                                            |
| `payment.captured`        | `PAID`                      | `paid`                                                  |
| `payment.failed`          | `FAILED`                    | `failed`                                                |
| `payment.cancelled`       | `CANCELLED`                 | `cancelled`                                             |
| `payment.expired`         | `EXPIRED`                   | `expired`                                               |
| `payment.refunded`        | `REFUNDED`                  | `partially-refunded` or `refunded` by remaining balance |

Every event has a unique local key, and a provider event ID cannot repeat on the same transaction. A duplicate callback, same-state retry, regression, or event arriving after a terminal state is rejected. The provider integration may acknowledge a verified duplicate at its HTTP boundary without writing it again; unknown/ambiguous outcomes require reconciliation, not an invented success or destructive reversal. Never permit a late failed event to undo a captured payment. Financial event persistence belongs in the Orders-owned database transaction with optimistic concurrency and provider-event idempotency; do not make external provider calls inside the MongoDB transaction (ADR 0008).

The Mongoose model replays history on validation **and save**, including when ordinary save validation is skipped. This prevents direct model writes from bypassing the policy, though raw MongoDB collection writes can bypass Mongoose hooks and remain forbidden outside trusted migration tooling. Tests cover all launch-state paths, duplicate identities, out-of-order callbacks, refund totals, and persisted model rejection.
