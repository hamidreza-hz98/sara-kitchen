# Media persistence model (SK-0069)

Media owns the private Mongoose schema and model. Other modules store a Media ID and must use the
Media public API when later read/write services are implemented; they must never import
`model/media.ts`. This task defines persistence only, not upload, processing, delivery, CRUD, or
reference-count services.

| Area             | Persisted contract                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/storage | Managed originals use `source=managed`, `provider=minio`, bucket and safe object key. External items use `source=external`, `provider=external`, and an HTTPS URL, with no local key/bucket/variants.                                                                               |
| File metadata    | Original name, MIME type, kind (`image`, `video`, `pdf`, `other`), optional known bytes, image dimensions, video duration in milliseconds, PDF page count, and lowercase SHA-256 checksum. Managed files always have a byte count; ready managed originals also require a checksum. |
| Processing       | `pending`, `processing`, `ready`, or `failed`; failures require a bounded code, never a raw provider error. External items are already ready.                                                                                                                                       |
| Derived variants | Embedded on the image original with distinct object keys, MIME, bytes, optional dimensions/checksum, and independent processing state/failure code. Ready variants require a checksum. Variant keys cannot duplicate each other or the original.                                    |
| Localization     | `translations: [{locale, alt}]` uses the shared canonical-English, unique-locale validator. Alt text is linguistic; keys, measurements, status, and provider are not.                                                                                                               |
| Ownership/usage  | Uploader is an Admin ObjectId; `usageCount` is a nonnegative safe integer. Usage changes must be controlled by future reference-safe services, not arbitrary client updates.                                                                                                        |
| Lifecycle        | Shared timestamps, actor provenance, schema version, hidden normalized filename/alt search material, and paired soft-delete timestamp/actor. Deletion is independent of processing state and remains explicitly visible to authorized maintenance flows.                            |

The unique `(bucket, objectKey)` index applies only to active managed originals. It prevents two
active records from claiming one object but allows restoration/replacement workflows after a soft
delete. Checksum and processing-queue indexes support deduplication and processing. Management reads
use compound recent, state/kind, MIME, uploader, and usage indexes plus one weighted text index over
original filename and translated alt text. Embedded variant keys are validated within their parent;
object storage creation must additionally use collision-resistant keys and conditional writes
because MongoDB cannot enforce global uniqueness across embedded array values.

Image dimensions are not applied to video/PDF records; video duration and PDF page count are stored
only for their matching kinds. Unknown measurements remain `null` until processing discovers them.
The schema rejects path traversal/control characters in managed keys, insecure or credential-bearing external URLs (including query strings), malformed
MIME/checksum values, and inconsistent storage or failure states.

Model validation runs on document `validate()`/`save()`. Future repositories must avoid bypassing
these invariants with direct query updates; they should load, mutate, and save or use explicit guarded
atomic operations with equivalent validation. [Mongoose validation documentation](https://mongoosejs.com/docs/validation)
describes the validation and subdocument behavior relied on here.

Unit tests cover each storage/lifecycle branch, translation validation, deletion provenance,
variant uniqueness, metadata-kind restrictions, and index declarations. A MongoDB integration test
persists managed, derived, failed, external, and deleted states and verifies active-object uniqueness.
