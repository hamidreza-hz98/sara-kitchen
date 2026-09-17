# Environment configuration

Sara Kitchen validates environment variables with Zod while Next.js loads its root `.env*` files.
`next.config.ts` runs validation before development or production compilation begins, so invalid
configuration fails with field-level guidance rather than later connection errors.

## Setup

1. Copy `.env.example` to `.env.local` for local development.
2. Replace every `replace-with-*` placeholder with a local value. Generate independent random values
   of at least 32 characters for the two authentication secrets.
3. Keep `.env.local` and deployment environment files untracked. Store production values only in the
   deployment provider's secret manager.
4. Run `pnpm dev` or `pnpm build`; either command validates the complete configuration immediately.

For the Docker Compose development values for MongoDB and MinIO, follow
[`local-infrastructure.md`](./local-infrastructure.md). The committed `.env.example` remains
provider-agnostic and non-operational by design.

The committed example contains no operational credentials. It intentionally fails validation until
its secret and kitchen-coordinate placeholders are replaced.

## Public browser configuration

| Variable               | Required | Purpose                                               |
| ---------------------- | -------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Yes      | Canonical public origin, inlined at application build |

Only allowlisted client variables may use `NEXT_PUBLIC_`. Startup rejects an unknown public key so
a mistyped or accidentally public secret cannot silently enter the browser bundle. Public values are
frozen when the application is built and must therefore be correct in the build environment.

## Core server configuration

| Variable                     | Required | Validation and purpose                          |
| ---------------------------- | -------- | ----------------------------------------------- |
| `MONGODB_URI`                | Yes      | MongoDB or MongoDB SRV connection URI           |
| `AUTH_SESSION_SECRET`        | Yes      | Independent 32+ character session-token secret  |
| `AUTH_PASSWORD_RESET_SECRET` | Yes      | Different 32+ character password-reset secret   |
| `MINIO_ENDPOINT`             | Yes      | MinIO hostname without a URL protocol           |
| `MINIO_PORT`                 | Yes      | Integer TCP port from 1 through 65535           |
| `MINIO_USE_SSL`              | Yes      | Literal `true` or `false`                       |
| `MINIO_ACCESS_KEY`           | Yes      | MinIO access identity                           |
| `MINIO_SECRET_KEY`           | Yes      | MinIO secret credential                         |
| `MINIO_BUCKET`               | Yes      | Valid S3-style bucket name                      |
| `MINIO_REGION`               | Yes      | Storage region identifier                       |
| `KITCHEN_LATITUDE`           | Yes      | Delivery origin latitude from -90 through 90    |
| `KITCHEN_LONGITUDE`          | Yes      | Delivery origin longitude from -180 through 180 |

These values are available only through the `server-only` guarded
`@/server/environment#getServerEnvironment()` accessor and must never be imported into a Client
Component.

## Conditional integrations

`MBWAY_ENABLED` and `WHATSAPP_ENABLED` are always required and accept only `true` or `false`. Their
credentials may remain empty during early development when the flag is `false`. Enabling a provider
requires every value in its group:

- MB Way: `MBWAY_API_URL`, `MBWAY_MERCHANT_ID`, `MBWAY_API_KEY`, and
  `MBWAY_WEBHOOK_SECRET`.
- WhatsApp: `WHATSAPP_API_URL`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and
  `WHATSAPP_EMPLOYER_NUMBER` in E.164 format.

`RESET_SMS_ENABLED` defaults to `false`. Customer password recovery is intentionally unavailable
until it is enabled with `TWILIO_RESET_ACCOUNT_SID`, `TWILIO_RESET_AUTH_TOKEN`, and
`TWILIO_RESET_FROM_NUMBER` (E.164). Set these only in the deployment secret manager. The reset
request endpoint returns a generic response in local development while SMS is disabled; in
production it fails closed with a server error if the provider is disabled. Use a Twilio test
account or approved sender in staging, then verify delivery to real Portuguese mobile numbers
before launch. Reset URLs must use the public HTTPS `NEXT_PUBLIC_SITE_URL` origin.

Errors list invalid variable names and remediation, but never include received values. Add new
variables to the schema and this inventory in the same change.
