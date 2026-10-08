# Contacts

Owns public contact submissions, spam/rate-limit metadata, workflow status, assignment, internal notes, notification handoff, and retention behavior. It has no domain-module dependency and exposes only sanitized administration DTOs.

SK-0132 defines the private `ContactSubmission` schema and public input validation. At least one normalized contact method is required. Public honeypot content is rejected before persistence; stored spam metadata contains only bounded scores, allow-listed signals, provider/check state, and a boolean match flag. Workflow and spam indexes support the management inbox, while `retentionExpiresAt` is enforced by a TTL index according to the documented lifecycle policy.
