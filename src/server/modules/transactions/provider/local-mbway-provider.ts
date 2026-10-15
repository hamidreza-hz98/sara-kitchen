import "server-only";

import { createHash } from "node:crypto";

import {
  createLocalMbWaySandboxProvider,
  type MbWaySandboxProvider,
} from "./mbway-sandbox-provider";

type LocalProviderCache = { secretDigest: string; provider: MbWaySandboxProvider };
declare global {
  var __saraKitchenLocalMbWayProvider: LocalProviderCache | undefined;
}

/** Local simulator state shared by route handlers in one development process only. */
export function getLocalMbWaySandboxProvider(secret: string): MbWaySandboxProvider {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local MB Way simulator is disabled in production.");
  const secretDigest = createHash("sha256").update(secret).digest("hex");
  const cache = globalThis.__saraKitchenLocalMbWayProvider;
  if (cache?.secretDigest === secretDigest) return cache.provider;
  const provider = createLocalMbWaySandboxProvider(secret);
  globalThis.__saraKitchenLocalMbWayProvider = { secretDigest, provider };
  return provider;
}
