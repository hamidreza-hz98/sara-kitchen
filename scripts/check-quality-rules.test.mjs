import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const eslintBin = path.resolve(path.dirname(require.resolve("eslint")), "..", "bin", "eslint.js");
const tscBin = path.resolve(path.dirname(require.resolve("typescript")), "..", "bin", "tsc");

function runNodeScript(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
  });
}

function createFixtureDirectory() {
  return fs.mkdtempSync(path.join(projectRoot, "quality-fixture-"));
}

function removeFixtureDirectory(directory) {
  const resolved = path.resolve(directory);
  const expectedPrefix = `${projectRoot}${path.sep}quality-fixture-`;

  if (!resolved.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to remove unexpected quality fixture path: ${resolved}`);
  }

  fs.rmSync(resolved, { recursive: true, force: true });
}

test("the strict TypeScript gate rejects a deliberate type violation", () => {
  const fixtureRoot = createFixtureDirectory();

  try {
    fs.writeFileSync(
      path.join(fixtureRoot, "tsconfig.json"),
      JSON.stringify({
        extends: "../tsconfig.json",
        compilerOptions: { incremental: false },
        files: ["./type-violation.ts"],
      }),
    );
    fs.writeFileSync(
      path.join(fixtureRoot, "type-violation.ts"),
      'const orderTotal: number = "not-a-number";\nexport { orderTotal };\n',
    );

    const result = runNodeScript(tscBin, [
      "--project",
      path.join(fixtureRoot, "tsconfig.json"),
      "--pretty",
      "false",
    ]);
    const output = `${result.stdout}${result.stderr}`;

    assert.notEqual(result.status, 0, output);
    assert.match(output, /Type 'string' is not assignable to type 'number'/);
  } finally {
    removeFixtureDirectory(fixtureRoot);
  }
});

test("type-aware ESLint rejects promise, switch, and type-import violations", () => {
  const fixtureRoot = createFixtureDirectory();

  try {
    const fixtureFile = path.join(fixtureRoot, "lint-violation.ts");
    fs.writeFileSync(
      fixtureFile,
      `
import { ClientEnvironment } from "../src/validations/env/client-schema";

type OrderStatus = "pending" | "paid" | "failed";
type EnvironmentSnapshot = ClientEnvironment;

async function persistOrder(): Promise<void> {}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "paid":
      return "Paid";
  }
}

persistOrder();
getStatusLabel("pending");

export type { EnvironmentSnapshot };
`,
    );

    const result = runNodeScript(eslintBin, [fixtureFile, "--no-cache"]);
    const output = `${result.stdout}${result.stderr}`;

    assert.notEqual(result.status, 0, output);
    assert.match(output, /@typescript-eslint\/consistent-type-imports/);
    assert.match(output, /@typescript-eslint\/no-floating-promises/);
    assert.match(output, /@typescript-eslint\/switch-exhaustiveness-check/);
  } finally {
    removeFixtureDirectory(fixtureRoot);
  }
});

test("the import-boundary command rejects a Client Component server import", () => {
  const fixtureFile = path.join(projectRoot, "src", "app", "quality-boundary-violation.ts");

  try {
    fs.writeFileSync(
      fixtureFile,
      '"use client";\nimport { validateEnvironment } from "@/server/environment-core";\nexport { validateEnvironment };\n',
    );

    const result = runNodeScript(path.join(scriptsRoot, "check-module-boundaries.mjs"), []);
    const output = `${result.stdout}${result.stderr}`;

    assert.notEqual(result.status, 0, output);
    assert.match(output, /Client Component imports server-only module/);
  } finally {
    fs.rmSync(fixtureFile, { force: true });
  }
});
