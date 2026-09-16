# Sessions

Owns hashed opaque session tokens, actor kind/identifier, expiry, last-seen metadata, revocation, and active-session queries. It deliberately stores polymorphic actor references without importing Admin or Customer models, preventing an authentication persistence cycle.

SK-0050 uses 32 random bytes encoded as a 43-character base64url bearer token. `issueSession()` returns that token only for the caller to place in the correct HttpOnly cookie; its `token` property is deliberately non-enumerable to prevent accidental object serialization/logging. MongoDB stores only its SHA-256 digest in a unique, default-unselected `tokenHash` field. Never pass raw tokens to audit events, errors, URLs, or persistence APIs. Token lookup must validate encoding before hashing.

The private model stores actor kind (`admin` or `customer`), opaque actor ObjectId, matching audience, shared creation/update timestamps, last-seen, absolute expiry, optional revocation timestamp/reason, and optional IP/user-agent metadata. Token hash and IP are hidden from ordinary queries and JSON. A compound index supports active-session lists and a TTL index removes expired rows eventually; authentication must check expiry and revocation on every request because TTL cleanup is asynchronous. The model enforces actor/audience agreement and coherent revocation state.

SK-0052 adds password-version snapshots, audience-bound lookup, a 30-minute idle timeout, last-seen updates at most once per five minutes, and token revocation. Admin login rotates a prior admin bearer; logout revokes it. These methods never return hashes or accept session tokens from URLs/bodies. The next authentication tasks extend lifecycle operations to customers, password resets, active-session management, and audit logging.
