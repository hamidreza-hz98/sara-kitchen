# Shared UI primitives

`src/components/ui` is Sara Kitchen's stable application-level component surface. The wrappers use
the approved MUI theme and preserve MUI's tested keyboard, focus, portal, and ARIA behavior while
encoding product defaults that should not be decided independently on every page.

Import primitives from `@/components/ui`; feature code must not reach into individual implementation
files. The global `@/components` barrel remains deliberately small so unrelated routes do not
initialize the complete UI surface. Keep domain behavior, data fetching, permissions, and mutations
outside this layer.

## Component contracts

| Primitive           | Product contract                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActionButton`      | Uses the themed MUI button and defaults to `type="button"` to prevent accidental form submission                                                                              |
| `AppLink`           | Uses locale-aware clean-URL navigation with approved link color, weight, and underline behavior                                                                               |
| `FormField`         | Requires a visible label and form name; retains MUI helper, error, disabled, and input semantics                                                                              |
| `SelectField`       | Requires a visible label, form name, and typed option inventory; retains native keyboard selection semantics through MUI Select                                               |
| `AppDialog`         | Requires title, localized close label, and controlled close action; wires labelled/described relationships and relies on MUI focus trapping, restoration, and Escape handling |
| `AppDrawer`         | Requires title, localized close label, and controlled close action; accepts logical `start`/`end` sides and maps them to physical sides from theme direction                  |
| `NotificationBadge` | Requires an accessible badge label instead of exposing an unexplained count                                                                                                   |
| `StatusChip`        | Uses the themed semantic MUI chip variants for compact status/category labels                                                                                                 |
| `AppTooltip`        | Clones enabled controls directly for keyboard focus and supplies an inline wrapper when `disabled` is explicitly set                                                          |
| `ContentSkeleton`   | Requires localized loading text in a polite status region while keeping the visual skeleton hidden from assistive technology                                                  |
| `EmptyState`        | Announces a non-critical state, supports a useful next action, and provides an overridable decorative icon                                                                    |
| `ErrorState`        | Announces failure as an alert, supports recovery action, and provides an overridable decorative icon                                                                          |
| `AppPagination`     | Requires a localized navigation label and retains MUI's keyboard-operable page controls                                                                                       |
| `AppImage`          | Requires explicit informative or decorative alt intent and applies tokenized radius/object-fit defaults to optimized Next.js images                                           |
| `RichContent`       | Defensively sanitizes and renders the versioned TipTap-compatible allow-list as semantic React nodes; raw HTML and unsafe link schemes are never injected                     |

`RichContent` supports documents, paragraphs, headings levels 2–4, ordered and unordered lists, list
items, blockquotes, hard breaks, text, bold, italic, underline, strike, code, and safe `https`,
`mailto`, `tel`, root-relative, and fragment links. Persistence-boundary validation must reject nodes
outside this schema. The renderer provides a second fail-closed layer by turning unsafe links into
plain text.

## Accessibility and localization rules

- All user-facing labels, descriptions, loading messages, tooltip text, close labels, pagination
  labels, image alternatives, and state copy must come from the active locale catalog.
- A tooltip never replaces a control's accessible name. Icon-only controls still require
  `aria-label`.
- Do not remove the global focus-visible treatment. Dialogs and drawers must restore focus to their
  trigger when closed.
- Use `side="start"` or `side="end"` for drawers; never infer physical left/right in feature code.
- Meaningful images need concise alt text. Decorative images use `decorative` with `alt=""`.
- State actions explain the next useful operation; never present an error without recovery guidance.
- Rich content uses document order and semantic headings. Stored content must not skip heading levels
  relative to its page context.

## Showcase and verification

`/theme-showcase` documents every primitive in light/dark and LTR/RTL-capable layouts. Interactive
examples include keyboard-focusable tooltip/badge controls, form fields, dialog and logical drawer,
status chips, loading skeletons, empty/error recovery states, image/rich content, and pagination.

Component tests verify labels, roles, safe form defaults, keyboard overlay dismissal, focus-triggered
tooltips, logical state semantics, image alternatives, navigation, and unsafe-link rejection.
Playwright runs axe against the full showcase in both themes and verifies keyboard dialog/drawer
behavior and focus restoration.
