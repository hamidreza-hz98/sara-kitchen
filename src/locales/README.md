# Locales

Application message catalogs and localization support files belong here.

- Launch locales are English (`en`, default), Portuguese (`pt-PT`), and Persian/Farsi (`fa`, RTL).
- Keep stable message keys aligned across every locale and fail loudly on missing development keys.
- Use ICU messages for interpolation, pluralization, and select cases.
- Format currency, dates, times, numbers, and units through locale-aware helpers rather than translated string concatenation.
- The selected locale is persisted in a first-party browser cookie; public URLs do not contain a locale segment.
- Database entity translations are domain data and do not belong in these application message catalogs.

Catalogs are split into `shared`, `validation`, `storefront`, `profile`, `dashboard`, `entities`, and
`errors` files for every supported locale. English is the typed source contract and defensive runtime
fallback. Run `pnpm check:locales` after any copy change; CI rejects missing, extra, empty, malformed,
or placeholder-incompatible messages.

## Runtime structure

- `routing.ts` is the single locale and cookie routing contract. `localePrefix: "never"` keeps the
  public URL language-neutral; Proxy rewrites to the internal `[locale]` segment.
- `request.ts` validates the internal route locale, loads its catalog, and fixes the application time
  zone to `Europe/Lisbon`.
- `navigation.ts` exports locale-aware `Link`, redirect, pathname, and router helpers. Import these
  instead of their Next.js equivalents when navigation changes or depends on locale.
- `messages.ts` uses an exhaustive loader map and merges localized copy over English defensively.
- `global.d.ts` derives valid translation namespaces and keys from the English source catalog.
- `messages/<locale>/*.json` contains UI copy only. Every locale must preserve the English shape.

The first-party `SARA_LOCALE` cookie is authoritative. A missing or unsupported value is normalized
to English by `src/proxy.ts`; browser `Accept-Language` does not override that product decision.
