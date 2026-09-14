# Locales

Application message catalogs and localization support files belong here.

- Launch locales are English (`en`, default), Portuguese (`pt-PT`), and Persian/Farsi (`fa`, RTL).
- Keep stable message keys aligned across every locale and fail loudly on missing development keys.
- Use ICU messages for interpolation, pluralization, and select cases.
- Format currency, dates, times, numbers, and units through locale-aware helpers rather than translated string concatenation.
- The selected locale is persisted in a first-party browser cookie; public URLs do not contain a locale segment.
- Database entity translations are domain data and do not belong in these application message catalogs.

The `next-intl` request configuration and catalogs will be added by the localization tasks.
