# MinIO storage adapter (SK-0072)

`MinioStorageProvider` implements the public `StorageProvider` contract and is configured by `createMinioStorageProvider()` from validated server-only `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, and `MINIO_REGION`. No browser-prefixed variable or fallback credential is used. The adapter accepts only the configured private bucket and validates object keys.

The media service should call `createMediaObjectKey(scope, validatedExtension)` to obtain a date-partitioned, UUID-based key. Submitted filenames are never used as object keys. Uploads count stream bytes and reject any mismatch against the declared size. Uploads check that the destination is absent; small uploads additionally use a conditional create-only PUT. The MinIO SDK switches to multipart above its configured 16 MiB part size. Multipart create-only behavior is not an atomic guarantee against a simultaneous writer to the same key; generated UUID keys and a single authorized upload path are required. The initial upload policy caps files at 50 MiB. Copy checks the destination and sends a destination condition; move is copy-then-delete and is not atomic. A caller must reconcile both keys after an interrupted move, as documented in the provider contract.

The bucket stays private. `signedReadUrl` issues GET URLs for 1–900 seconds, but it does not grant authorization itself: the calling media service must check actor permission and ready/non-deleted state first. Never log signed URLs or expose credentials or raw MinIO errors. For production, use TLS and a dedicated least-privilege service account. Local HTTP is allowed only for the loopback test setup.

To run the real-provider contract against the documented local infrastructure:

1. Start local services with `pnpm infra:up` (or point the test to an existing MinIO using the `MINIO_*` environment variables).
2. In PowerShell: `$env:RUN_MINIO_INTEGRATION='1'; pnpm exec vitest run --config vitest.integration.config.mts tests/integration/media-minio-provider.test.ts; Remove-Item Env:RUN_MINIO_INTEGRATION`.

The test uses a unique `contract/` prefix, deletes only its own objects, and includes a 17 MiB multipart-sized upload plus an anonymous-denial/signed-read check. The standard integration suite skips this live test unless `RUN_MINIO_INTEGRATION=1`, so a clean checkout does not unexpectedly need MinIO. The local test run for SK-0072 used an official, checksum-verified tagged MinIO Windows release because Docker was unavailable on that host.

Reference: [MinIO JavaScript SDK API](https://docs.min.io/aistor/developers/sdk/javascript/api/).
