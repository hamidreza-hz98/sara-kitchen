import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  extractImportSpecifiers,
  findDependencyCycles,
  hasDirective,
  validateImport,
  validateLayerImport,
} from "./check-module-boundaries.mjs";

const projectRoot = path.resolve("C:/workspace/sara-kitchen");
const srcRoot = path.join(projectRoot, "src");
const modulesRoot = path.join(projectRoot, "src", "server", "modules");

function sourceFile(moduleName) {
  return path.join(modulesRoot, moduleName, "service", "example.service.ts");
}

test("allows an explicitly declared dependency through its public API", () => {
  assert.equal(
    validateImport({
      sourceFile: sourceFile("auth"),
      specifier: "@/server/modules/sessions",
      modulesRoot,
    }),
    null,
  );
});

test("rejects an undeclared public module dependency", () => {
  assert.match(
    validateImport({
      sourceFile: sourceFile("media"),
      specifier: "@/server/modules/orders",
      modulesRoot,
    }),
    /undeclared dependency media -> orders/,
  );
});

test("rejects direct access to another module model", () => {
  assert.match(
    validateImport({
      sourceFile: sourceFile("orders"),
      specifier: "@/server/modules/dishes/model/dish.schema",
      modulesRoot,
    }),
    /imports private internals from dishes/,
  );
});

test("rejects relative traversal into a sibling module", () => {
  assert.match(
    validateImport({
      sourceFile: sourceFile("orders"),
      specifier: "../../dishes/model/dish.schema",
      modulesRoot,
    }),
    /relative cross-module import orders -> dishes/,
  );
});

test("allows private imports that remain inside the owning module", () => {
  assert.equal(
    validateImport({
      sourceFile: sourceFile("orders"),
      specifier: "../model/order.schema",
      modulesRoot,
    }),
    null,
  );
});

test("extracts static, dynamic, export, and CommonJS specifiers", () => {
  const source = `
    import { one } from "@/server/modules/orders";
    import type { Two } from '@/server/modules/dishes';
    export { three } from "@/server/modules/media";
    const four = import("@/server/modules/settings");
    const five = require("@/server/modules/logs");
  `;

  assert.deepEqual(extractImportSpecifiers(source).sort(), [
    "@/server/modules/dishes",
    "@/server/modules/logs",
    "@/server/modules/media",
    "@/server/modules/orders",
    "@/server/modules/settings",
  ]);
});

test("accepts the project dependency graph and detects a cycle", () => {
  assert.deepEqual(findDependencyCycles(), []);
  assert.deepEqual(
    findDependencyCycles({
      alpha: ["beta"],
      beta: ["gamma"],
      gamma: ["alpha"],
    }),
    [["alpha", "beta", "gamma", "alpha"]],
  );
});

test("recognizes client directives after leading comments", () => {
  assert.equal(hasDirective('/* component */\n"use client";\nexport {};', "use client"), true);
  assert.equal(hasDirective('"use server";\nexport {};', "use client"), false);
});

test("rejects forbidden top-level layer dependencies", () => {
  assert.match(
    validateLayerImport({
      sourceFile: path.join(srcRoot, "components", "dish-card.tsx"),
      source: 'import Page from "@/app/page";',
      specifier: "@/app/page",
      srcRoot,
    }),
    /forbidden layer dependency components -> app/,
  );
});

test("rejects server-only imports from Client Components", () => {
  assert.match(
    validateLayerImport({
      sourceFile: path.join(srcRoot, "app", "client-component.tsx"),
      source: '"use client";\nimport { getServerEnvironment } from "@/server/environment";',
      specifier: "@/server/environment",
      srcRoot,
    }),
    /Client Component imports server-only module/,
  );
});
