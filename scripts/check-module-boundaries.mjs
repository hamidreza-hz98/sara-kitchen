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
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts"]);

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
  const absoluteMatch = specifier.match(
    /^@\/server\/modules\/([^/]+)(\/.*)?$/,
  );

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

  for (const sourceFile of walkSourceFiles(path.join(projectRoot, "src", "server"))) {
    const source = fs.readFileSync(sourceFile, "utf8");

    for (const specifier of extractImportSpecifiers(source)) {
      const violation = validateImport({ sourceFile, specifier, modulesRoot });

      if (violation) {
        errors.push(
          `${normalizePath(path.relative(projectRoot, sourceFile))}: ${violation}`,
        );
      }
    }
  }

  return errors;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const errors = checkModuleBoundaries();

  if (errors.length > 0) {
    console.error("Module boundary violations:\n");
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Module boundaries valid for ${moduleNames.length} modules.`);
  }
}
