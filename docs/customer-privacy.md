# Customer management and privacy

SK-0127 adds administrator management APIs and customer self-service profile/privacy APIs.

## Authorization and PII

| Operation                             | Principal     | Required access                                                     |
| ------------------------------------- | ------------- | ------------------------------------------------------------------- |
| List/detail                           | Administrator | `customers:read`; contact fields require `customers:read-sensitive` |
| Update profile/status                 | Administrator | `customers:update`                                                  |
| Export another account                | Administrator | `customers:read-sensitive`                                          |
| Anonymize another account             | Administrator | `customers:delete`                                                  |
| Read/update/export/delete own account | Customer      | Active session and exact ownership                                  |

All mutations use same-origin and CSRF checks. UI visibility is not an authorization boundary. Password hashes and password versions never enter DTOs or exports. A changed mobile or email loses its verification timestamp.

## Deletion and retention

Account deletion is an irreversible anonymization, not a physical document removal. The service:

1. replaces name and mobile with non-contact placeholders;
2. removes email, verification state, and marketing consent;
3. increments the password version and revokes every active session;
4. records deletion/anonymization timestamps and soft-delete actor metadata;
5. retains the opaque customer ID so immutable order snapshots, invoice history, and audit references remain valid.

When historical orders exist, `privacyRetentionReason` is `historical_orders`; otherwise it is `privacy_request`. Both paths remove direct PII and return `hardDeleted: false`. An anonymized account cannot be reactivated or edited.

## Export

Exports contain the customer's safe profile/consent state and an Orders-owned allow-listed projection of order history. Provider secrets, payment credentials, password data, session tokens, and internal MongoDB identifiers are excluded. Export and anonymization generate canonical English audit events without embedding the exported data.
