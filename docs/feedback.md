# Feedback infrastructure

Sara Kitchen uses one localized feedback contract for transient actions, confirmations, connection
status, loading, and recoverable route failures. The contract lives inside the locale and theme
providers so every normal application message inherits the active language, direction, and design
tokens.

## Transient notifications

Call `useFeedback().notify()` with a localized `message`, a `severity`, and an optional localized
`title` or duration. Notifications enter a FIFO queue: a rapid sequence never replaces feedback the
user has not seen. The active snackbar is announced as an alert, can be dismissed with a localized
accessible label, ignores click-away dismissal, and advances to the next queued item.

Use the severity consistently:

- `success` for a completed operation;
- `warning` for validation or a condition the user can correct;
- `error` for permission, network, and unknown failures;
- `info` for neutral status messages.

Do not pass raw server exceptions, personal data, or untranslated strings to user-facing feedback.
Map typed application errors to messages from `shared.feedback` or `errors` first.

## Confirmations

`ConfirmationDialog` is the shared controlled confirmation primitive. Its cancel action receives
initial focus, Escape and the close control cancel, and dangerous confirmation uses the error color.
Callers own the open/loading state and the operation; closing a dialog is not proof that an operation
succeeded. Announce the eventual result through the feedback queue.

## Connection state

`FeedbackProvider` listens for browser `online` and `offline` events. Offline status remains visible
and cannot be dismissed while the browser reports no connection. A localized recovery notification
is queued when connectivity returns. Browser connectivity is only a reachability hint; failed API
requests must still map to the localized network-error outcome.

## Route recovery

- `[locale]/loading.tsx` renders localized, accessible skeleton status while a route segment streams.
- `[locale]/error.tsx` logs the captured client error, preserves the provider shell, and exposes the
  framework `reset()` recovery action.
- `[locale]/not-found.tsx` handles localized application routes.
- `global-error.tsx` and experimental `global-not-found.tsx` render complete, dependency-light HTML
  documents when the locale/theme tree cannot render or a URL falls outside it. These emergency
  fallbacks intentionally use English because no trusted locale context exists at that level.

Console reporting is the foundation behavior. The logs module will replace it with structured,
redacted production reporting when that module is implemented.

## Demonstration and verification

`/theme-showcase` exposes success, validation, permission, network, unknown-error, and confirmation
actions using the current locale. Component tests cover queue order, safe confirmation focus,
offline/reconnected behavior, and loading announcements. Playwright covers the visible outcomes,
offline recovery, and localized 404 behavior in the real App Router; the production build validates
the experimental global fallback entry point.
