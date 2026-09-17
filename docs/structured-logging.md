# Structured application logging

## Purpose and boundary

Operational logs answer questions about application health, failures, latency, and deployments. They
are not the source of truth for business activity: security- and business-relevant activity belongs
in the append-only audit model documented in [`audit-logging.md`](./audit-logging.md).

The implementation lives in `src/server/observability` and is server-only. Callers create a logger
with a stable module name and, when handling a request, its request ID. They then provide an English
message, a stable action code, optional duration/context, and an optional error. The HTTP Route
Handler boundary automatically records completed, rejected, and unexpectedly failed requests.

## Canonical event contract

Every accepted event is normalized to the same `StructuredLogEvent` before formatting. Every key is
present, even when its value is `null`:

| Field               | Type                                      | Rule                                                           |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `timestamp`         | ISO-8601 string                           | UTC emission time                                              |
| `level`             | `debug \| info \| warn \| error \| fatal` | Filtered by the configured minimum                             |
| `requestId`         | string or `null`                          | Correlates one HTTP request; never a session token             |
| `module`            | string                                    | Stable subsystem name, such as `http` or `auth.password-reset` |
| `action`            | string                                    | Stable machine-searchable action code                          |
| `durationMs`        | finite non-negative number or `null`      | Milliseconds, rounded to microsecond precision                 |
| `deploymentVersion` | string                                    | Explicit version, commit SHA, deployment ID, or safe fallback  |
| `message`           | string                                    | Short English diagnostic summary                               |
| `context`           | redacted object or `null`                 | Bounded diagnostic metadata only                               |
| `error`             | redacted object or `null`                 | Stable `name`, `message`, `code`, and `stack` fields           |

This normalized object is the only input to both renderers. Development uses a readable single-line
format. Production uses one JSON object per line for log ingestion. Therefore, changing output mode
cannot add, remove, or bypass a typed field.

## Configuration

- `LOG_LEVEL` accepts `debug`, `info`, `warn`, `error`, or `fatal`. The default is `debug` outside
  production and `info` in production.
- `DEPLOYMENT_VERSION` is the explicit portable override. When absent, resolution checks
  `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID`, `GITHUB_SHA`, then `COMMIT_SHA`. The final fallback
  is `local` outside production and `unknown` in production.
- `NODE_ENV=production` selects JSON; every other environment selects pretty output.

Vercel's system environment variables must be enabled on the project if commit/deployment fallback
metadata is desired. Configuration labels are normalized and bounded before emission.

## Redaction and data minimization

Redaction is applied before either formatter sees an event. It is recursive and cycle-safe, bounds
depth, object keys, array items, strings, and stacks, strips control characters used for log
injection, removes URL credentials/query strings, and replaces sensitive keyed values with
`[REDACTED]`. Recognized inline Bearer/JWT/Argon2/private-key/database-URI and assignment-shaped
secrets are removed from messages, context strings, error messages, and stacks.

Callers must still practice data minimization. Never intentionally pass passwords, raw session IDs,
access/reset tokens, cookies, authorization headers, database URLs, payment credentials, full
request/response bodies, customer messages, or unnecessary personal data. Redaction is a safety net,
not authorization to collect sensitive content. Query strings are not logged by the shared HTTP
boundary.

## Levels and operations

- `debug`: local diagnosis; normally suppressed in production.
- `info`: expected lifecycle completion.
- `warn`: handled rejection or degraded but recoverable behavior.
- `error`: failed operation requiring investigation.
- `fatal`: process cannot safely continue; emit before controlled termination where possible.

`debug`/`info` write to stdout and `warn`/`error`/`fatal` to stderr. Log transport, retention, access,
alerts, and deletion are deployment concerns. They must honor the privacy retention policy and must
not be treated as immutable audit storage.

## Verification

Unit tests prove formatter parity, level filtering, deployment-version precedence, recursive
redaction, cycle handling, and request correlation. API-contract tests prove Route Handlers retain
their safe client response and error-reporter behavior while operational logging stays server-side.
