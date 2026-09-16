# Password hashing

Shared, server-only Argon2id hashing, verification, and rehash-on-login support for administrator and customer identity modules. Parameters live in `password-policy.json` and currently use the [OWASP baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html): 19 MiB memory, two iterations, one parallel lane. Do not import this code into client or Edge code.

`verifyPassword()` reports success and whether Argon2 parameters changed. The identity modules use `verifyAndUpgradePassword()` with a compare-and-swap update against the old hash; a concurrent password change causes login verification to fail rather than overwriting the new hash. Rehashing the same password does not increment `passwordVersion`. Login orchestration, rate limits, and session issuance remain later tasks.

Run `pnpm password:benchmark` on the actual production-equivalent Node function runtime before launch and after changing the profile. See [`docs/password-hashing.md`](../../../docs/password-hashing.md) for the measured development result and release gate. Never log or persist plaintext passwords.
