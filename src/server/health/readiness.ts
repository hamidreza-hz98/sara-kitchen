export type DependencyState = "ready" | "unavailable";
export type ReadinessReport = {
  status: "ready" | "not_ready";
  dependencies: {
    mongodb: DependencyState;
    objectStorage: DependencyState;
  };
};

export type ReadinessProbes = {
  mongodb: (signal: AbortSignal) => Promise<boolean>;
  objectStorage: (signal: AbortSignal) => Promise<boolean>;
};

export const READINESS_TIMEOUT_MS = 3_000;

async function probe(
  check: (signal: AbortSignal) => Promise<boolean>,
  timeoutMs: number,
): Promise<DependencyState> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      check(controller.signal),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve(false);
        }, timeoutMs);
      }),
    ]);
    return result === true ? "ready" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Check both required services independently and never return raw provider errors. */
export async function checkReadiness(
  probes: ReadinessProbes,
  timeoutMs = READINESS_TIMEOUT_MS,
): Promise<ReadinessReport> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new RangeError("Readiness timeout must be 1–10,000 milliseconds.");
  }

  const [mongodb, objectStorage] = await Promise.all([
    probe(probes.mongodb, timeoutMs),
    probe(probes.objectStorage, timeoutMs),
  ]);
  return {
    status: mongodb === "ready" && objectStorage === "ready" ? "ready" : "not_ready",
    dependencies: { mongodb, objectStorage },
  };
}
