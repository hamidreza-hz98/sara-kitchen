# MongoDB connection manager (SK-0035)

All server code opens MongoDB through `connectToDatabase()` from `@/server/database`. The function returns the active Mongoose `Connection`; callers must not call `mongoose.connect()` themselves. Request handlers, Server Components, actions, jobs, and webhooks reuse the connection and must never disconnect at the end of a request.

## Lifecycle and cache

The server-only entry point stores a deliberately narrow cache on `globalThis`. This survives Next.js development module reloads and warm serverless invocations within the same process. The cache contains the healthy connection, one shared in-flight promise, and a SHA-256 URI fingerprint. It does not retain an additional plaintext copy of the connection string.

Calls follow these rules:

1. return the cached connection when Mongoose reports `readyState === 1`;
2. return the same promise while a connection attempt is in flight, preventing pool storms;
3. clear failed or disconnected state so a later invocation can reconnect;
4. reject an unexpected URI change while the current connection is active;
5. disable Mongoose command buffering so repository mistakes fail instead of waiting indefinitely.

`disconnectFromDatabase()` exists only for graceful process shutdown and isolated tests. Calling it per request defeats pooling and increases latency. Deployment shutdown hooks may await it after the application stops accepting new work.

## Timeouts and pool defaults

The default connection policy uses:

| Setting                    |      Value | Purpose                                                        |
| -------------------------- | ---------: | -------------------------------------------------------------- |
| `serverSelectionTimeoutMS` |  5 seconds | Bound initial topology discovery and fail fast during outages. |
| `connectTimeoutMS`         | 10 seconds | Bound an individual socket connection attempt.                 |
| `socketTimeoutMS`          | 45 seconds | Bound inactive database operations.                            |
| `heartbeatFrequencyMS`     | 10 seconds | Detect topology health changes.                                |
| `maxIdleTimeMS`            | 30 seconds | Release idle sockets in serverless processes.                  |
| `minPoolSize`              |          0 | Avoid holding idle serverless capacity open.                   |
| `maxPoolSize`              |         10 | Bound connections per application process.                     |

These are process-level limits; production capacity planning must multiply `maxPoolSize` by the maximum number of concurrently warm application processes and remain below the Atlas connection limit.

## Error and secret policy

Connection failures throw `MongoDatabaseConnectionError` with the stable code `MONGODB_CONNECTION_FAILED`. The public error contains no driver message, hostname, username, password, query parameters, or raw URI. Future structured logging may record the stable code and safe operational context, but must not attach the original driver error or `MONGODB_URI`.

`MONGODB_URI` continues to be validated by the server environment schema and must never use a `NEXT_PUBLIC_` prefix. Server-only imports and the repository boundary checker prevent the manager from entering client bundles.

## Verification

`tests/integration/mongodb-connection.test.ts` starts an isolated MongoDB process and proves that reload-like manager instances share one connect call, parallel callers receive the same connection, a clean disconnect can reconnect and ping, rejected attempts reset for retry, and exposed errors contain no credentials. The test helper prefers `MONGOMS_SYSTEM_BINARY`, discovers the standard MongoDB 8.0 Windows installation, and otherwise uses a pinned archive version for CI.
