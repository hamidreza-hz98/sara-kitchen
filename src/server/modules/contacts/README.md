# Contacts

Owns public contact submissions, spam/rate-limit metadata, workflow status, assignment, internal notes, notification handoff, and retention behavior. It has no domain-module dependency and exposes only sanitized administration DTOs.

SK-0132 defines the private `ContactSubmission` schema and public input validation. At least one normalized contact method is required. Public honeypot content is rejected before persistence; stored spam metadata contains only bounded scores, allow-listed signals, provider/check state, and a boolean match flag. Workflow and spam indexes support the management inbox, while `retentionExpiresAt` is enforced by a TTL index according to the documented lifecycle policy.

SK-0133 adds the persistence-first public creation service, HMAC duplicate detection, bounded link-density screening, a PII-free notification event, immutable audit events, and permission-protected administration operations. The public route is same-origin and Mongo-rate-limited. Administration reads hide expired records and always remove the anti-spam fingerprint; workflow changes validate active assignees and use optimistic concurrency; hard deletion is restricted to spam, archived, or retention-expired submissions.

SK-0134 adds the localized responsive management inbox and design-matched detail drawer. URL state preserves search, workflow filters, pagination, and deep-linked selection. Assignment uses a minimal active-admin projection; notes, workflow changes, archive, and delete remain permission/CSRF protected. Messages and notes render only as text, including markup-shaped input.
