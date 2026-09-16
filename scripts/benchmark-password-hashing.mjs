import { readFile } from "node:fs/promises";
import { platform, release, cpus } from "node:os";
import { performance } from "node:perf_hooks";

import argon2 from "argon2";

const policy = JSON.parse(
  await readFile(new URL("../src/server/security/password-policy.json", import.meta.url), "utf8"),
);
const options = { type: argon2.argon2id, ...policy };
const secret = "Benchmark-only passphrase that is never printed";
const hashMs = [];
const verifyMs = [];

for (let run = 0; run < 21; run += 1) {
  const hashStart = performance.now();
  const digest = await argon2.hash(secret, options);
  const hashElapsed = performance.now() - hashStart;
  const verifyStart = performance.now();
  if (!(await argon2.verify(digest, secret))) throw new Error("Benchmark verification failed.");
  const verifyElapsed = performance.now() - verifyStart;
  if (run > 0) {
    hashMs.push(hashElapsed);
    verifyMs.push(verifyElapsed);
  }
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
    p95Ms: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: Math.round(sorted.at(-1)),
  };
}

const concurrentStart = performance.now();
await Promise.all(Array.from({ length: 4 }, () => argon2.hash(secret, options)));
const concurrentHash4WallMs = Math.round(performance.now() - concurrentStart);

process.stdout.write(
  `${JSON.stringify(
    {
      profile: "argon2id",
      parameters: policy,
      runtime: {
        node: process.version,
        platform: platform(),
        release: release(),
        cpu: cpus()[0]?.model,
      },
      samplesAfterWarmup: hashMs.length,
      hash: summarize(hashMs),
      verify: summarize(verifyMs),
      concurrentHash4WallMs,
    },
    null,
    2,
  )}\n`,
);
