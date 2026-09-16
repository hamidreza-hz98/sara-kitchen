import "server-only";

import http from "node:http";
import https from "node:https";

import { Client as MinioClient } from "minio";

import { connectToDatabase } from "@/server/database";
import { getServerEnvironment } from "@/server/environment";

import { checkReadiness } from "./readiness";

async function checkMongoDB(): Promise<boolean> {
  const connection = await connectToDatabase();
  const database = connection.db;
  if (!database) return false;
  const result: unknown = await database.admin().command({ ping: 1, maxTimeMS: 2_000 });
  return typeof result === "object" && result !== null && "ok" in result && result.ok === 1;
}

async function checkObjectStorage(signal: AbortSignal): Promise<boolean> {
  const environment = getServerEnvironment();
  const agent = environment.MINIO_USE_SSL
    ? new https.Agent({ keepAlive: false, timeout: 2_000 })
    : new http.Agent({ keepAlive: false, timeout: 2_000 });
  const client = new MinioClient({
    endPoint: environment.MINIO_ENDPOINT,
    port: environment.MINIO_PORT,
    useSSL: environment.MINIO_USE_SSL,
    accessKey: environment.MINIO_ACCESS_KEY,
    secretKey: environment.MINIO_SECRET_KEY,
    region: environment.MINIO_REGION,
    retryOptions: { disableRetry: true },
    transportAgent: agent,
  });
  signal.addEventListener("abort", () => agent.destroy(), { once: true });
  try {
    return await client.bucketExists(environment.MINIO_BUCKET);
  } finally {
    agent.destroy();
  }
}

export function getReadiness() {
  return checkReadiness({ mongodb: checkMongoDB, objectStorage: checkObjectStorage });
}
