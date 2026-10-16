# Customer security and privacy (SK-0180)

`/profile/sessions` is the protected, private Security navigation destination. It combines the existing current-password change form, paginated active-session list, individual/other-device revocation, and customer data export and account deletion entry points. The older `/profile/change-password` route remains usable; no password state is copied between sections.

## Sensitive-action policy

Password change verifies the current password. A self-service export or anonymization requires a **fresh password verification on that request**, regardless of session age. These operations are actor/IP rate-limited, require an active customer session plus same-origin/CSRF protection, and never log or persist the submitted password. Export moved from `GET /api/profile/export` to `POST` with `{currentPassword}`; the former GET path is not an export bypass. Account deletion remains `DELETE /api/profile`, now with `{currentPassword}`. A successful deletion anonymizes the account, revokes all sessions, and clears the browser cookie. Both actions target only the resolved customer, never a client-supplied ID.

Viewing/revoking sessions requires the active session, CSRF on mutation, ownership checks, and a separate rate limit. Revocation does not require another password under the current policy because it reduces account exposure. The page explains that required historical order/financial records remain under the retention policy. Export returns a private, no-store JSON download.

Recent security activity is omitted: a customer-safe activity feed and its privacy/retention policy have not been approved. The admin audit feed must not be repurposed as a customer endpoint.

Tests cover export/delete rejection without confirmation, protected methods and customer scoping, password confirmation and rate-limit invocation, and UI confirmation/recovery behavior.
