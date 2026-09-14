# ADR-0004 — Use custom, audience-separated database sessions

- Status: Accepted
- Date: 2026-09-14
- Owners: Sara Kitchen engineering

## Context

Sara Kitchen has two materially different authenticated principals. Administrators have roles and
privileged dashboard access; customers manage profiles, addresses, carts, and orders. Both require
login, logout, password changes, forgotten-password flows, and active-session management. Admin and
customer identities remain in separate domain modules and collections.

Long-lived self-contained tokens make immediate revocation and an accurate active-session list hard.
Using one undifferentiated identity/session audience also increases the risk that a customer credential
is accepted by an administrator route.

## Decision

Implement custom opaque sessions owned by the Sessions module, with authentication orchestration in
Auth and identity/password ownership in Admins and Customers.

- Keep separate Admin and Customer identity collections. A shared session record stores
  `principalType` (`admin` or `customer`), opaque `principalId`, explicit `audience`, token hash,
  creation/expiry/last-seen timestamps, revocation data, and safe device metadata.
- Sessions never populate identity models. Auth resolves the principal through the appropriate public
  Admins or Customers API after Sessions validates the audience and token.
- Generate at least 256 bits of cryptographically random token material. Send the raw token only in the
  cookie; store a SHA-256 digest in MongoDB so a database read does not reveal bearer credentials.
- Use different cookie names and validation paths for admin and customer audiences. Production cookies
  use a `__Host-` prefix, `Secure`, `HttpOnly`, `Path=/`, an explicit `SameSite` policy, and no `Domain`.
  Local HTTP development uses clearly separate non-prefixed names because `__Host-` requires Secure.
- Accept session identifiers only from cookies, never URLs or request bodies. Validate token encoding
  and length before database access and compare digests safely.
- Use finite idle and absolute expirations, enforced in application policy and a MongoDB TTL cleanup
  index. TTL deletion is cleanup, not the authorization check.
- Rotate the session after authentication, password change/recovery, privilege change, and other
  security-sensitive transitions. Revoke affected sessions immediately and support logout-current and
  logout-all commands.
- Active-session APIs return safe metadata, never token hashes. Revocation and suspicious failures emit
  English audit events through the Logs public contract without recording secrets.
- Protect state-changing cookie-authenticated requests with origin checks and CSRF defenses appropriate
  to the transport. `SameSite` is defense in depth, not the sole control.
- Password reset tokens are separate, short-lived, single-use, hashed records; they are not sessions.
  Passwords use Argon2id and never share token secrets.

## Alternatives considered

### Stateless JWT sessions

Rejected as the primary browser session because revocation, active-device lists, forced logout, and
privilege changes would require extra state or short lifetimes that erase the operational simplicity.
Signed JWT/JWE remains available for narrowly defined integration tokens.

### Auth.js or another hosted authentication framework

Rejected for the initial implementation because the required dual-principal collections, explicit
roles, custom active-session UX, and module ownership would still require substantial adapter behavior.
This can be revisited if maintenance cost exceeds the value of control.

### One unified users collection and one cookie

Rejected because admin and customer lifecycles/data differ and audience separation is a valuable
defense against privilege confusion.

### Raw session tokens stored in MongoDB

Rejected because a database compromise would immediately expose reusable bearer credentials.

## Consequences

### Positive

- Immediate revocation, logout-all, and accurate active-session views are straightforward.
- Explicit audiences and cookie names reduce admin/customer credential confusion.
- Database disclosure does not directly reveal raw session tokens.
- Identity domains remain separate while session mechanics are reused.

### Costs and risks

- Most authenticated requests require a database lookup and careful connection reuse.
- Custom security code demands focused tests, threat review, rotation, expiry, and cookie discipline.
- TTL cleanup is asynchronous, so every read must still enforce expiry and revocation.
- Multi-device metadata and IP handling create privacy/retention responsibilities.

## Revisit when

- External identity providers, passkeys, enterprise SSO, or mobile API tokens become required.
- Session lookup latency becomes material after measurement.
- A mature authentication framework can meet all audience, revocation, and module-boundary needs with
  less security maintenance.

## References

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Modular-monolith dependency map](../architecture.md)
