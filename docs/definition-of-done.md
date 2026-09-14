# Definition of done

This is the completion contract for every Sara Kitchen task. A change is done only when every
applicable gate below has evidence and the pull-request checklist is complete. This contract applies
even while development is committed directly to `master`; the pull-request template is the reusable
review record for future GitHub review and production changes.

An item may be marked not applicable only when its N/A checkbox is checked and the author records a
specific reason. “Not enough time,” “will do later,” and an unchecked box are not N/A evidence.

## 1. Scope and baseline quality

- The change matches one referenced task and preserves unrelated user work.
- The final diff contains no credentials, personal data, debug artifacts, generated build output, or
  accidental files.
- `pnpm verify` passes on the final diff: formatting, lint, strict types, deterministic tests,
  architectural checks, and production build.
- Warnings introduced by the change are resolved rather than hidden.

## 2. Tests

- Changed domain rules have focused unit tests.
- Changed components have interaction tests where browser layout is not required.
- Persistence, Route Handler, webhook, and provider boundaries have integration or contract tests.
- Changed critical journeys—authentication, ordering, payment, and administration—have focused
  Playwright coverage.
- Every bug fix first demonstrates the failure and retains a regression test.
- Tests include success, invalid-input, denied-access, and dependency-failure paths when those paths
  exist. Tests are deterministic and never contact production services.

Pure documentation or metadata changes may mark executable-behavior tests N/A, but `pnpm verify`
still runs.

## 3. Translations

- User-facing application text is sourced through the localization system rather than hard-coded in
  a component.
- English (`en`), Portuguese (`pt`), and Farsi (`fa`) messages are added or updated together.
- Localized entity contracts follow the accepted embedded-translation ADR, including English source
  and fallback behavior.
- Farsi changes are reviewed in RTL; locale-sensitive dates, numbers, currency, validation messages,
  metadata, and empty/error states are included.

This gate is N/A only when no user-facing or translatable content or contract changes.

## 4. Authorization and privacy

- Authorization is enforced server-side at the service/policy boundary; hidden buttons and client
  checks are user experience controls, not security controls.
- Tests prove both allowed and denied access for every changed protected action.
- Admin and customer identities, sessions, and permissions cannot cross audiences.
- Queries and responses expose only the records and fields the principal may access.
- Secrets, session tokens, passwords, reset tokens, payment data, and unnecessary personal data do
  not appear in responses, URLs, logs, analytics, screenshots, fixtures, or errors.

This gate is N/A only when the change cannot affect protected data, identity, or actions.

## 5. Activity logging

Authentication events and mutations to administration, customer data, orders, payments, media,
content, and settings are auditable. Required activity records:

- are written in English with stable machine-readable action and result values;
- identify the actor type/id, target type/id, timestamp, outcome, and safe correlation/request
  context;
- are emitted through the logs module rather than direct cross-module persistence access;
- never contain credentials, raw tokens, payment secrets, rich-text bodies, or unnecessary personal
  data; and
- cover failed security-sensitive actions when recording them does not create a new disclosure risk.

Logging failure behavior is explicitly decided and tested for high-value operations. This gate is N/A
only when no auditable action is introduced or changed.

## 6. Validation and failure handling

- Zod validates untrusted values at every changed server trust boundary before business logic or
  persistence. Client validation may improve feedback but cannot replace server validation.
- Database identifiers, pagination, money, locales, files, environment values, webhooks, and provider
  responses use bounded domain-specific schemas when affected.
- Upload checks include size, allowlisted type, detected content, filename/key safety, and processing
  failure behavior when applicable.
- Errors are safe for the caller, actionable for operators, localized for users, and do not leak
  internals.
- Invalid, partial, duplicate, timeout, retry, and dependency-failure behavior is tested where the
  boundary permits those states.

This gate is N/A only when no input, persistence, upload, environment, or external-service contract
changes.

## 7. Accessibility

The project target is WCAG 2.2 Level AA. For every affected interface:

- run the relevant automated axe/Playwright or component accessibility check;
- complete the flow using a keyboard, with visible focus and logical focus order;
- verify semantic structure, accessible names, labels, errors, status announcements, and modal focus;
- verify text and meaningful controls meet target contrast and do not rely on color alone; and
- verify zoom/reflow, reduced motion, touch target behavior, and image alternatives when affected.

Automation does not replace manual review. This gate is N/A only when rendered and interactive output
does not change.

## 8. Responsive and localized layout

Affected screens are checked at least at these CSS viewport sizes:

| Class        | Viewport     |
| ------------ | ------------ |
| Phone        | `360 × 800`  |
| Tablet       | `768 × 1024` |
| Desktop      | `1280 × 800` |
| Wide desktop | `1536 × 864` |

Check LTR and RTL whenever direction can change the result. Content must remain readable and
operable with no unintended horizontal overflow, clipping, overlap, inaccessible controls, or
obscured focus. Also check realistic long translations, empty states, errors, and loading states.

This gate is N/A only when layout and visual behavior do not change.

## 9. Documentation and operations

Update the durable record in the same change whenever its implemented truth changes. This includes:

- README/setup commands, environment variables, dependency purposes, and local infrastructure;
- architecture, ADRs, module/API contracts, permissions, data models, and translation behavior;
- migrations, indexes, seed behavior, backup/restore, rollback, monitoring, and deployment runbooks;
  and
- administrator or content-entry guidance for changed workflows.

The master desktop task list records the decision, implementation, verification, and commit. This
gate is N/A only when existing documentation remains complete and accurate.

## 10. Security findings

Choose checks based on the affected attack surface and record the tool/version, scope, and result.
Applicable evidence includes:

- `pnpm security:audit` when production dependencies or the lockfile change;
- static analysis and secret scanning when source, configuration, infrastructure, or workflows
  change;
- a focused manual threat review for authentication, authorization, sessions, uploads, rich text,
  payments, webhooks, personal data, deployment, and new external integrations; and
- provider or container scanning before a production infrastructure release.

The change may introduce no unresolved Critical-severity finding from an applicable check. A Critical
finding blocks completion and release until fixed; it cannot be dismissed through the N/A mechanism.
Lower-severity findings introduced or materially affected by the change must be fixed or recorded
with owner, rationale, mitigation, and a follow-up task. Security checks never authorize uploading
project code or secrets to an unapproved service.

This gate is N/A only when the change has no meaningful security-relevant effect and the reason is
recorded.

## 11. Review and release evidence

The change description identifies the task, user-visible effect, risk, verification evidence, and
rollback notes. Screenshots or recordings accompany visual changes without exposing real customer
data. Database or deployment changes include migration, rollback, monitoring, and recovery notes.

Completing this definition does not authorize production deployment. The separate approval rules in
`CONTRIBUTING.md` still apply.
