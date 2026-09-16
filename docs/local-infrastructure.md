# Local infrastructure

Sara Kitchen runs MongoDB and MinIO locally through Docker Compose. The stack binds only to
`127.0.0.1`, uses development-only credentials, waits for service health, creates the private media
bucket idempotently, and stores state in named volumes.

The local Compose MongoDB is **standalone**, so it cannot run the multi-collection checkout/payment transactions defined in [ADR-0008](./adr/0008-transaction-boundaries.md). Those workflows fail before writing; they never fall back to unsafe partial writes. Automated transaction integration tests start an isolated single-node replica set. A separate local replica-set setup is required for interactive end-to-end checkout development.

## Prerequisite

Install Docker Desktop with Docker Compose v2 and start its Linux container engine. Verify it with:

```powershell
docker version
docker compose version
```

Docker Desktop is not installed automatically because it changes workstation-level virtualization,
networking, services, and licensing state.

## Start and stop

Start both services, wait until they are healthy, and create/verify the media bucket:

```powershell
pnpm infra:up
```

The command exits non-zero if Docker is unavailable, a service never becomes healthy, or bucket
provisioning fails. Inspect state and recent logs with:

```powershell
pnpm infra:status
pnpm infra:logs
```

Stop and remove the containers and Compose network without deleting database or object data:

```powershell
pnpm infra:down
```

The shutdown command intentionally does not pass `--volumes`/`-v`. The named volumes survive and
are reused by the next `pnpm infra:up`:

- `sara-kitchen-mongo-data`
- `sara-kitchen-mongo-config`
- `sara-kitchen-minio-data`

Deleting these volumes is a separate destructive reset operation and is intentionally not exposed as
a package script.

## Local endpoints and application values

| Service       | Address                                        |
| ------------- | ---------------------------------------------- |
| MongoDB       | `127.0.0.1:27017`                              |
| MinIO S3 API  | [http://127.0.0.1:9000](http://127.0.0.1:9000) |
| MinIO console | [http://127.0.0.1:9001](http://127.0.0.1:9001) |

Copy these local-stack values into the corresponding entries in `.env.local`:

```dotenv
MONGODB_URI=mongodb://sara_kitchen_app:local-only-mongo-app-4b8c1f7e9a2d6c3f@127.0.0.1:27017/sara-kitchen?authSource=sara-kitchen
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=sara_kitchen_minio
MINIO_SECRET_KEY=local-only-minio-9c2e7a4d8f1b6c3e
MINIO_BUCKET=sara-kitchen-media
MINIO_REGION=us-east-1
```

The MongoDB application account has `readWrite` only on `sara-kitchen`; the root account is reserved
for container initialization and health checks. MinIO's local root identity is acceptable only for
this loopback-bound development stack. All committed values in `infra/local.env` are intentionally
non-production and must never be reused in a shared, staging, or production environment.

## Service initialization

- MongoDB uses the pinned `mongo:8.0.30-noble` maintenance image. On the first empty volume, the
  official entrypoint creates its root identity and runs `infra/mongodb/init-app-user.js` to create
  the least-privilege application account.
- MinIO uses the upstream security-fix release `RELEASE.2025-10-15T17-29-55Z`. Its upstream release
  does not publish a corresponding server image and its archived release downloads now return HTTP
  410, so `infra/minio/Dockerfile` fetches the exact tagged Git commit
  `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`, verifies both commit and tag, and compiles with the
  upstream release flags into a non-root local image.
- The MinIO client is pinned to `RELEASE.2025-08-13T08-35-41Z` and its immutable multi-platform image
  digest. It waits for MinIO readiness, creates `sara-kitchen-media` with `--ignore-existing`, disables
  anonymous access, verifies the bucket, and then removes its one-shot container.

MongoDB initialization scripts run only for an empty data volume. Changing a committed initialization
credential does not mutate an existing database; provision a deliberate credential rotation or reset
instead.

## Validation and troubleshooting

`pnpm test:infra` parses `compose.yaml` and checks image pinning, loopback port bindings, health
checks, named volumes, bucket privacy/provisioning, local credential labeling, and non-destructive
shutdown behavior. With Docker installed, render and validate the resolved Compose model using:

```powershell
pnpm infra:config
```

Common failures:

- **Docker CLI unavailable:** install/start Docker Desktop, reopen the terminal, and retry.
- **Port already allocated:** stop the local process using 27017, 9000, or 9001; ports are fixed so
  `.env.local` remains predictable.
- **Unhealthy MongoDB:** inspect `pnpm infra:logs`; old volumes retain their original credentials.
- **MinIO build failure:** confirm internet access to GitHub and retry; commit/tag verification or
  compilation failures intentionally stop the image build.

## Primary references

- [Docker Compose startup order and health conditions](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker Compose down and volume preservation](https://docs.docker.com/reference/cli/docker/compose/down/)
- [Mongo Docker Official Image](https://hub.docker.com/_/mongo)
- [MinIO security-fix release](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)
- [MinIO client releases](https://github.com/minio/mc/releases)
