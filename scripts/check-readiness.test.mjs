import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkDeploymentReadiness } from "./check-readiness.mjs";

test("deployment check requires 200 and both ready dependencies", async () => {
  let requestedPath;
  const fetcher = async (url) => {
    requestedPath = url.pathname;
    return {
      status: 200,
      json: async () => ({
        ok: true,
        data: { status: "ready", dependencies: { mongodb: "ready", objectStorage: "ready" } },
      }),
    };
  };
  assert.equal(await checkDeploymentReadiness("https://example.test", fetcher), true);
  assert.equal(requestedPath, "/api/ready");
  assert.equal(
    await checkDeploymentReadiness("https://example.test", async () => ({ status: 503 })),
    false,
  );
  assert.equal(
    await checkDeploymentReadiness("https://example.test", async () => ({
      status: 200,
      json: async () => ({
        ok: true,
        data: { status: "ready", dependencies: { mongodb: "ready", objectStorage: "unavailable" } },
      }),
    })),
    false,
  );
});

test("deployment check rejects embedded credentials", async () => {
  await assert.rejects(
    () => checkDeploymentReadiness("https://user:secret@example.test"),
    TypeError,
  );
});

test("deployment CLI exits nonzero when dependency readiness fails", async () => {
  let healthy = true;
  const server = createServer((request, response) => {
    assert.equal(request.url, "/api/ready");
    response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: healthy,
        data: {
          status: healthy ? "ready" : "not_ready",
          dependencies: {
            mongodb: "ready",
            objectStorage: healthy ? "ready" : "unavailable",
          },
        },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const target = `http://127.0.0.1:${address.port}`;
    const script = fileURLToPath(new URL("./check-readiness.mjs", import.meta.url));
    const run = () =>
      new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, target], { stdio: "ignore" });
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
    assert.equal(await run(), 0);
    healthy = false;
    assert.equal(await run(), 1);
  } finally {
    server.close();
  }
});
