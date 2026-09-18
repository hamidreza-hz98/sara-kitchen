# Media

Owns media metadata, upload policy, object-storage provider coordination, processing state, image variants, translated alt text, usage checks, and safe deletion. Other modules store media identifiers and use this public API; they never query the Media model directly.

`model/media.ts` now owns the private Mongoose record and indexes; `validation/media-metadata.ts`
owns its stable enums and safe metadata checks. See [`docs/media-model.md`](../../../../docs/media-model.md)
for the persisted contract. Upload/storage providers, processing, CRUD, usage changes, and public DTOs
remain later tasks and must be exposed through this module's `index.ts` rather than exporting the model.

The public `index.ts` also exports upload admission policy and validators. See
[`docs/media-upload-policy.md`](../../../../docs/media-upload-policy.md). Admission does not
publish files; storage, atomic quota reservations, full decoding, and malware checks remain later work.

The provider-neutral storage boundary is `storage/storage-provider.ts`; its error and stream
semantics are documented in [`docs/media-storage-provider.md`](../../../../docs/media-storage-provider.md).
The fake-provider contract tests exercise it without a MinIO connection. The production adapter
belongs to SK-0072.
