import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const operationRunner = path.join(projectRoot, "scripts", "run-database-operation.mjs");

function runOperation(operation: string, mode: "--apply" | "--help" | "--plan") {
  return spawnSync(process.execPath, [operationRunner, operation, mode], {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
  });
}

describe("database operation command contract", () => {
  for (const operation of ["seed", "migrate", "indexes"]) {
    it(`${operation} supports safe discovery and fails closed before implementation`, () => {
      const help = runOperation(operation, "--help");
      expect(help.status, `${help.stdout}${help.stderr}`).toBe(0);
      expect(help.stdout).toContain(`pnpm db:${operation}`);

      const plan = runOperation(operation, "--plan");
      expect(plan.status, `${plan.stdout}${plan.stderr}`).toBe(0);
      expect(plan.stdout).toContain("plan complete; 0 executable steps registered");

      const apply = runOperation(operation, "--apply");
      expect(apply.status).not.toBe(0);
      expect(apply.stderr).toMatch(/cannot apply because no .+ are registered/);
    });
  }
});
