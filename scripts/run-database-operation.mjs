const operationDefinitions = Object.freeze({
  seed: {
    summary: "Seed deterministic application data",
    registration: "seed providers",
  },
  migrate: {
    summary: "Run ordered, idempotent data migrations",
    registration: "migration steps",
  },
  indexes: {
    summary: "Synchronize declared MongoDB indexes",
    registration: "Mongoose models",
  },
});

function printGeneralHelp() {
  console.log(`Sara Kitchen database operations

Usage:
  node scripts/run-database-operation.mjs <seed|migrate|indexes> [--plan|--apply|--help]

Safety:
  --plan   Describe work without changing data (default)
  --apply  Execute registered work; unavailable until persistence handlers are implemented
  --help   Show operation-specific help`);
}

function printOperationHelp(operation, definition) {
  console.log(`${definition.summary}

Usage:
  pnpm db:${operation} [--plan|--apply|--help]

Current foundation state:
  No ${definition.registration} are registered yet. Plan mode is safe and reports this state.
  Apply mode fails closed until the relevant persistence task supplies executable handlers.`);
}

function fail(message) {
  console.error(`Database operation error: ${message}`);
  process.exitCode = 1;
}

const [operation, mode = "--plan", ...unexpectedArguments] = process.argv.slice(2);

if (!operation || operation === "--help") {
  printGeneralHelp();
} else if (!Object.hasOwn(operationDefinitions, operation)) {
  fail(`unknown operation "${operation}". Expected seed, migrate, or indexes.`);
} else if (unexpectedArguments.length > 0) {
  fail(`unexpected arguments: ${unexpectedArguments.join(" ")}`);
} else {
  const definition = operationDefinitions[operation];

  switch (mode) {
    case "--help":
      printOperationHelp(operation, definition);
      break;
    case "--plan":
      console.log(
        `${definition.summary}: plan complete; 0 executable steps registered (${definition.registration} pending).`,
      );
      break;
    case "--apply":
      fail(
        `${operation} cannot apply because no ${definition.registration} are registered. ` +
          "Implement the persistence adapter before retrying.",
      );
      break;
    default:
      fail(`unknown mode "${mode}". Expected --plan, --apply, or --help.`);
  }
}
