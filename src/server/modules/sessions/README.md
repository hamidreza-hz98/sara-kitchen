# Sessions

Owns hashed opaque session tokens, actor kind/identifier, expiry, last-seen metadata, revocation, and active-session queries. It deliberately stores polymorphic actor references without importing Admin or Customer models, preventing an authentication persistence cycle.
