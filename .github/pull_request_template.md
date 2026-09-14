# Summary

<!-- Explain what changed and why. Keep this focused on one coherent task. -->

- Task: SK-
- User-visible effect:
- Risk and rollback notes:

# Evidence

<!-- Link test output, screenshots, recordings, logs, or review notes. Never include secrets or customer data. -->

# Definition of done

Every item must be checked. When an item genuinely does not apply, check its N/A item and add a
specific reason under **N/A reasons**. See
[`docs/definition-of-done.md`](../docs/definition-of-done.md) for the evidence required by each gate.

## Core verification

- [ ] The change is scoped to the referenced task and contains no unrelated files or secrets.
- [ ] `pnpm verify` passes on the final diff.
- [ ] Tests cover the changed behavior at the appropriate unit, component, integration, contract, or end-to-end level; bug fixes include a regression test.
- [ ] N/A — no executable behavior changed; reason recorded below.

## Translations

- [ ] New or changed user-facing text and localized content contracts cover English (`en`), Portuguese (`pt`), and Farsi (`fa`), including RTL behavior where relevant.
- [ ] N/A — the change has no user-facing or translatable content; reason recorded below.

## Authorization and privacy

- [ ] Protected behavior enforces authorization on the server and tests both permitted and denied access, including admin/customer audience separation where relevant.
- [ ] The change exposes no secret or unnecessary personal, session, payment, or operational data.
- [ ] N/A — the change cannot read, create, update, delete, or disclose protected data or actions; reason recorded below.

## Activity logging

- [ ] Auditable actions emit structured English activity records with the actor, action, target, result, and safe request context; sensitive values are excluded.
- [ ] N/A — the change introduces no auditable authentication, administration, customer-data, order, payment, media, or settings action; reason recorded below.

## Validation and failure handling

- [ ] Every changed trust boundary validates untrusted input on the server, returns safe actionable errors, and covers invalid and failure paths with tests.
- [ ] N/A — the change introduces or changes no input, persistence, upload, environment, webhook, or external-service boundary; reason recorded below.

## Accessibility

- [ ] Affected interfaces pass automated accessibility checks and manual keyboard, focus, label, semantic, and contrast review against the project's WCAG 2.2 AA target.
- [ ] N/A — the rendered or interactive interface is unchanged; reason recorded below.

## Responsive and localized layout

- [ ] Affected interfaces were checked at the required phone, tablet, desktop, and wide-desktop viewports in both LTR and RTL when layout can differ, with no unintended overflow or obstruction.
- [ ] N/A — layout and visual behavior are unchanged; reason recorded below.

## Documentation and operations

- [ ] Relevant architecture, setup, API, data, migration, operations, and user documentation is updated in the same change.
- [ ] N/A — the implemented contract and its operation remain accurately documented; reason recorded below.

## Security findings

- [ ] Applicable dependency (`pnpm security:audit` when dependencies change), static-analysis, secret, and manual threat-review checks found no new unresolved Critical-severity security findings.
- [ ] N/A — the change has no dependency, authentication, authorization, upload, payment, webhook, infrastructure, deployment, or other security-relevant effect; reason recorded below.

# N/A reasons

<!-- Name each N/A gate and explain why it does not apply. Delete this prompt when no N/A items are used. -->

- None.

# Reviewer and release notes

- [ ] The final diff and verification evidence were reviewed.
- [ ] Migration, rollback, monitoring, and deployment notes are complete when production state can change.
- [ ] Production deployment remains separately approved by the project owner.
