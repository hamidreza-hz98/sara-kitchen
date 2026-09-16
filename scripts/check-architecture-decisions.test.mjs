import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const adrRoot = path.join(projectRoot, "docs", "adr");
const index = fs.readFileSync(path.join(adrRoot, "README.md"), "utf8");
const expectedFiles = [
  "0001-nextjs-app-router.md",
  "0002-modular-monolith.md",
  "0003-embedded-translations.md",
  "0004-custom-principal-sessions.md",
  "0005-integer-money.md",
  "0006-minio-object-storage.md",
  "0007-production-deployment-target.md",
  "0008-transaction-boundaries.md",
];
const requiredSections = ["Context", "Decision", "Alternatives considered", "Consequences"];

test("the ADR inventory is complete, ordered, and indexed", () => {
  const actualFiles = fs
    .readdirSync(adrRoot)
    .filter((file) => /^\d{4}-.*\.md$/.test(file))
    .sort();

  assert.deepEqual(actualFiles, expectedFiles);

  for (const file of expectedFiles) {
    assert.match(index, new RegExp(`\\(\\./${file.replace(".", "\\.")}\\)`));
  }
});

for (const [indexNumber, file] of expectedFiles.entries()) {
  test(`${file} records an accepted decision and its trade-offs`, () => {
    const document = fs.readFileSync(path.join(adrRoot, file), "utf8");
    const identifier = String(indexNumber + 1).padStart(4, "0");

    assert.match(document, new RegExp(`^# ADR-${identifier} — .+`, "m"));
    assert.match(document, /^- Status: Accepted$/m);
    assert.match(document, /^- Date: \d{4}-\d{2}-\d{2}$/m);

    for (const section of requiredSections) {
      assert.match(document, new RegExp(`^## ${section}$`, "m"), `${file} misses ${section}`);
    }

    assert.match(document, /^### Positive$/m);
    assert.match(document, /^### Costs and risks$/m);
    assert.match(document, /^## Revisit when$/m);
  });
}
