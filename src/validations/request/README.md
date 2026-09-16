# Request validation schemas

This browser-safe package owns stable localized issue mapping plus reusable Zod schemas for list and
file metadata inputs. It never imports server or HTTP code. Route Handlers use the server adapters
exported by `@/server/http`; client forms may reuse these schemas directly.

Raw Zod messages and rejected values are not public API. `localizeZodIssues()` maps each issue to a
stable code, sanitizes its path, limits issue count, and obtains presentation text from the active
locale translator.

See `docs/request-validation.md` for transport parsing and authoring rules.
