# Secret management and rotation

Sara Kitchen stores operational secrets only in the deployment platform's encrypted secret store.
Production values must never exist in Git, `.env.example`, Vercel project files, build artifacts,
container images, tickets, chat or AI prompts, screenshots, logs, analytics, or documentation.

Local `.env.local` is ignored and may contain development-only credentials. It is not a production
secret store, must not be synchronized through consumer cloud drives, and must use different values
from preview and production. The committed Docker credentials are loopback-only development fixtures
and must never be accepted by a public or production service.

## Inventory and ownership

| Class                    | Current or future values                                                                | System of record                                                                  | Rotation owner              |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| Application cryptography | `AUTH_SESSION_SECRET`, `AUTH_PASSWORD_RESET_SECRET`                                     | Vercel encrypted environment variables                                            | Application owner           |
| Database                 | Complete `MONGODB_URI`, including Atlas username/password                               | Vercel encrypted environment variables; identity managed in Atlas                 | Database owner              |
| Object storage           | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`                                                  | Vercel encrypted environment variables; identity managed in MinIO                 | Storage owner               |
| Payment                  | `MBWAY_API_KEY`, `MBWAY_WEBHOOK_SECRET`, and any future private merchant credential     | Vercel encrypted environment variables; source credential managed by the acquirer | Payment owner               |
| Messaging                | `TWILIO_RESET_AUTH_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, and future provider signing secrets | Vercel encrypted environment variables; source credential managed by the provider | Messaging owner             |
| SMTP/email               | Future SMTP password or email-provider API/webhook keys                                 | Vercel encrypted environment variables; source credential managed by the provider | Messaging owner             |
| Deployment automation    | Tokens needed by Vercel or GitHub Actions                                               | The owning platform's encrypted secret store, never application variables         | Repository/deployment owner |

Endpoints, bucket names, sender numbers, merchant IDs, account SIDs, and access-key identifiers may
not authenticate by themselves, but remain server configuration unless explicitly classified as
public. No secret may use a `NEXT_PUBLIC_` prefix. Preview and production use separate provider
accounts or least-privilege credentials; previews never receive production database, payment,
messaging, or storage access.

Access is least privilege and named rather than shared. Only the project owner and the operator who
must rotate or diagnose a provider receive production-secret access. Enable provider audit logs and
MFA, review access quarterly, remove access immediately when responsibility ends, and never read a
secret merely to copy it between people. Generate values with a cryptographically secure generator;
do not derive one secret from another.

## Rotation procedure

Rotate provider credentials at least every 90 days where the provider permits automation, whenever
an operator loses access, and immediately after suspected exposure. Record only the credential name,
owner, provider-side identifier/version, environments, creation/activation/revocation timestamps,
reason, deployment revision, and verification result—never the value itself.

Use this sequence when the provider supports overlapping credentials:

1. Create a new least-privilege credential at the source provider without revoking the old one.
2. Put the new value directly into the target environment's Vercel secret store. Do not pass it
   through a file, shell history, clipboard manager, ticket, or chat.
3. Redeploy that environment and verify startup validation, `/api/ready`, and the affected provider
   flow without printing configuration.
4. Promote only after staging/preview evidence passes. Confirm new-credential use in provider audit
   metadata, then revoke the old credential.
5. Re-run readiness and smoke checks, monitor authentication failures, and record the non-secret
   rotation evidence.

Class-specific effects and order:

- **MongoDB:** create a second scoped Atlas database user, deploy the new URI, verify readiness and a
  read/write smoke test, then remove the old user. Never rotate by editing a password in place before
  the new deployment is healthy.
- **MinIO:** create a second application access key with bucket-scoped policy, deploy and verify
  readiness plus upload/read/delete behavior, then revoke the old key. Root credentials are never
  application credentials.
- **Session HMAC:** generate a new `AUTH_SESSION_SECRET` and redeploy. Existing opaque login sessions
  remain database-backed, but outstanding CSRF tokens become invalid and rate-limit key spaces reset;
  monitor retries and require fresh CSRF acquisition. If a compromise may include session records,
  revoke active sessions separately.
- **Password-reset HMAC:** changing `AUTH_PASSWORD_RESET_SECRET` intentionally invalidates all
  outstanding password-reset links and limiter key hashes. Announce that users must request a new
  link after deployment.
- **Payment/webhook:** create/activate the new API key first. Webhook signing-secret overlap depends on
  the acquirer. The current schema supports one MB Way webhook secret, so schedule a coordinated short
  cutover or first implement dual-secret verification; never disable signature verification during
  rotation.
- **Twilio, WhatsApp, SMTP/email:** create a secondary token where supported, deploy, send a safe test,
  inspect provider delivery/audit status, and revoke the former token. Rotate provider webhook signing
  secrets independently from outbound API tokens.

## Exposure response

A secret in a commit, artifact, log, screenshot, or message is compromised even if quickly deleted.
Immediately stop sharing it, revoke or rotate it at the source provider, identify affected
environments and access, inspect provider/application audit logs, invalidate derived credentials or
sessions where applicable, and notify the project owner. Preserve non-secret evidence for incident
review.

Removing a line or rewriting Git history does not make the credential safe. Rotate first. After
rotation, remove the value from the current tree and build output; coordinate any necessary history
rewrite because it changes every descendant commit and requires collaborators to re-clone. Run the
full secret scan again and add a narrowly scoped allowlist only for a reviewed non-operational fixture.
Allowlists must combine an exact rule, exact path, and exact line pattern; commit-wide, directory-wide,
and generic-secret exclusions are forbidden.

## Automated verification

`pnpm secrets:scan` uses Gitleaks 8.30.1 with checksummed release archives, re-extracts the executable
from the verified archive on every run, and fully redacts output.
It scans three distinct surfaces:

1. `gitleaks git --log-opts=--all` checks every local ref and its complete reachable history.
2. A temporary snapshot of Git-tracked and unignored files checks current uncommitted source without
   traversing dependencies or ignored local environment files.
3. A temporary snapshot of deployable `.next/server`, `.next/static`, optional standalone output, and
   root build manifests checks production output without scanning disposable Turbopack caches. When
   sensitive environment variables are present in the scanner process, an exact byte check first
   proves none of their values were inlined, independent of Gitleaks heuristics.

Run `pnpm build && pnpm secrets:scan` before production. The GitHub workflow checks out full history,
builds with non-operational canary configuration, and runs the same command on pushes to `master`, pull
requests, and manual dispatch. Scanner output is always fully redacted. Scanner reports are ignored
because reports can themselves contain sensitive metadata.

The small `.gitleaks.toml` allowlist contains exact reviewed exceptions: a signup-test fixture,
architecture prose, and Next.js-generated preview/Server Action cryptographic fields that must reside
in their exact server-only deployment manifests. The build exceptions constrain the filename, field
name, encoding, and length; they do not allow any Sara Kitchen or provider environment variable.
Changes to that file require security review. A clean scan is evidence, not proof that no secret
exists; provider access review, log hygiene, runtime configuration validation, and prompt/screenshot
discipline remain mandatory.
