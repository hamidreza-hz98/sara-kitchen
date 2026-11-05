# SIBS MB WAY sandbox

The checkout uses the SIBS SPG server-to-server MB WAY flow. It is pinned in code and environment validation to `https://spg.qly.site1.sibs.pt/api/v2`; local and production deployments both use this sandbox host. The production SIBS host is rejected, so this integration cannot collect live funds.

## Configure credentials

Request SIBS SPG sandbox access and the MB WAY product for the merchant. Configure these server-only environment values in `.env.local` for local development and in the deployment environment for production:

```dotenv
MBWAY_ENABLED=true
MBWAY_API_URL=https://spg.qly.site1.sibs.pt/api/v2
MBWAY_TERMINAL_ID=your-sandbox-terminal-id
MBWAY_CLIENT_ID=your-sandbox-client-id
MBWAY_AUTH_TOKEN=your-sandbox-bearer-token
MBWAY_WEBHOOK_SECRET=your-base64-encoded-32-byte-aes-key
```

Keep `MBWAY_ENABLED=false` until the real sandbox credentials are installed. `MBWAY_WEBHOOK_SECRET` is the AES-GCM key from SIBS SPG Backoffice's webhook configuration. Never use production credentials or expose these values to the browser.

## Checkout and payment state

Checkout creates the local order and transaction first, then creates the SIBS payment session. It saves SIBS' transaction ID before requesting MB WAY authorization, and sends the validated Portuguese mobile alias to the sandbox. Checkout is considered pending until a verified status inquiry or webhook confirms a final outcome. The customer payment-result page also polls SIBS while the local transaction is still pending.

Configure SIBS merchant notifications to call `POST /api/payments/mbway/webhook` over HTTPS. SIBS sends a Base64 encrypted body with `X-Initialization-Vector` and `X-Authentication-Tag`; the endpoint authenticates and decrypts it with AES-256-GCM, stores only validated event fields, processes duplicate deliveries idempotently, and returns SIBS' required acknowledgement.

Keep the internal reconciliation scheduler enabled as a recovery path. Call `POST /api/internal/payments/reconcile` with `Authorization: Bearer <PAYMENT_RECONCILIATION_CRON_SECRET>` on a five-minute schedule. The request performs status inquiries for stale pending transactions and applies verified state changes to the related order.

## Sandbox verification

Use SIBS' sandbox simulator and test aliases supplied with the merchant onboarding. Local webhooks need an HTTPS tunnel configured in the SIBS sandbox backoffice. Without valid SIBS sandbox credentials and an enabled MB WAY sandbox product, the app intentionally keeps checkout disabled; no simulator or fabricated payment success is substituted.
