# Health and readiness (SK-0046)

The app exposes two unauthenticated, no-store JSON endpoints through the shared API contract:

| Endpoint          | Meaning                                             | Healthy                       | Failed                              |
| ----------------- | --------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `GET /api/health` | Process liveness; does not contact MongoDB or MinIO | `200`, `data.status: "ok"`    | A non-2xx process/framework failure |
| `GET /api/ready`  | Required dependency readiness                       | `200`, `data.status: "ready"` | `503`, `SERVICE_UNAVAILABLE`        |

Readiness independently opens/reuses the MongoDB connection and runs an admin `ping`; it checks the configured MinIO bucket with authenticated `bucketExists`. A missing bucket, invalid storage credentials, MongoDB outage, failed ping, or timeout produces an `unavailable` state. Both checks run concurrently with a three-second response bound. The MinIO probe disables SDK retries and destroys its short-lived agent on completion or timeout. The MongoDB connection manager has its own bounded connection timeouts; a timed-out readiness request does not disconnect a shared connection that may serve other requests.

The public readiness body contains only `mongodb` and `objectStorage` values of `ready` or `unavailable`. It never includes connection strings, bucket names, hostnames, access keys, driver exceptions, or stack traces. API responses retain `x-request-id` and `Cache-Control: no-store`. Readiness is a dependency availability check, not proof that production indexes, replica-set transactions, payment credentials, or business workflows are configured correctly; those have separate launch gates.

Example healthy body:

```json
{
  "ok": true,
  "data": { "status": "ready", "dependencies": { "mongodb": "ready", "objectStorage": "ready" } },
  "requestId": "..."
}
```

An unhealthy response is `503` with `error.type: "unavailable"`, `error.code: "SERVICE_UNAVAILABLE"`, and the same sanitized `dependencies` map under `error.details`. An orchestrator should use `/api/health` only for liveness and `/api/ready` to gate traffic or promotion. Do not restart a healthy process simply because an external service has a temporary outage.

The deployment check exits 0 only when `/api/ready` returns 200 with both dependencies ready; it exits 1 otherwise and prints no URL or provider error details:

```powershell
pnpm readiness:check http://localhost:3000
pnpm readiness:check https://your-preview.example
```

Run it after starting the app and local services, and against a preview deployment before promotion. It is not part of `pnpm verify`, because that deterministic gate does not require externally running services. The MinIO identity used by the application must be allowed to test bucket existence. Protect production readiness from excessive public polling at the edge if necessary, without adding credentials to URL query strings.

Unit tests cover timeouts, provider exception redaction, and the actual MinIO bucket/MongoDB ping calls; Route Handler tests cover 200/503 and liveness separation; CLI tests cover success and failing process exit codes.

References: [MongoDB `ping`](https://www.mongodb.com/docs/manual/reference/command/ping/), [MinIO JavaScript SDK `bucketExists`](https://docs.min.io/aistor/developers/sdk/javascript/), and [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
