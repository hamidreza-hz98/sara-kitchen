# Error monitoring

Sara Kitchen uses the official Sentry Next.js SDK for exception reporting and sampled performance
traces in the browser, Node.js runtime, and Edge runtime. Monitoring is disabled by default and does
not replace the append-only audit log or structured operational log.

## Runtime contract

- `src/instrumentation-client.ts` initializes browser monitoring and router-transition tracing.
- `src/instrumentation.ts` loads the Node.js or Edge configuration and exports the App Router request
  error hook.
- handled internal Route Handler failures are captured explicitly with their request ID, module, and
  action; React error boundaries capture recoverable browser failures.
- every explicitly captured event carries `runtime` and `alert_route` tags. Server failures also carry
  `module`, `action`, and `request_id` when available.
- environment and release tags come from the validated variables. The public and server release
  values must be identical for a deployment.

## Privacy boundary

`sendDefaultPii` is off. Before transmission, the shared event processor removes the user object,
request bodies, query strings, cookies, authorization headers, stack variables, and source-context
lines. It recursively redacts credential-shaped keys and inline bearer tokens, JWTs, password/token
assignments, Argon2 hashes, private keys, and credentialed database URLs. Filename, function, line,
and column data remain so uploaded source maps can produce useful stack traces. Session Replay is not
enabled.

## Deployment configuration

Set `SENTRY_ENABLED=true`, both DSNs, a stable environment and matching release, then choose a small
trace sample rate. The DSN is an ingestion identifier and is intentionally available to the browser;
the auth token is a deployment secret and must never use the `NEXT_PUBLIC_` prefix.

To upload source maps, set `SENTRY_SOURCE_MAPS_ENABLED=true` and provide `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT` only in the build environment. Production builds upload maps after
compilation and delete browser map files afterward. The build fails environment validation if source
map upload is enabled without all three values.

## Alert routing

Create these Sentry issue-alert workflows before enabling production monitoring:

1. production `alert_route=backend`, new or regressed issue: route to the engineering on-call email;
2. production `alert_route=frontend`, new or regressed issue: route to the storefront owner;
3. production payment/order modules or fatal/high-frequency issues: page the on-call channel and email
   the owner;
4. performance regression above the agreed transaction threshold: notify engineering, grouped by
   release and transaction.

Keep development and staging alerts out of production routes. Sentry account destinations are
managed in Sentry, not committed to this repository.

## Verification

Run `pnpm monitoring:verify` to prove the controlled event is redacted while its source location and
request ID remain readable. For a deployment smoke test, trigger one controlled server exception and
one controlled client boundary exception using a non-secret canary value, then verify in Sentry:

- both events have the expected environment, release, runtime, and request ID tags;
- application filenames/functions and line numbers are symbolicated;
- the canary secret, request body, query, cookies, authorization, and user identity are absent;
- each issue reaches only its configured alert route.

Disable the verification trigger immediately after the smoke test and record the two issue links in
the deployment acceptance record.
