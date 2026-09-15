# Localization

Sara Kitchen renders English (`en`), European Portuguese (`pt-PT`), and Persian (`fa`). English is
the deterministic default. Public URLs never include a locale segment; the server uses an internal
`[locale]` route solely to make locale data available to App Router layouts and pages.

## Request flow

1. `src/proxy.ts` reads the first-party `SARA_LOCALE` cookie.
2. Missing or unsupported values resolve to English and are replaced with a safe one-year cookie.
3. `next-intl` rewrites the clean public pathname to the selected internal `[locale]` route.
4. `src/locales/request.ts` validates that route value, loads the selected catalog, and merges it
   over the English fallback catalog.
5. The root locale layout sets HTML `lang` and `dir`, provides messages to client components, and
   applies the Persian font through the existing `:lang(fa)` font configuration.

Browser `Accept-Language` is intentionally ignored: locale order is explicit cookie, then English.
Requests for unknown public paths return the localized not-found response. An invalid locale cookie
does not break navigation and is repaired to English.

## Message namespaces

Each locale has the same seven JSON files under `src/locales/messages/<locale>/`:

| Namespace    | Owns                                                  |
| ------------ | ----------------------------------------------------- |
| `shared`     | Reusable actions, navigation, status, and brand copy  |
| `validation` | Form and schema validation feedback                   |
| `storefront` | Public home, menu, cart, blog, and metadata copy      |
| `profile`    | Customer account and order-history copy               |
| `dashboard`  | Management navigation, headings, and metrics          |
| `entities`   | Shared entity names used by tables and forms          |
| `errors`     | Not-found, authorization, network, and generic errors |

English defines the type-safe message contract. Portuguese and Persian are merged over English at
runtime as a defensive fallback, but incomplete files are never accepted by CI. An unresolved key
outside the English contract logs a visible warning and renders `⟦missing: namespace.key⟧` during
development. Production logs the error and renders its stable key so the UI remains diagnosable.

## Authoring rules

- Add UI copy to the appropriate English namespace, then add the same key and ICU placeholders to
  the matching Portuguese and Persian files.
- Use `useTranslations` in shared/client-capable components and the awaitable server APIs where an
  async Server Component or metadata function is more appropriate.
- Use the helpers from `@/locales` for locale-aware links, redirects, and router operations.
- Never concatenate localized currency, date, number, plural, or unit text; use `next-intl` formatters.
- Keep database entity translation arrays separate from application message catalogs.

## Value formatting

Import the pure helpers from `@/locales` for EUR currency, decimal numbers, units, relative time,
dates, and times. They enforce integer cents for money, use the canonical `Europe/Lisbon` time zone,
and cache `Intl` formatter instances. Persian intentionally uses its locale-default calendar and
digits. See [`localized-formatting.md`](./localized-formatting.md) for the complete contracts and
examples.

## Verification

`pnpm check:locales` checks all seven namespace files, key parity, non-empty leaf values, JSON shape,
and ICU placeholder parity. It runs inside `pnpm test` and therefore `pnpm verify`, so missing or
extra messages fail CI. Unit tests cover loading and fallback behavior. Playwright checks the
server-rendered language and direction for every launch locale, invalid-cookie recovery, clean URLs,
and unknown-route handling.
