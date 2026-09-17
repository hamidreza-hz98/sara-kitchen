import "server-only";

import mongoose from "mongoose";

import { getServerEnvironment } from "@/server/environment";
import { observeMongoCommands } from "@/server/metrics/mongo-command-observer";

import {
  createMongoConnectionCache,
  createMongoConnectionManager,
  type MongoConnectionCache,
} from "./connection-manager";

declare global {
  // `var` is required for a typed property shared by Next.js development module reloads.
  var __saraKitchenMongoConnectionCache: MongoConnectionCache | undefined;
}

const cache =
  globalThis.__saraKitchenMongoConnectionCache ??
  (globalThis.__saraKitchenMongoConnectionCache = createMongoConnectionCache());

const manager = createMongoConnectionManager({
  cache,
  getUri: () => getServerEnvironment().MONGODB_URI,
  mongooseClient: mongoose,
});

/** Reuse this process's healthy connection or in-flight connection attempt. */
export async function connectToDatabase() {
  const connection = await manager.connect();
  observeMongoCommands(connection.getClient());
  return connection;
}

/**
 * Close the process connection during graceful shutdown and isolated tests only.
 * Serverless request handlers must not disconnect after individual requests.
 */
export const disconnectFromDatabase = manager.disconnect;

export { MongoDatabaseConnectionError } from "./connection-manager";
export { MongoTransactionUnavailableError, withMongoTransaction } from "./transaction-boundary";
export {
  createListQueryControls,
  escapeSearchPattern,
  pageResult,
  type ListQueryConfig,
  type ListQueryPlan,
  type PageMetadata,
} from "./query-controls";
export * from "./schema";
