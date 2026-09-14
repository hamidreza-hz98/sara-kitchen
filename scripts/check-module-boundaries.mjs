import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const dependencyMap = Object.freeze({
  addresses: ["customers"],
  admins: [],
  analytics: ["customers", "dishes", "logs", "orders"],
  auth: ["admins", "customers", "sessions"],
  blogs: ["admins", "dishes", "media"],
  carts: ["addresses", "customers", "dishes"],
  categories: ["media"],
  contacts: [],
  customers: [],
  dishes: ["categories", "ingredients", "media"],
  ingredients: ["media"],
  logs: [],
  media: [],
  orders: ["addresses", "carts", "customers", "dishes", "transactions"],
  seo: ["blogs", "categories", "dishes", "media"],
  sessions: [],
  settings: ["blogs", "categories", "dishes", "media"],
  transactions: ["customers"],
});

const moduleNames = Object.freeze(Object.keys(dependencyMap));
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mts", ".cts"]);

export const allowedLayerDependencies = Object.freeze({
  app: [
    "app",
    "components",
    "constants",
    "hooks",
    "lib",
    "locales",
    "providers",
    "server",
    "theme",
    "types",
    "validations",
  ],
  components: [
    "components",
    "constants",
    "hooks",
    "lib",
    "locales",
    "theme",
    "types",
    "validations",
  ],
  constants: ["constants", "types"],
  hooks: ["constants", "hooks", "lib", "types", "validations"],
  lib: ["constants", "lib", "types", "validations"],
  locales: ["constants", "locales", "types", "validations"],
  providers: [
    "components",
    "constants",
    "hooks",
    "lib",
    "locales",
    "providers",
    "theme",
    "types",
    "validations",
  ],
  server: ["constants", "lib", "locales", "server", "types", "validations"],
  theme: ["constants", "theme", "types"],
  types: ["constants", "types"],
  validations: ["constants", "types", "validations"],
});

