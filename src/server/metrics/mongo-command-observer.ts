import type { Connection } from "mongoose";

import { recordOperationalMetric } from "./operational-metrics";
import type { OperationalMetricInput } from "./operational-metrics";

type MongoClient = ReturnType<Connection["getClient"]>;
const observedClients = new WeakSet<MongoClient>();

/** Observe durations without ever reading commands, replies, connection URIs, or errors. */
export function observeMongoCommands(
  client: MongoClient,
  record: (metric: OperationalMetricInput) => void = recordOperationalMetric,
): void {
  if (observedClients.has(client)) return;
  observedClients.add(client);

  client.on("commandSucceeded", (event) => {
    record({
      name: "database.command",
      command: event.commandName,
      outcome: "success",
      unit: "ms",
      value: event.duration,
    });
  });
  client.on("commandFailed", (event) => {
    record({
      name: "database.command",
      command: event.commandName,
      outcome: "failure",
      unit: "ms",
      value: event.duration,
    });
  });
}
