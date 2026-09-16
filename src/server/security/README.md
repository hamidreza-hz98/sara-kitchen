# Password hashing

Shared, server-only Argon2id hashing and hash-format validation for administrator and customer identity modules. The parameters use the OWASP baseline of 19 MiB memory, two iterations, and one parallel lane. Authentication flows will add verification, rate limiting, and session handling in subsequent tasks. Never expose this module to client code.
