# Hooks

Shared client-side React hooks belong here.

- Prefix hook names with `use` and keep each hook focused on one behavior.
- Prefer Server Components and server-side data loading when a hook is not actually required.
- Keep feature-only hooks with their feature when reuse would create accidental coupling.
- Hooks must not import server-only modules, database models, secrets, or Node.js-only packages.
- Tests should exercise observable hook behavior, cleanup, and failure states.

Do not add pass-through hooks that merely rename a library API without adding a stable project-level contract.

`useFeedback` is the stable application contract for queued notifications. It fails immediately
outside `FeedbackProvider`, accepts already-localized safe messages, and deliberately hides the
provider's queue implementation from callers.
