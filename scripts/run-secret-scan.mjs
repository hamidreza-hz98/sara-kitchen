import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GITLEAKS_VERSION = "8.30.1";
export const BUILD_SECRET_VARIABLES = Object.freeze([
  "MONGODB_URI",
  "AUTH_SESSION_SECRET",
  "AUTH_PASSWORD_RESET_SECRET",
  "SENTRY_AUTH_TOKEN",
  "TWILIO_RESET_AUTH_TOKEN",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MBWAY_API_KEY",
  "MBWAY_WEBHOOK_SECRET",
  "WHATSAPP_ACCESS_TOKEN",
]);

const releaseArtifacts = Object.freeze({
  "darwin-arm64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_darwin_arm64.tar.gz`,
    sha256: "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  },
  "darwin-x64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_darwin_x64.tar.gz`,
    sha256: "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
  },
  "linux-arm64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz`,
    sha256: "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  },
  "linux-x64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz`,
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  },
  "win32-arm64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_windows_arm64.zip`,
    sha256: "b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f",
  },
  "win32-x64": {
    archive: `gitleaks_${GITLEAKS_VERSION}_windows_x64.zip`,
    sha256: "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
  },
});

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const configPath = path.join(projectRoot, ".gitleaks.toml");
const releaseBase = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}`;

export function resolveReleaseArtifact(platform = process.platform, architecture = process.arch) {
  const key = `${platform}-${architecture}`;
  const artifact = releaseArtifacts[key];
  if (!artifact) {
    throw new Error(`Gitleaks ${GITLEAKS_VERSION} is not pinned for ${key}.`);
  }
  return { ...artifact, key };
}

export function createScanPlan(scope = "all") {
  if (!new Set(["all", "repository", "build"]).has(scope)) {
    throw new Error("Secret scan scope must be all, repository, or build.");
  }
  return {
    history: scope !== "build",
    worktree: scope !== "build",
    build: scope !== "repository",
  };
}

async function downloadFile(url, destination) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Gitleaks download failed with HTTP ${response.status}.`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()), { mode: 0o600 });
}

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function resolveGitleaksBinary() {
  if (process.env.GITLEAKS_PATH) {
    const configured = path.resolve(process.env.GITLEAKS_PATH);
    if (!fs.existsSync(configured)) throw new Error("GITLEAKS_PATH does not exist.");
    return configured;
  }

  const executableName = process.platform === "win32" ? "gitleaks.exe" : "gitleaks";
  const artifact = resolveReleaseArtifact();
  const toolRoot = path.join(
    os.tmpdir(),
    "sara-kitchen-tools",
    "gitleaks",
    GITLEAKS_VERSION,
    artifact.key,
  );
  const executable = path.join(toolRoot, executableName);
  fs.mkdirSync(toolRoot, { recursive: true, mode: 0o700 });
  const archivePath = path.join(toolRoot, artifact.archive);
  if (!fs.existsSync(archivePath) || sha256(archivePath) !== artifact.sha256) {
    const partialPath = `${archivePath}.partial`;
    fs.rmSync(partialPath, { force: true });
    await downloadFile(`${releaseBase}/${artifact.archive}`, partialPath);
    const actualChecksum = sha256(partialPath);
    if (actualChecksum !== artifact.sha256) {
      fs.rmSync(partialPath, { force: true });
      throw new Error(`Gitleaks download checksum mismatch for ${artifact.archive}.`);
    }
    fs.rmSync(archivePath, { force: true });
    fs.renameSync(partialPath, archivePath);
  }

  // Re-extract from the checksum-verified archive on every run so a modified cached executable
  // cannot silently bypass scanning.
  const extractArguments = artifact.archive.endsWith(".zip")
    ? ["-xf", archivePath, "-C", toolRoot]
    : ["-xzf", archivePath, "-C", toolRoot];
  const extraction = spawnSync("tar", extractArguments, { encoding: "utf8" });
  if (extraction.status !== 0 || !fs.existsSync(executable)) {
    throw new Error(`Could not extract the verified Gitleaks archive: ${extraction.stderr}`);
  }
  if (process.platform !== "win32") fs.chmodSync(executable, 0o700);
  return executable;
}

