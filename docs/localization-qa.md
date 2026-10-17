# SK-0185 localization QA

Audit date: 2026-10-17. Launch locales: English (`en`), European Portuguese (`pt-PT`), and Persian (`fa`). This is a technical QA and content-owner review packet, not copy approval.

| Area                                    | Evidence                                                                                                                                                                                                                                 | Status                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Catalog completeness                    | `pnpm test:locales` checks all seven namespaces and key parity. Each locale currently has 2,158 message leaves after obsolete keys were removed.                                                                                         | Automated pass.                                                      |
| ICU, interpolation, pluralization       | The locale validator renders every message with sample values at counts 0, 1, 2, and 5, reporting malformed ICU, missing plural fallbacks, and placeholder differences. Regression tests inject broken ICU and missing `other` branches. | Automated pass; owner still needs to judge phrasing.                 |
| EUR, number, unit, dates, relative time | `tests/unit/formatters.test.ts` covers all three locales using the kitchen timezone.                                                                                                                                                     | Unit pass.                                                           |
| RTL, mixed Latin codes                  | Persian document direction is checked in a browser. Order-code headings and the payment result isolate Latin `SK-…` values with `<bdi dir="ltr">`; component tests verify the markup.                                                    | Automated pass on representative surfaces.                           |
| Truncation and layout                   | `tests/e2e/localization-qa.spec.ts` checks Home, Menu, Contact, and dashboard-shell preview at 390 and 1280 CSS px per locale. It checks the main heading and document overflow and captures full-page screenshots.                      | Browser pass on sampled routes; not an exhaustive manual text audit. |
| Locale persistence                      | The browser test switches to Persian, navigates, reloads, and confirms RTL remains active without a locale path segment.                                                                                                                 | Browser pass.                                                        |
| Outdated copy                           | Removed a stale SK-0102 blog-selector message that had kept the selector disabled, removed unused pre-authentication copy, and updated dashboard-preview copy.                                                                           | Code and component tests pass.                                       |

The current screenshot packet is at `C:\Users\NoteBook\Desktop\Sara-Kitchen-Localization-QA` (24 PNGs: four routes × two widths × three locales). These are development-state screenshots, not final launch imagery or data. Recreate them with `SARA_LOCALIZATION_SHOTS_DIR` set to the desired output directory before the content-owner review.

## Approval still required

Sara Kitchen's English, Portuguese, and Persian content owners must review the screenshots and message catalogs for tone, terminology, food names, allergens, business rules, and punctuation. They must also inspect dynamic dish/blog/settings translations after final data entry; absent content can legitimately fall back to English. Record each locale's reviewer, date, and approved build/content revision. Until those approvals and final-content screenshots exist, SK-0185 stays open.

| Locale     | Copy reviewer/date | Final screenshot reviewer/date | Approved build/content revision |
| ---------- | ------------------ | ------------------------------ | ------------------------------- |
| English    | Pending            | Pending                        | Pending                         |
| Portuguese | Pending            | Pending                        | Pending                         |
| Persian    | Pending            | Pending                        | Pending                         |