export function findDependencyCycles(modules = dependencyMap) {
  const cycles = [];
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function visit(moduleName) {
    if (active.has(moduleName)) {
      const cycleStart = stack.indexOf(moduleName);
      cycles.push([...stack.slice(cycleStart), moduleName]);
      return;
    }

    if (visited.has(moduleName)) {
      return;
    }

    active.add(moduleName);
    stack.push(moduleName);

    for (const dependency of modules[moduleName] ?? []) {
      visit(dependency);
    }

    stack.pop();
    active.delete(moduleName);
    visited.add(moduleName);
  }

  for (const moduleName of Object.keys(modules)) {
    visit(moduleName);
  }

  return cycles;
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function sourceLayer(sourceFile, srcRoot) {
  const relative = normalizePath(path.relative(srcRoot, sourceFile));
  const [candidate] = relative.split("/");
  return Object.hasOwn(allowedLayerDependencies, candidate) ? candidate : null;
}

function projectImportTarget(sourceFile, specifier, srcRoot) {
  if (specifier.startsWith("@/")) {
    return path.join(srcRoot, specifier.slice(2));
  }

  return specifier.startsWith(".") ? path.resolve(path.dirname(sourceFile), specifier) : null;
}

function resolveSourceFile(candidate) {
  const candidates = [
    candidate,
    ...[...sourceExtensions].map((extension) => `${candidate}${extension}`),
    ...[...sourceExtensions].map((extension) => path.join(candidate, `index${extension}`)),
  ];

  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

export function hasDirective(source, directive) {
  const escapedDirective = directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^\\s*(?:(?://[^\\n]*|/\\*[\\s\\S]*?\\*/)\\s*)*["']${escapedDirective}["']\\s*;?`,
  ).test(source);
}

function targetIsServerOnly(targetPath) {
  const normalized = normalizePath(targetPath);
  const resolved = resolveSourceFile(targetPath);

  if (
    normalized.includes("/src/server/") ||
    /(?:^|\/)server(?:-schema)?$/.test(normalized) ||
    /\.server$/.test(normalized)
  ) {
    return resolved && hasDirective(fs.readFileSync(resolved, "utf8"), "use server") ? false : true;
  }

  return resolved
    ? /\bimport\s+["']server-only["']/.test(fs.readFileSync(resolved, "utf8"))
    : false;
}

export function validateLayerImport({ sourceFile, source, specifier, srcRoot }) {
  const fromLayer = sourceLayer(sourceFile, srcRoot);
  const targetPath = projectImportTarget(sourceFile, specifier, srcRoot);

  if (hasDirective(source, "use client") && specifier === "server-only") {
    return "a Client Component imports the server-only guard";
  }

  if (!targetPath || !fromLayer) {
    return null;
  }

  const toLayer = sourceLayer(targetPath, srcRoot);

  if (toLayer && !allowedLayerDependencies[fromLayer].includes(toLayer)) {
    return `uses forbidden layer dependency ${fromLayer} -> ${toLayer}`;
  }

  if (hasDirective(source, "use client") && targetIsServerOnly(targetPath)) {
    return `a Client Component imports server-only module ${normalizePath(path.relative(srcRoot, targetPath))}`;
  }

  return null;
}

function moduleFromFile(sourceFile, modulesRoot) {
  const relative = normalizePath(path.relative(modulesRoot, sourceFile));
  const [candidate] = relative.split("/");
  return moduleNames.includes(candidate) ? candidate : null;
}

function moduleFromResolvedPath(resolvedPath, modulesRoot) {
  return moduleFromFile(resolvedPath, modulesRoot);
}

export function validateImport({ sourceFile, specifier, modulesRoot }) {
  const sourceModule = moduleFromFile(sourceFile, modulesRoot);
  const absoluteMatch = specifier.match(/^@\/server\/modules\/([^/]+)(\/.*)?$/);

  if (absoluteMatch) {
    const [, targetModule, internalPath = ""] = absoluteMatch;

    if (!moduleNames.includes(targetModule)) {
      return null;
    }

    if (internalPath && targetModule !== sourceModule) {
      return `imports private internals from ${targetModule}; import @/server/modules/${targetModule} instead`;
    }

    if (
      sourceModule &&
      targetModule !== sourceModule &&
      !dependencyMap[sourceModule].includes(targetModule)
    ) {
      return `uses undeclared dependency ${sourceModule} -> ${targetModule}`;
    }

    return null;
  }

  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(sourceFile), specifier);
    const targetModule = moduleFromResolvedPath(resolved, modulesRoot);

    if (sourceModule && targetModule && sourceModule !== targetModule) {
      return `uses a relative cross-module import ${sourceModule} -> ${targetModule}; import the target module public API`;
    }
  }

  return null;
}

export function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

function walkSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walkSourceFiles(entryPath);
    }

    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

export function checkModuleBoundaries(projectRoot = process.cwd()) {
  const srcRoot = path.join(projectRoot, "src");
  const modulesRoot = path.join(projectRoot, "src", "server", "modules");
  const errors = [];

  for (const moduleName of moduleNames) {
    const moduleRoot = path.join(modulesRoot, moduleName);

    for (const requiredFile of ["README.md", "index.ts"]) {
      if (!fs.existsSync(path.join(moduleRoot, requiredFile))) {
        errors.push(`${moduleName}: missing ${requiredFile}`);
      }
    }
  }

  for (const [moduleName, dependencies] of Object.entries(dependencyMap)) {
    for (const dependency of dependencies) {
      if (!moduleNames.includes(dependency)) {
        errors.push(`${moduleName}: declares unknown dependency ${dependency}`);
      }
    }
  }

  for (const cycle of findDependencyCycles()) {
    errors.push(`dependency cycle: ${cycle.join(" -> ")}`);
  }

  for (const sourceFile of walkSourceFiles(srcRoot)) {
    const source = fs.readFileSync(sourceFile, "utf8");

    for (const specifier of extractImportSpecifiers(source)) {
      const violations = [
        validateImport({ sourceFile, specifier, modulesRoot }),
        validateLayerImport({ sourceFile, source, specifier, srcRoot }),
      ].filter(Boolean);

      for (const violation of violations) {
        errors.push(`${normalizePath(path.relative(projectRoot, sourceFile))}: ${violation}`);
      }
    }
  }

  return errors;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const errors = checkModuleBoundaries();

  if (errors.length > 0) {
    console.error("Import boundary violations:\n");
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Import boundaries valid across ${moduleNames.length} domain modules.`);
  }
}
