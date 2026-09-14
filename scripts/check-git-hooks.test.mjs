import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const hooksPath = path.join(projectRoot, ".husky", "_");

function runGit(repository, arguments_) {
  return spawnSync("git", arguments_, {
    cwd: repository,
    encoding: "utf8",
    env: process.env,
  });
}

function assertGitSuccess(result, operation) {
  assert.equal(result.status, 0, `${operation} failed:\n${result.stdout}${result.stderr}`);
}

function removeFixtureDirectory(directory) {
  const resolved = path.resolve(directory);
  const expectedPrefix = `${projectRoot}${path.sep}hook-fixture-`;

  if (!resolved.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to remove unexpected hook fixture path: ${resolved}`);
  }

  fs.rmSync(resolved, { recursive: true, force: true });
}

test("pre-commit rejects malformed staged source and preserves unrelated work", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(projectRoot, "hook-fixture-"));
  const candidatePath = path.join(fixtureRoot, "candidate.ts");
  const unrelatedPath = path.join(fixtureRoot, "unrelated.md");

  try {
    assertGitSuccess(runGit(fixtureRoot, ["init", "--initial-branch=master"]), "git init");
    assertGitSuccess(runGit(fixtureRoot, ["config", "user.name", "Sara Kitchen CI"]), "git user");
    assertGitSuccess(
      runGit(fixtureRoot, ["config", "user.email", "ci@sara-kitchen.invalid"]),
      "git email",
    );
    assertGitSuccess(runGit(fixtureRoot, ["config", "commit.gpgsign", "false"]), "git signing");
    assertGitSuccess(runGit(fixtureRoot, ["config", "core.autocrlf", "false"]), "git line endings");
    assertGitSuccess(runGit(fixtureRoot, ["config", "core.hooksPath", hooksPath]), "git hooks");

    fs.writeFileSync(candidatePath, "export const initial = true;\n");
    fs.writeFileSync(unrelatedPath, "Initial note.\n");
    assertGitSuccess(runGit(fixtureRoot, ["add", "."]), "stage baseline");
    assertGitSuccess(
      runGit(fixtureRoot, ["commit", "--no-verify", "-m", "test: create baseline"]),
      "baseline commit",
    );

    const unrelatedDraft = "Owner draft that must remain untouched.\n";
    fs.writeFileSync(unrelatedPath, unrelatedDraft);
    fs.writeFileSync(candidatePath, "export const broken: = ;\n");
    assertGitSuccess(runGit(fixtureRoot, ["add", "candidate.ts"]), "stage invalid source");

    const invalidCommit = runGit(fixtureRoot, ["commit", "-m", "test: reject invalid source"]);
    assert.notEqual(
      invalidCommit.status,
      0,
      `malformed source was committed:\n${invalidCommit.stdout}${invalidCommit.stderr}`,
    );
    assert.equal(fs.readFileSync(unrelatedPath, "utf8"), unrelatedDraft);
    assert.equal(runGit(fixtureRoot, ["rev-list", "--count", "HEAD"]).stdout.trim(), "1");

    fs.writeFileSync(candidatePath, 'export const valid={message:"ok"}\n');
    assertGitSuccess(runGit(fixtureRoot, ["add", "candidate.ts"]), "stage valid source");
    const validCommit = runGit(fixtureRoot, ["commit", "-m", "test: accept valid source"]);
    assertGitSuccess(validCommit, "valid commit");

    assert.equal(runGit(fixtureRoot, ["rev-list", "--count", "HEAD"]).stdout.trim(), "2");
    assert.equal(
      runGit(fixtureRoot, ["show", "HEAD:candidate.ts"]).stdout,
      'export const valid = { message: "ok" };\n',
    );
    assert.equal(fs.readFileSync(unrelatedPath, "utf8"), unrelatedDraft);
    assert.equal(runGit(fixtureRoot, ["status", "--short"]).stdout, " M unrelated.md\n");
  } finally {
    removeFixtureDirectory(fixtureRoot);
  }
});
