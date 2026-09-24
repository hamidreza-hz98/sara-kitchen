import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_HTTP_IMPORT = /from\s+["']@\/server\/http["']/u;
const HANDLER_WRAPPER = /\bhandleApiRoute\s*\(/u;
const HANDLER_WRAPPERS = /\bhandleApiRoute\s*\(/gu;
const XML_ROUTE_MARKER = /^\s*\/\/\s*route-response:\s*xml\s*$/mu;
const XML_RESPONSE_WRAPPER = /\bsitemapXmlResponse\s*\(/gu;
const FUNCTION_METHOD_EXPORT =
  /\bexport\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gu;
const VARIABLE_METHOD_EXPORT =
  /\bexport\s+(?:const|let)\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=/gu;
const RAW_RESPONSE_PATTERNS = [
  { label: "Response.json", pattern: /\bResponse\.json\s*\(/u },
  { label: "NextResponse.json", pattern: /\bNextResponse\.json\s*\(/u },
  { label: "new Response", pattern: /\bnew\s+Response\s*\(/u },
];

export function validateRouteHandlerSource(source, file = "route.ts") {
  const errors = [];
  const methodCount = [
    ...(source.match(FUNCTION_METHOD_EXPORT) ?? []),
    ...(source.match(VARIABLE_METHOD_EXPORT) ?? []),
  ].length;
  if (XML_ROUTE_MARKER.test(source)) {
    const responseCount = (source.match(XML_RESPONSE_WRAPPER) ?? []).length;
    if (responseCount < methodCount) {
      errors.push(
        `${file}: every XML method must use sitemapXmlResponse() (${responseCount}/${methodCount}).`,
      );
    }
    if (/\b(?:Response|NextResponse)\.json\s*\(/u.test(source)) {
      errors.push(`${file}: XML handlers cannot return JSON responses.`);
    }
    return errors;
  }
  if (!PUBLIC_HTTP_IMPORT.test(source)) {
    errors.push(`${file}: import the public API from @/server/http.`);
  }
  if (!HANDLER_WRAPPER.test(source)) {
    errors.push(`${file}: execute each JSON handler through handleApiRoute().`);
  }
  const wrapperCount = (source.match(HANDLER_WRAPPERS) ?? []).length;
  if (methodCount > wrapperCount) {
    errors.push(
      `${file}: every exported HTTP method must have its own handleApiRoute() boundary (${wrapperCount}/${methodCount}).`,
    );
  }
  for (const rawResponse of RAW_RESPONSE_PATTERNS) {
    if (rawResponse.pattern.test(source)) {
      errors.push(`${file}: do not return ad hoc ${rawResponse.label} responses.`);
    }
  }
  return errors;
}

async function findRouteHandlers(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findRouteHandlers(entryPath);
      return /^route\.(?:ts|tsx)$/u.test(entry.name) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

export async function checkRouteHandlerContracts(rootDirectory = process.cwd()) {
  const appDirectory = path.join(rootDirectory, "src", "app");
  const routeFiles = await findRouteHandlers(appDirectory);
  const findings = [];
  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, "utf8");
    const relativeFile = path.relative(rootDirectory, routeFile).replaceAll(path.sep, "/");
    findings.push(...validateRouteHandlerSource(source, relativeFile));
  }
  return { findings, routeCount: routeFiles.length };
}

async function main() {
  const { findings, routeCount } = await checkRouteHandlerContracts();
  if (findings.length > 0) {
    console.error(`Route Handler contract violations:\n- ${findings.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`API response contract valid across ${routeCount} Route Handler(s).`);
}

const isEntryPoint =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntryPoint) await main();
