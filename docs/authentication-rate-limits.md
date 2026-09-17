# Authentication rate limits

Authentication throttles are stored in MongoDB so serverless instances enforce one shared policy. Every bucket key is HMAC-SHA256 digested with the server-only session secret and a domain-separated scope; raw IP addresses, identifiers, actor IDs, reset tokens, and passwords are never stored in limiter records.

## Policies

| Operation                      | Independent buckets                  | Window     | Limit |
| ------------------------------ | ------------------------------------ | ---------- | ----: |
| Administrator login            | source IP                            | 15 minutes |    20 |
| Administrator login            | normalized identifier                | 15 minutes |     7 |
| Customer login                 | source IP                            | 15 minutes |    40 |
| Customer login                 | normalized mobile/email              | 15 minutes |    10 |
| Customer signup                | source IP                            | 1 hour     |    30 |
| Customer signup                | normalized mobile and optional email | 1 hour     |     5 |
| Password-reset request         | source IP                            | 1 hour     |    20 |
| Password-reset request         | normalized mobile/email              | 1 hour     |     5 |
| Password-reset completion      | source IP                            | 1 hour     |    30 |
| Password-reset completion      | submitted opaque reset token         | 1 hour     |     8 |
| Future identity verification   | source IP                            | 1 hour     |    20 |
| Future identity verification   | normalized mobile/email              | 1 hour     |     6 |
| Customer password change       | source IP                            | 1 hour     |    20 |
| Customer password change       | authenticated actor                  | 1 hour     |     5 |
| Active-session mutation/action | source IP                            | 15 minutes |    60 |
| Active-session mutation/action | authenticated admin/customer actor   | 15 minutes |    30 |

IP and identity/actor buckets are deliberately independent. A combined `IP + identifier` key alone would permit password spraying by changing identifiers, while an identifier-only key would make account denial-of-service too easy. Successful and failed attempts both consume capacity so account existence and credential validity cannot affect limiter behavior.

## Client and privacy contract

Limits return the shared API `429` envelope with a positive `Retry-After` header and `details.retryAfterSeconds`. Retry values are rounded up to a minute and never disclose which bucket fired, remaining attempts, whether the identifier exists, or whether a password/token was correct. Login and recovery errors remain generic.

The trusted deployment proxy must overwrite `X-Forwarded-For`. Invalid or absent addresses use one `unknown` bucket and therefore fail closed. A deployment without a trusted overwriting proxy must not be launched because client-supplied forwarding headers could bypass or poison IP buckets.

MongoDB uniquely indexes each opaque window key and TTL-cleans expired records. TTL timing is not part of enforcement: every request derives the active fixed window and atomically increments it. The unique index resolves concurrent first writes. The verification limiter is ready for the future verification endpoint and must be consumed before any identity lookup or provider message.

References: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), and [OWASP Bot Management and Anti-Automation](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html).
