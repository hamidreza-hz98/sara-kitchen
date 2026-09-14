# Providers

Application-level React context providers and their composition belong here.

- Keep the provider tree shallow and document why each provider must wrap the application.
- Isolate Client Components so a provider does not force unrelated routes into the client bundle.
- Providers may coordinate UI concerns such as theme, locale, notifications, and query state.
- Authentication and authoritative business data remain server-owned; a provider may expose sanitized state but must not become the source of truth.
- Provider order and server/client boundaries must be covered by integration tests when behavior depends on them.
