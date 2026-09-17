import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertConfiguredSecretsAbsent,
  BUILD_SECRET_VARIABLES,
  createScanPlan,
  GITLEAKS_VERSION,
  resolveReleaseArtifact,
} from "./run-secret-scan.mjs";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const workflow = fs.readFileSync(
  path.join(projectRoot, ".github/workflows/secret-scan.yml"),
  "utf8",
);

test("pins Gitleaks archives and rejects unsupported runtime targets", () => {
  assert.equal(GITLEAKS_VERSION, "8.30.1");
  assert.match(resolveReleaseArtifact("win32", "x64").archive, /windows_x64\.zip$/);
  assert.match(resolveReleaseArtifact("linux", "x64").sha256, /^[a-f0-9]{64}$/);
  assert.throws(() => resolveReleaseArtifact("aix", "ppc64"), /not pinned/);
});

test("separates repository and deployable-build scan scopes", () => {
  assert.deepEqual(createScanPlan("repository"), {
    history: true,
    worktree: true,
    build: false,
  });
  assert.deepEqual(createScanPlan("build"), { history: false, worktree: false, build: true });
  assert.deepEqual(createScanPlan("all"), { history: true, worktree: true, build: true });
  assert.throws(() => createScanPlan("staged"), /scope must be/);
});

test("checks every configured authentication and provider secret in build output", () => {
  assert.deepEqual(BUILD_SECRET_VARIABLES, [
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
});

test("rejects an exact configured secret in deployable output without printing its value", () => {
  const fixture = fs.mkdtempSync(path.join(projectRoot, "secret-scan-fixture-"));
  const previous = process.env.AUTH_SESSION_SECRET;
  const canary = "unit-only-A7vQ2mN9xK4pR8sT6wY3zB5dF1hJ";
  try {
    process.env.AUTH_SESSION_SECRET = canary;
    fs.writeFileSync(path.join(fixture, "server.js"), `export const leaked = "${canary}";`);
    assert.throws(
      () => assertConfiguredSecretsAbsent(fixture),
      (error) =>
        error instanceof Error &&
        error.message.includes("AUTH_SESSION_SECRET") &&
        !error.message.includes(canary),
    );
  } finally {
    if (previous === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = previous;
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("exposes secret gates and a full-history CI scan", () => {
  assert.equal(manifest.scripts["secrets:scan"], "node scripts/run-secret-scan.mjs all");
  assert.equal(
    manifest.scripts["secrets:scan:repository"],
    "node scripts/run-secret-scan.mjs repository",
  );
  assert.equal(manifest.scripts["secrets:scan:build"], "node scripts/run-secret-scan.mjs build");
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /pnpm secrets:scan/);
  assert.match(workflow, /AUTH_SESSION_SECRET: ci-session-canary-/);
});
