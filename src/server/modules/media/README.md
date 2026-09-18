# Media

Owns media metadata, upload policy, object-storage provider coordination, processing state, image variants, translated alt text, usage checks, and safe deletion. Other modules store media identifiers and use this public API; they never query the Media model directly.

`model/media.ts` owns the private Mongoose record and indexes; `validation/media-metadata.ts`
owns its stable enums and safe metadata checks. See [`docs/media-model.md`](../../../../docs/media-model.md)
for the persisted contract. Consumers must use the module's public `index.ts`; the model remains private.

The public `index.ts` also exports upload admission policy and validators. See
[`docs/media-upload-policy.md`](../../../../docs/media-upload-policy.md). Admission does not
publish files; storage, atomic quota reservations, full decoding, and malware checks remain later work.

The provider-neutral storage boundary is `storage/storage-provider.ts`; its error and stream
semantics are documented in [`docs/media-storage-provider.md`](../../../../docs/media-storage-provider.md).
The fake-provider contract tests exercise it without a MinIO connection. The production adapter
is `storage/minio-provider.ts`.

`storage/minio-provider.ts` is the production adapter, with details and live-test instructions in
[`docs/media-minio-provider.md`](../../../../docs/media-minio-provider.md). It remains behind
the public storage contract.

`processing/image-processor.ts` creates metadata-free display and thumbnail outputs from admitted
images. Its limits, variant roles, and privacy policy are in
[`docs/media-image-processing.md`](../../../../docs/media-image-processing.md). Storage and
Media-record coordination is handled by `service/create-upload.ts`.

`processing/serverless-processing.ts` is the strict inline-only planning and execution boundary;
see [`docs/media-serverless-processing.md`](../../../../docs/media-serverless-processing.md).
There is no approved background worker, so large image/video/PDF processing is unsupported for MVP.

`service/create-upload.ts` coordinates the bounded single-image upload. It validates content bytes,
calculates a SHA-256 checksum, rejects existing content, creates all variants, uploads collision-proof
objects, and only then persists a ready Media record. Failed object or database writes trigger bounded
compensating deletion. The authenticated `POST /api/media` route and operational contract are documented
in [`docs/media-create-upload.md`](../../../../docs/media-create-upload.md).

`repository/media-read.ts`, `validation/media-read-query.ts`, and `service/read-media.ts` implement
authorized detail/list reads, indexed search and filters, safe DTO projection, and five-minute private
object access. The `GET /api/media` and `GET /api/media/:mediaId` contracts are documented in
[`docs/media-reads.md`](../../../../docs/media-reads.md).
