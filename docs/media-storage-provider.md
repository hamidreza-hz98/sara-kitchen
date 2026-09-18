# Media storage-provider contract (SK-0071)

`src/server/modules/media/storage/storage-provider.ts` is the media module's object-storage boundary. Callers depend on `StorageProvider`, never on the MinIO SDK. `tests/contracts/storage-provider.contract.ts` runs the same behavioral checks against the fake provider now and can be reused for the MinIO adapter in SK-0072.

| Operation       | Contract                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `upload`        | Streams an exact declared byte count to a new key; rejects overwrite and length mismatch. The media service generates keys. |
| `stat`          | Returns object metadata or `null` only when absent.                                                                         |
| `read`          | Streams the full object or an inclusive byte range; reports returned and total bytes.                                       |
| `signedReadUrl` | Creates a signed GET URL expiring in 1–900 seconds. The caller still decides whether the object may be exposed.             |
| `delete`        | Idempotent for an absent object.                                                                                            |
| `copy`          | Creates a new destination without overwrite, preserving the source.                                                         |
| `move`          | Copy then delete, without an atomicity guarantee across objects.                                                            |
| `health`        | Reports reachability/bucket readiness with stable, sanitized reason codes.                                                  |

Storage errors use stable `StorageError` codes and must not contain SDK responses, credentials, endpoints, object contents, or signed URLs. The configured bucket remains private; signed URL issuance must follow media authorization and processing-state checks. Callers must never log signed URLs.

For a partially failed `move`, the service must reconcile source/destination using `stat` before retrying or changing metadata. Cross-object move cannot be treated as a transaction. A failed copy must leave the source intact. The MinIO adapter must implement create-only semantics and stream length enforcement despite the underlying provider's default overwrite behavior. This task defines and tests the boundary; it does not yet wire a MinIO implementation or upload routes.
