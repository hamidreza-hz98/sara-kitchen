import type { ClientSession, Connection } from "mongoose";

/** Fail closed: a standalone server cannot atomically commit checkout collections. */
export class MongoTransactionUnavailableError extends Error {
  readonly code = "MONGODB_TRANSACTIONS_UNAVAILABLE";

  constructor() {
    super("MongoDB transactions require a replica set or sharded cluster.");
    this.name = "MongoTransactionUnavailableError";
  }
}

/**
 * One workflow owns one transaction. Pass its session explicitly to every
 * participating repository write; never call providers inside the callback.
 */
export async function withMongoTransaction<Result>(
  connection: Connection,
  work: (session: ClientSession) => Promise<Result>,
): Promise<Result> {
  const topology: unknown = await connection.db?.admin().command({ hello: 1 });
  if (
    !topology ||
    typeof topology !== "object" ||
    (!("setName" in topology) && !("msg" in topology && topology.msg === "isdbgrid"))
  ) {
    throw new MongoTransactionUnavailableError();
  }

  return connection.transaction(work, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
}
