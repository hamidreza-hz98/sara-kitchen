# Providers

Application-level React context providers and their composition belong here.

- Keep the provider tree shallow and document why each provider must wrap the application.
- Isolate Client Components so a provider does not force unrelated routes into the client bundle.
- Providers may coordinate UI concerns such as theme, locale, notifications, and query state.
- Authentication and authoritative business data remain server-owned; a provider may expose sanitized state but must not become the source of truth.
- Provider order and server/client boundaries must be covered by integration tests when behavior depends on them.

`DirectionAwareCacheProvider` is the narrow client boundary around MUI's official
`AppRouterCacheProvider`; it selects the LTR or RTL streaming Emotion configuration without sending
plugin functions across a Server Component boundary. `AppThemeProvider` selects a theme with the
same direction and owns the baseline. Keep query and notification providers inside this boundary
only when introduced by their dedicated tasks.

`LocaleProvider` owns the client-side `next-intl` error and fallback callbacks. The matching server
callbacks live in the request configuration so missing-key behavior is consistent across rendering
boundaries.
