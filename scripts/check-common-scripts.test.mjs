import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const operationRunner = path.join(scriptsRoot, "run-database-operation.mjs");
const packageManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

const requiredScripts = [
  "dev",
  "build",
  "start",
  "lint",
  "format",
  "typecheck",
  "unit",
  "integration",
  "e2e",
  "seed",
  "migrate",
  "indexes",
  "verify",
  "readiness:check",
  "secrets:scan",
];

function runOperation(operation, mode) {
  return spawnSync(process.execPath, [operationRunner, operation, mode], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
  });
}

test("package.json exposes the complete common command surface", () => {
  for (const script of requiredScripts) {
    assert.equal(typeof packageManifest.scripts[script], "string", `missing script: ${script}`);
    assert.notEqual(packageManifest.scripts[script].trim(), "", `empty script: ${script}`);
  }
});

test("database operation plans and help execute without infrastructure", () => {
  for (const operation of ["seed", "migrate", "indexes"]) {
    const plan = runOperation(operation, "--plan");
    assert.equal(plan.status, 0, `${operation} plan failed:\n${plan.stdout}${plan.stderr}`);
    assert.match(plan.stdout, /plan complete; 0 executable steps registered/);

    const help = runOperation(operation, "--help");
    assert.equal(help.status, 0, `${operation} help failed:\n${help.stdout}${help.stderr}`);
    assert.match(help.stdout, new RegExp(`pnpm db:${operation}`));
  }
});

test("database operations fail closed when apply has no implementation", () => {
  for (const operation of ["seed", "migrate", "indexes"]) {
    const result = runOperation(operation, "--apply");
    assert.notEqual(result.status, 0, `${operation} unexpectedly reported an applied operation`);
    assert.match(result.stderr, /cannot apply because no .+ are registered/);
  }
});
