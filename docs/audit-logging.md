# Audit-log schema and retention

Sara Kitchen's audit log is a security and accountability record, not an application debug stream or
a copy of business data. Events use bounded English action codes and messages so operators can search
one stable vocabulary regardless of the actor's selected locale. Display snapshots may preserve a
Unicode name or label when needed to understand a historical event.

## Record contract

Each `audit_logs` document contains:

| Field        | Contract                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actionCode` | Lowercase dotted code such as `auth.admin.login`; stable and suitable for alert rules                                                                          |
| `message`    | Printable English summary, maximum 240 characters; never interpolates secrets or submitted message bodies                                                      |
| `actor`      | `admin`, `customer`, `system`, or `anonymous`; admin/customer requires an ObjectId reference; system/anonymous forbids one; bounded display-name/role snapshot |
| `resource`   | Domain kind, optional opaque reference, and bounded code/label/status snapshot; never a live foreign-model dependency                                          |
| `outcome`    | `success`, `failure`, or `denied`                                                                                                                              |
| `severity`   | `info`, `warning`, `error`, or `critical`                                                                                                                      |
| `type`       | `authentication`, `authorization`, `data`, `business`, `security`, or `system`                                                                                 |
| `requestId`  | Required correlation ID; it groups events without storing a session bearer                                                                                     |
| `context`    | At most 20 flat scalar values and 4 KiB of JSON; prohibited keys and secret-like values fail validation                                                        |
| `network`    | Explicit `hashed`, `retained`, or `omitted` policy with mutually exclusive hash/raw fields                                                                     |
| `userAgent`  | Optional control-character-free string, maximum 512 characters                                                                                                 |
| `occurredAt` | UTC event time; may not be more than five minutes in the future                                                                                                |
| `createdAt`  | Database ingestion time from the common schema convention                                                                                                      |
| `expiresAt`  | Hidden timestamp fixed to `occurredAt + 365 days` and used only for TTL retention                                                                              |

`schemaVersion` begins at 1. The module deliberately has no soft-delete state: deletion is retention,
not a user action. Base `updatedAt`, `createdBy`, and `updatedBy` remain part of the repository-wide
schema convention, but an audit event cannot be saved again after insertion and actor attribution
lives in the explicit immutable `actor` snapshot.

## Privacy and sanitization

Context keys reject password, passphrase, token, secret, authorization, cookie, credential, API-key,
signature, session, payment-card, message/body/content, address, email, and phone/mobile concepts.
Values are scalar only, bounded, and reject bearer/JWT-like credentials, Argon2 hashes, credentialed
MongoDB URIs, private-key blocks, and payment-card-like digit sequences. Nested provider payloads,
request/response bodies, contact messages, rich-text content, dish descriptions, addresses, and
transaction payloads belong in their owning system—not in the log.

The default network policy is `hashed`. `hashAuditIpAddress()` uses HMAC-SHA256 with an explicit domain
separator and at least 32 bytes of secret material, preventing simple rainbow-table recovery while
allowing short-term abuse correlation. The creation service will use the server-only session secret
unless a dedicated audit key is introduced; rotating that key intentionally breaks correlation across
the boundary. Raw IP retention is supported only when a documented security/legal need selects
`retained`; ordinary model queries and JSON hide both raw IP and hashes. `omitted` stores neither.

Snapshot fields are historical evidence and may contain limited personal data such as a display name.
They must use only the minimum label needed to interpret the event. Email, mobile, delivery address,
full contact text, and payment details are not snapshot fields.

## Append-only enforcement

All event fields are immutable. Document re-save plus Mongoose update, replace, delete, find-and-modify,
and bulk-write paths throw `Audit records are append-only.` The future repository may expose insert and
authorized read methods only. Other modules consume the Logs public service and may not import its
model or collection.

Mongoose middleware cannot constrain a database administrator or code that deliberately calls the raw
MongoDB collection. Production operational access must therefore restrict direct writes, and raw
collection access is forbidden in application code. For stronger tamper evidence at launch scale,
export events to an access-controlled append-only observability archive and audit every log read. TTL
deletion by MongoDB is the one intentional mutation path.

## Retention and indexes

Operational audit events remain in the primary database for 365 days. A single-field `expiresAt` TTL
index performs eventual deletion; expiry is not an exact scheduling guarantee. Backups, exports, and
observability copies must enforce the same disposal deadline unless a documented legal hold requires
an isolated encrypted copy. Review the period with Portuguese privacy/accounting counsel before launch;
invoice/order statutory records are separate business records and are not replaced by audit logs.

Timeline, actor, resource, action/outcome, and request-ID indexes support the dashboard and incident
queries without importing another module's model. The TTL index supports disposal. Index use and volume
must be reviewed after real traffic because audit collections are write-heavy.

## Verification

Unit tests cover admin/customer/system-compatible structure, English message constraints, actor/network
coherence, bounded context, forbidden keys and secret-like values, keyed IP hashing, hidden fields, and
indexes. MongoDB integration tests persist both admin and customer events and prove document, query,
delete, and bulk mutations fail while the retention index remains present.

This design follows OWASP's direction to remove, mask, sanitize, hash, or encrypt session identifiers,
tokens, passwords, connection strings, encryption keys, and sensitive personal data rather than logging
them directly. MongoDB TTL cleanup is asynchronous, so application authorization must not treat an
expiry timestamp as proof that a record has already been physically deleted.
