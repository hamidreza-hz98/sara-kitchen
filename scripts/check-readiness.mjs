import { fileURLToPath } from "node:url";
import path from "node:path";

export async function checkDeploymentReadiness(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new TypeError("Readiness target must be an HTTP(S) URL without credentials.");
  }
  const target = new URL("/api/ready", base);
  const response = await fetcher(target, {
    headers: { accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6_000),
  });
  if (response.status !== 200) return false;
  const body = await response.json();
  return (
    body?.ok === true &&
    body?.data?.status === "ready" &&
    body?.data?.dependencies?.mongodb === "ready" &&
    body?.data?.dependencies?.objectStorage === "ready"
  );
}

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error("Usage: pnpm readiness:check <base-url>");
    process.exitCode = 2;
    return;
  }
  try {
    if (await checkDeploymentReadiness(baseUrl)) {
      console.log("Deployment readiness: ready");
    } else {
      console.error("Deployment readiness: not ready");
      process.exitCode = 1;
    }
  } catch {
    console.error("Deployment readiness: not ready");
    process.exitCode = 1;
  }
}

const isEntryPoint =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntryPoint) await main();
