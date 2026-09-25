# Language settings

## Runtime model

`next-intl` statically knows the three launch locales (`en`, `pt-PT`, and `fa`) so their message
catalogs and direction-aware rendering remain build-safe. The direct-publish `languages` Settings
section controls which of those known locales the storefront exposes at runtime; it never removes
message files or translated entity content.

Every supported locale must remain in `data.locales` exactly once with a unique display order and one
of these states:

- `active` — visible and selectable by customers;
- `maintenance` — visible but disabled in the selector so temporary unavailability is explicit;
- `hidden` — omitted from the public selector while all translations remain stored.

At least one locale must be active. `defaultLocale` must reference an active locale. `fallbackOrder`
must contain every active locale exactly once and cannot include a maintenance or hidden locale. These
invariants prevent an administrator from publishing a configuration that has no usable language or
that redirects customers into an unavailable one.

`resolveConfiguredLocale` accepts a supported browser preference only when its configured state is
active; stale, maintenance, hidden, and absent preferences resolve to the active default.
`configuredFallbackOrder` returns the administrator-defined active lookup order without repeating the
requested locale.

## Display names and selector projection

Display names are translated data. Each settings translation contains target-locale `name` and
`shortName` values. Canonical English must name all supported locales; Portuguese and Persian may be
partial and resolve per target language through requested locale, configured fallback, then English.

`projectPublicLanguageSettings` returns ordered active and maintenance options. It marks only active
options selectable and omits hidden entries. Flag or country icons are intentionally not stored:
languages do not map reliably to nationality, and text labels plus locale codes are clearer and more
accessible. A future approved neutral icon can be added through a finite icon-key registry rather than
arbitrary markup.

The runtime Settings reader/cache and dashboard editor are delivered by SK-0123 and SK-0124. They must
consume this public contract rather than duplicating availability logic.

## Verification

- Unit tests cover exact locale retention, one-active/default invariants, active-only fallback order,
  canonical and partial display names, maintenance/hidden projection, localized fallback, and stale
  browser preferences.
- MongoDB integration coverage proves the complete locale configuration—including a hidden locale—is
  retained in one direct published revision.
