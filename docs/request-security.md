# Request security

Sara Kitchen treats browser mutations and provider callbacks as different trust boundaries.

## Browser Route Handlers

- Session cookies are host-only, `HttpOnly`, `SameSite=Strict`, and `Secure` in production; production names use the `__Host-` prefix and never set `Domain`.
- Every mutation rejects a missing, malformed, or foreign `Origin`. The URL host, `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and `Sec-Fetch-Site` must be consistent when those proxy/browser headers are present. The production proxy must overwrite forwarding headers rather than append untrusted client values.
- Public login, signup, and password-reset endpoints use this strict origin boundary because there is no authenticated session to bind a synchronizer token to.
- Authenticated JSON mutations additionally require `X-CSRF-Token`. `GET /api/auth/csrf?principal=admin|customer` returns a no-store HMAC token only after resolving the matching active session. The token is bound to the session bearer and actor kind, is never stored in a cookie, and becomes useless when the session rotates.
- `GET`, `HEAD`, and other safe methods must never mutate state. CORS is not enabled for credentialed browser APIs.

## Server Actions

Next.js compares Server Action `Origin` against `Host` by default. No `serverActions.allowedOrigins` bypass is configured, and action bodies are capped at 64 KiB. Each action still authenticates and authorizes internally; the framework's CSRF check does not replace authorization.

## Payment webhooks

Payment callbacks do not use browser cookies or CSRF tokens. Transactions owns `verifyMbWayWebhookSignature`, which verifies the exact raw body with a timestamped HMAC-SHA256 signature, constant-time comparison, and a five-minute replay window. The sandbox envelope is:

- `X-MBWAY-Timestamp: <unix-seconds>`
- `X-MBWAY-Signature: sha256=<hex HMAC of timestamp + "." + raw body>`

No payment webhook Route Handler exists yet, so callbacks cannot reach transaction/order state. When the selected MB Way acquirer is integrated, its Route Handler must read the raw body once, verify the provider's documented signature before parsing or writing, then apply durable event-id idempotency. If the provider's documented scheme differs, replace only the verifier adapter and its contract tests—never weaken it to a shared browser-origin check.

References: [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) and [Next.js Server Actions security configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).
