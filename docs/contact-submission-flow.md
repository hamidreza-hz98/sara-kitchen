# Contact submission flow

SK-0133 implements a persistence-first public inbox and permission-protected administration flow.

## Public contract

`POST /api/contact-submissions` accepts JSON only from a same-origin browser request. Input is strict, requires the accepted privacy-policy version and at least one normalized contact method, and includes an empty `company` honeypot. Unknown fields and a populated honeypot are rejected. Source metadata is limited to an allow-listed page path, campaign label, referrer hostname, request ID, and a keyed fingerprint; raw client IP addresses are not stored.

The endpoint permits five requests per trusted client address in a ten-minute fixed window. The rate-limit key and duplicate fingerprint are HMAC-SHA-256 values derived from the server session secret. A matching fingerprint in the preceding hour or four-or-more links marks a submission as suspected spam. Suspected spam remains available for review but does not notify staff.

The database insert and audit event occur before notification. The notification contract contains only the record ID, locale, workflow status, and dashboard path—never the message or contact details. The current adapter writes a structured operational event and is intentionally replaceable by a WhatsApp/email provider. Provider failure is redacted, does not roll back the stored submission, and does not change the generic `202 { accepted: true }` response.

## Administration contract

- `GET /api/contacts` lists non-expired submissions with bounded pagination, escaped search, status/assignee filters, and stable newest/oldest sorting.
- `GET /api/contacts/:contactId` reads one non-expired submission.
- `PATCH /api/contacts/:contactId` changes workflow status, assignment, and/or appends an immutable internal note.
- `POST /api/contacts/:contactId/archive` archives a submission and starts its archive retention period.
- `DELETE /api/contacts/:contactId` permanently deletes only archived, spam, or retention-expired records.

Every operation re-resolves the active administrator session. Reads require `contacts:read`, workflow changes require `contacts:update`, and hard deletion requires `contacts:delete`. Browser mutations additionally require same-origin and session-bound CSRF proof. Assignees must be active administrators. Sensitive fields are projected only for `contacts:read-sensitive`, and the anti-spam fingerprint is never returned.

## Retention and failure behavior

List/detail reads hide records whose retention deadline has passed even before MongoDB's TTL monitor physically removes them. Retention deadlines are recalculated when workflow status changes. Optimistic document versions reject concurrent edits, all representative success/failure/denied actions use the immutable audit service, and audit/notification context excludes message bodies, credentials, and contact identifiers.

The acceptance tests cover honeypot rejection, duplicate-spam suppression, permission and retention enforcement, source-fingerprint redaction, and persistence surviving notification failure.
