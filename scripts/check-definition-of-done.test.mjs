import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const templatePath = path.join(projectRoot, ".github", "pull_request_template.md");
const policyPath = path.join(projectRoot, "docs", "definition-of-done.md");
const template = fs.readFileSync(templatePath, "utf8");
const policy = fs.readFileSync(policyPath, "utf8");
const packageManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

const requiredTemplateSections = [
  "Core verification",
  "Translations",
  "Authorization and privacy",
  "Activity logging",
  "Validation and failure handling",
  "Accessibility",
  "Responsive and localized layout",
  "Documentation and operations",
  "Security findings",
];

const requiredPolicySections = [
  "Tests",
  "Translations",
  "Authorization and privacy",
  "Activity logging",
  "Validation and failure handling",
  "Accessibility",
  "Responsive and localized layout",
  "Documentation and operations",
  "Security findings",
];

test("the pull-request template exposes every definition-of-done gate", () => {
  assert.match(template, /^# Definition of done$/m);
  assert.match(template, /docs\/definition-of-done\.md/);
  assert.match(template, /Every item must be checked/);
  assert.match(template, /^# N\/A reasons$/m);

  for (const section of requiredTemplateSections) {
    assert.match(template, new RegExp(`^## ${section}$`, "m"), `template misses ${section}`);
  }
});

test("the template requires an explicit N/A reason for every conditional gate", () => {
  const conditionalSections = requiredTemplateSections.filter(
    (section) => section !== "Core verification",
  );

  for (const [index, section] of conditionalSections.entries()) {
    const start = template.indexOf(`## ${section}`);
    const nextSection = conditionalSections[index + 1];
    const end = nextSection
      ? template.indexOf(`## ${nextSection}`)
      : template.indexOf("# N/A reasons");
    const content = template.slice(start, end);

    assert.match(
      content,
      /- \[ \] N\/A — .+reason recorded below\./,
      `${section} misses N/A evidence`,
    );
  }
});

test("the policy defines evidence for every required delivery concern", () => {
  for (const section of requiredPolicySections) {
    assert.match(policy, new RegExp(`^## \\d+\\. ${section}$`, "m"), `policy misses ${section}`);
  }

  assert.match(policy, /English \(`en`\), Portuguese \(`pt`\), and Farsi \(`fa`\)/);
  assert.match(policy, /WCAG 2\.2 Level AA/);
  assert.match(policy, /no unresolved Critical-severity finding/);
  assert.match(policy, /Critical\s+finding blocks completion and release/);
  assert.equal(
    packageManifest.scripts["security:audit"],
    "pnpm audit --prod --audit-level critical",
  );
});