function runGit(...arguments_) {
  return execFileSync("git", arguments_, { cwd: projectRoot, encoding: "utf8" });
}

function copyFileIntoSnapshot(source, destinationRoot, relativePath) {
  const destination = path.join(destinationRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function createWorktreeSnapshot(snapshotRoot) {
  const files = runGit("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean);
  for (const relativePath of files) {
    const source = path.join(projectRoot, relativePath);
    if (fs.statSync(source, { throwIfNoEntry: false })?.isFile()) {
      copyFileIntoSnapshot(source, snapshotRoot, relativePath);
    }
  }
}

function copyDirectoryIfPresent(source, destination) {
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true });
}

function createBuildSnapshot(snapshotRoot) {
  const buildRoot = path.join(projectRoot, ".next");
  if (!fs.existsSync(path.join(buildRoot, "BUILD_ID"))) {
    throw new Error(
      "No production .next build found. Run `pnpm build` before the build secret scan.",
    );
  }
  copyDirectoryIfPresent(path.join(buildRoot, "server"), path.join(snapshotRoot, "server"));
  copyDirectoryIfPresent(path.join(buildRoot, "static"), path.join(snapshotRoot, "static"));
  copyDirectoryIfPresent(path.join(buildRoot, "standalone"), path.join(snapshotRoot, "standalone"));
  for (const entry of fs.readdirSync(buildRoot, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith(".json") || entry.name === "BUILD_ID")) {
      copyFileIntoSnapshot(path.join(buildRoot, entry.name), snapshotRoot, entry.name);
    }
  }
}

export function assertConfiguredSecretsAbsent(snapshotRoot) {
  const configuredSecrets = BUILD_SECRET_VARIABLES.map((name) => ({
    name,
    value: process.env[name],
  })).filter(({ value }) => typeof value === "string" && value.length >= 8);
  if (configuredSecrets.length === 0) return;

  const pending = [snapshotRoot];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const contents = fs.readFileSync(entryPath);
      for (const secret of configuredSecrets) {
        if (contents.includes(Buffer.from(secret.value))) {
          throw new Error(
            `Deployable build output contains the configured ${secret.name} value. Rotate it if this artifact was shared.`,
          );
        }
      }
    }
  }
}

function scan(gitleaks, target, label, command = "dir", additionalArguments = []) {
  process.stdout.write(`Scanning ${label}...\n`);
  const result = spawnSync(
    gitleaks,
    [
      command,
      "--config",
      configPath,
      "--no-banner",
      "--no-color",
      "--redact=100",
      "--verbose",
      "--max-archive-depth=1",
      "--max-decode-depth=2",
      "--max-target-megabytes=50",
      "--timeout=300",
      ...additionalArguments,
      target,
    ],
    { cwd: projectRoot, encoding: "utf8", stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Gitleaks rejected ${label}.`);
}

export async function runSecretScan(scope = "all") {
  const plan = createScanPlan(scope);
  const gitleaks = await resolveGitleaksBinary();
  if (plan.history) {
    scan(gitleaks, projectRoot, "all Git refs and history", "git", ["--log-opts=--all"]);
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sara-kitchen-secret-scan-"));
  try {
    if (plan.worktree) {
      const worktreeSnapshot = path.join(temporaryRoot, "worktree");
      fs.mkdirSync(worktreeSnapshot);
      createWorktreeSnapshot(worktreeSnapshot);
      scan(gitleaks, worktreeSnapshot, "tracked and unignored working-tree files");
    }
    if (plan.build) {
      const buildSnapshot = path.join(temporaryRoot, "build");
      fs.mkdirSync(buildSnapshot);
      createBuildSnapshot(buildSnapshot);
      assertConfiguredSecretsAbsent(buildSnapshot);
      scan(gitleaks, buildSnapshot, "deployable Next.js build output");
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
  process.stdout.write("Secret scan passed.\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSecretScan(process.argv[2] ?? "all").catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
