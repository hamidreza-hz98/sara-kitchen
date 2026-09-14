# Localization

Sara Kitchen renders English (`en`), European Portuguese (`pt-PT`), and Persian (`fa`). English is
the deterministic default. Public URLs never include a locale segment; the server uses an internal
`[locale]` route solely to make locale data available to App Router layouts and pages.

## Request flow

1. `src/proxy.ts` reads the first-party `SARA_LOCALE` cookie.
2. Missing or unsupported values resolve to English and are replaced with a safe one-year cookie.
3. `next-intl` rewrites the clean public pathname to the selected internal `[locale]` route.
4. `src/locales/request.ts` validates that route value and loads exactly one message catalog.
5. The root locale layout sets HTML `lang` and `dir`, provides messages to client components, and
   applies the Persian font through the existing `:lang(fa)` font configuration.

Browser `Accept-Language` is intentionally ignored: locale order is explicit cookie, then English.
Requests for unknown public paths return the localized not-found response. An invalid locale cookie
does not break navigation and is repaired to English.

## Authoring rules

- Add UI copy to `src/locales/messages/en.json`, then add the same key to `pt-PT.json` and `fa.json`.
- Use `useTranslations` in shared/client-capable components and the awaitable server APIs where an
  async Server Component or metadata function is more appropriate.
- Use the helpers from `@/locales` for locale-aware links, redirects, and router operations.
- Never concatenate localized currency, date, number, plural, or unit text; use `next-intl` formatters.
- Keep database entity translation arrays separate from application message catalogs.

## Verification

`pnpm test:unit` checks routing, catalog parity, fallback behavior, and RTL metadata. Playwright checks
the server-rendered language and direction for every launch locale, invalid-cookie recovery, clean
URLs, and unknown-route handling.
