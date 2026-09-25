# Terms and policy settings

Legal/policy content is stored as immutable version records rather than overwriting the generic `terms` singleton. The generic settings registry still defines the administration surface, while `policy_versions` preserves every released document required by historical account and order evidence.

## Policy versions

Supported document types are:

- terms of service;
- privacy policy;
- marketing consent;
- delivery policy;
- refund policy.

Each record owns a positive version number, effective date, ordered stable section IDs, translated title/summary/sections, publication state, author, publication/retirement times, and a SHA-256 content digest. The unique `(documentType, version)` index prevents ambiguous versions.

Policy sections use the same strict versioned rich-text policy as Blog and About content. Canonical English must contain every configured section; Portuguese and Persian may be partial and use canonical fallback when rendered. Raw HTML, unsafe links/nodes, malformed media, and content outside the rich-text bounds are rejected.

## Lifecycle

States move only forward:

1. `draft` — editable and not acceptable by a customer;
2. `scheduled` — released with a digest but future-effective;
3. `published` — effective and eligible for new consent;
4. `retired` — historical only; remains permanently readable for evidence.

`releasePolicyVersion` runs in a MongoDB transaction. A future-effective draft becomes scheduled. Activating an effective version retires the currently published version of the same document type in the same transaction. Released content, version identity, author, effective/publication time, and digest are immutable. Query updates, replacement, deletion, and bulk mutation are blocked so lifecycle rules cannot be bypassed.

The digest covers the exact document type, version, ISO effective time, ordered section IDs, and translated content. Any content change produces a different digest.

## Consent receipts

`policy_consents` is an append-only, non-expiring evidence collection. A receipt records:

- `account` or `order` subject and its opaque ObjectId;
- optional customer reference for order evidence;
- exact policy-version reference;
- snapshot of document type, version, effective date, and content digest;
- accepted locale/time, source (`signup`, `checkout`, `account-update`, or controlled historical import), and optional request ID.

Account consent requires the subject and customer IDs to match. New consent is accepted only for an effective published policy. A controlled admin import may reconstruct evidence for a retired policy only when the historical acceptance occurred before retirement. Duplicate delivery of the same subject/version is idempotent through a unique index.

Receipts cannot be updated, replaced, or deleted and have no TTL. Direct model access is private; account creation and checkout orchestration must call `recordPolicyConsent` with the policy version actually shown to the customer.

## Historical trace

`getPolicyConsentTrace` returns a subject's chronological receipts and joins each to its retained policy. It compares the receipt snapshot with the immutable source and reports:

- `matched` — the retained policy identity/effective time/digest agrees;
- `snapshot-mismatch` — evidence indicates unexpected mutation or corruption;
- `missing-policy` — the referenced historical policy is unavailable and requires investigation.

Because the receipt includes an independent snapshot, old account and order acceptance remains attributable to an exact version even as newer versions publish. The retained version provides the complete translated document that was accepted.
