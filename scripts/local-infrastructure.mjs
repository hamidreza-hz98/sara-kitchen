import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const composeFile = path.join(projectRoot, "compose.yaml");
const baseArguments = ["compose", "--file", composeFile, "--project-name", "sara-kitchen"];

function printHelp() {
  console.log(`Sara Kitchen local infrastructure

Usage:
  node scripts/local-infrastructure.mjs <up|down|status|logs|config|help>

Commands:
  up      Build/start MongoDB and MinIO, wait for health, and create the media bucket
  down    Stop containers and the network while preserving named volumes
  status  Show current Compose service state
  logs    Print the latest 100 service log lines
  config  Validate and render the resolved Compose model
  help    Show this message`);
}

function runDocker(arguments_) {
  const result = spawnSync("docker", [...baseArguments, ...arguments_], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error) {
    console.error(
      "Docker CLI is unavailable. Install and start Docker Desktop (Compose v2), then retry.",
    );
    process.exitCode = 1;
    return false;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

const [command = "help", ...unexpectedArguments] = process.argv.slice(2);

if (unexpectedArguments.length > 0) {
  console.error(`Unexpected arguments: ${unexpectedArguments.join(" ")}`);
  process.exitCode = 1;
} else {
  switch (command) {
    case "up":
      if (runDocker(["up", "--detach", "--wait", "--wait-timeout", "180", "mongo", "minio"])) {
        runDocker(["run", "--rm", "minio-init"]);
      }
      break;
    case "down":
      runDocker(["down", "--remove-orphans"]);
      break;
    case "status":
      runDocker(["ps"]);
      break;
    case "logs":
      runDocker(["logs", "--tail", "100", "mongo", "minio"]);
      break;
    case "config":
      runDocker(["config"]);
      break;
    case "help":
    case "--help":
      printHelp();
      break;
    default:
      console.error(
        `Unknown command "${command}". Expected up, down, status, logs, config, or help.`,
      );
      process.exitCode = 1;
  }
}
