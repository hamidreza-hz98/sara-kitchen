import { createHash } from "node:crypto";

import type { Connection, ConnectOptions, Mongoose } from "mongoose";

export const DEFAULT_MONGODB_CONNECT_OPTIONS = Object.freeze({
  connectTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 5_000,
  socketTimeoutMS: 45_000,
  heartbeatFrequencyMS: 10_000,
  maxIdleTimeMS: 30_000,
  maxPoolSize: 10,
  minPoolSize: 0,
  monitorCommands: true,
}) satisfies Readonly<ConnectOptions>;

export type MongoConnectionCache = {
  connection: Connection | null;
  promise: Promise<Connection> | null;
  uriFingerprint: string | null;
};

export type MongoConnectionManager = {
  connect: () => Promise<Connection>;
  disconnect: () => Promise<void>;
};

type MongoConnectionManagerOptions = {
  cache: MongoConnectionCache;
  connectOptions?: Readonly<ConnectOptions>;
  getUri: () => string;
  mongooseClient: Mongoose;
};

export class MongoDatabaseConnectionError extends Error {
  readonly code = "MONGODB_CONNECTION_FAILED";

  constructor() {
    super(
      "MongoDB connection failed within the configured timeouts. Check service health and server configuration.",
    );
    this.name = "MongoDatabaseConnectionError";
  }
}

export function createMongoConnectionCache(): MongoConnectionCache {
  return { connection: null, promise: null, uriFingerprint: null };
}

function fingerprintUri(uri: string) {
  return createHash("sha256").update(uri).digest("hex");
}

function isConnected(connection: Connection | null): connection is Connection {
  return connection?.readyState === 1;
}

export function createMongoConnectionManager({
  cache,
  connectOptions,
  getUri,
  mongooseClient,
}: MongoConnectionManagerOptions): MongoConnectionManager {
  const options = { ...DEFAULT_MONGODB_CONNECT_OPTIONS, ...connectOptions };

  const connect = async (): Promise<Connection> => {
    const uri = getUri();
    const uriFingerprint = fingerprintUri(uri);

    if (isConnected(cache.connection) && cache.uriFingerprint === uriFingerprint) {
      return cache.connection;
    }

    if (cache.promise && cache.uriFingerprint === uriFingerprint) {
      return cache.promise;
    }

    if (
      cache.uriFingerprint &&
      cache.uriFingerprint !== uriFingerprint &&
      (cache.promise || (cache.connection && cache.connection.readyState !== 0))
    ) {
      throw new MongoDatabaseConnectionError();
    }

    cache.connection = null;
    cache.uriFingerprint = uriFingerprint;
    mongooseClient.set("bufferCommands", false);

    const pendingConnection = mongooseClient
      .connect(uri, options)
      .then((connectedClient) => {
        cache.connection = connectedClient.connection;
        return connectedClient.connection;
      })
      .catch(async () => {
        cache.connection = null;

        try {
          await mongooseClient.disconnect();
        } catch {
          // The public error remains stable and secret-free even if cleanup also fails.
        }

        if (cache.promise === pendingConnection) {
          cache.uriFingerprint = null;
        }

        throw new MongoDatabaseConnectionError();
      })
      .finally(() => {
        if (cache.promise === pendingConnection) {
          cache.promise = null;
        }
      });

    cache.promise = pendingConnection;
    return pendingConnection;
  };

  const disconnect = async (): Promise<void> => {
    const pendingConnection = cache.promise;
    if (pendingConnection) {
      try {
        await pendingConnection;
      } catch {
        // A rejected connect already resets the cache and exposes a sanitized error.
      }
    }

    if (mongooseClient.connection.readyState !== 0) {
      await mongooseClient.disconnect();
    }

    cache.connection = null;
    cache.promise = null;
    cache.uriFingerprint = null;
  };

  return { connect, disconnect };
}
