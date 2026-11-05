# SIBS MB WAY sandbox webhook

`POST /api/payments/mbway/webhook` receives SIBS SPG sandbox notifications. The endpoint accepts the bounded Base64 encrypted body and the `X-Initialization-Vector` and `X-Authentication-Tag` headers. It decrypts and authenticates the AES-256-GCM payload before parsing the safe transaction fields. The webhook key is `MBWAY_WEBHOOK_SECRET` from SIBS SPG Backoffice and must never appear in client code or logs.

The decrypted payload may contain method-specific customer data such as an MB WAY mobile token. The handler discards those extra fields and stores only the provider transaction/event IDs, normalized payment status, amount, timestamp, and safe response code. SIBS notifications are delivered at least once, so `(provider, providerEventId)` is unique and duplicate events are handled idempotently. The endpoint returns the SIBS acknowledgement only after the event has been durably accepted and processed. Database failures and unmatched transaction IDs return an error so SIBS can retry delivery.

Processing atomically updates the Transaction, Order, audit record, and durable webhook inbox in a MongoDB transaction. A MongoDB replica set is required. The payment-result page also reconciles pending status with SIBS; the scheduler route remains a recovery path for stale transactions.

Configure the webhook in the SIBS sandbox Backoffice and use an HTTPS tunnel for local development. The exact sandbox environment, credentials, and scheduler configuration are documented in `docs/mbway-sandbox-integration.md`.
