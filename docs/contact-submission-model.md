# Contact submission model

SK-0132 defines the private `ContactSubmission` persistence contract for the public contact form and management inbox.

## Submission data

- `fullName` is normalized Unicode text.
- `mobile` and `email` are nullable and normalized when supplied; at least one is required so the kitchen can respond.
- `message` is trimmed and limited to 10–4,000 characters.
- `locale` is one of the enabled launch locales (`en`, `pt-PT`, or `fa`).
- `status` follows `new → in_progress → resolved/archived`, with `spam` available for quarantined submissions.
- `assigneeAdminId` is an optional Admin reference.
- `internalNotes` are timestamped, attributed admin-only notes capped at 100 entries and 2,000 characters each. They must never appear in public responses.

Source metadata is bounded and contains only channel, page path, referrer host, campaign, request ID, and a one-way fingerprint hash. It intentionally excludes raw IP addresses, full referrer URLs, message headers, and arbitrary provider payloads.

Consent stores an affirmative privacy choice, the accepted policy version, acceptance time, and a separate optional marketing choice. This supports later consent evidence without conflating a contact request with marketing permission.

## Spam policy

The public input includes an empty `company` honeypot. A populated value fails validation and is never persisted as content. Persistence stores an allow-listed disposition/provider/signals set, integer score from 0–100, check timestamp, and honeypot-match boolean. Completed checks require provider and timestamp; pending checks cannot claim provider results; a honeypot match must include the corresponding signal.

Rate limiting remains a request/service concern for the later contact submission flow. Raw anti-spam tokens and provider responses must not be stored.

## Retention and indexes

`retentionExpiresAt` has an absolute MongoDB TTL index. Services must recalculate it from the lifecycle transition date using these policy periods:

- new or in progress: 730 days;
- resolved: 730 days;
- spam: 90 days;
- archived: 365 days.

MongoDB removes expired records asynchronously, so operational code must treat `retentionExpiresAt <= now` as unavailable even before the TTL monitor runs. Status/created-time, assignee/workflow, normalized search, and spam-review indexes support inbox queries without collection scans.
