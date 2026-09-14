import { MongoMemoryServer } from "mongodb-memory-server-core";

export interface TestMongoDatabase {
  uri: string;
  stop: () => Promise<void>;
}

export async function startTestMongoDatabase(
  databaseName = "sara-kitchen-test",
): Promise<TestMongoDatabase> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to start an in-memory MongoDB server in production.");
  }

  const server = await MongoMemoryServer.create({
    instance: { dbName: databaseName },
  });

  return {
    uri: server.getUri(),
    stop: async () => {
      await server.stop();
    },
  };
}
