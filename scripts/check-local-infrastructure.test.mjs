import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsRoot, "..");
const compose = parse(fs.readFileSync(path.join(projectRoot, "compose.yaml"), "utf8"));
const packageManifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const localEnvironment = fs.readFileSync(path.join(projectRoot, "infra", "local.env"), "utf8");
const infrastructureRunner = fs.readFileSync(
  path.join(projectRoot, "scripts", "local-infrastructure.mjs"),
  "utf8",
);
const minioDockerfile = fs.readFileSync(
  path.join(projectRoot, "infra", "minio", "Dockerfile"),
  "utf8",
);

test("Compose defines pinned, loopback-only healthy services", () => {
  assert.equal(compose.services.mongo.image, "mongo:8.0.30-noble");
  assert.equal(compose.services.minio.image, "sara-kitchen/minio:RELEASE.2025-10-15T17-29-55Z");
  assert.match(compose.services["minio-init"].image, /@sha256:[a-f0-9]{64}$/);

  assert.deepEqual(compose.services.mongo.ports, ["127.0.0.1:27017:27017"]);
  assert.deepEqual(compose.services.minio.ports, ["127.0.0.1:9000:9000", "127.0.0.1:9001:9001"]);
  assert.ok(compose.services.mongo.healthcheck);
  assert.ok(compose.services.minio.healthcheck);
  assert.equal(compose.services["minio-init"].depends_on.minio.condition, "service_healthy");
});

test("Compose provisions private durable storage and the media bucket", () => {
  assert.deepEqual(Object.keys(compose.volumes).sort(), [
    "minio-data",
    "mongo-config",
    "mongo-data",
  ]);
  assert.match(compose.services["minio-init"].command[0], /mc mb --ignore-existing/);
  assert.match(compose.services["minio-init"].command[0], /mc anonymous set none/);
  assert.match(compose.services["minio-init"].command[0], /mc stat/);
});

test("MinIO builds the exact upstream security-fix source as a non-root image", () => {
  assert.match(minioDockerfile, /MINIO_RELEASE=RELEASE\.2025-10-15T17-29-55Z/);
  assert.match(minioDockerfile, /MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a/);
  assert.match(minioDockerfile, /test "\$\(git rev-parse HEAD\)" = "\$\{MINIO_COMMIT\}"/);
  assert.match(minioDockerfile, /go build -tags kqueue -trimpath/);
  assert.match(minioDockerfile, /USER minio:minio/);
});

test("local credentials are explicit, scoped, and never used as production defaults", () => {
  assert.match(localEnvironment, /MONGO_APP_USERNAME=sara_kitchen_app/);
  assert.match(localEnvironment, /MONGO_APP_PASSWORD=local-only-[^\r\n]{20,}/);
  assert.match(localEnvironment, /MINIO_ROOT_PASSWORD=local-only-[^\r\n]{20,}/);
  assert.match(localEnvironment, /Valid only for loopback-bound local containers/);
});

test("package scripts preserve volumes during normal shutdown", () => {
  for (const script of ["infra:up", "infra:down", "infra:status", "infra:logs", "infra:config"]) {
    assert.equal(typeof packageManifest.scripts[script], "string", `missing script: ${script}`);
  }

  assert.match(infrastructureRunner, /\["down", "--remove-orphans"\]/);
  assert.doesNotMatch(infrastructureRunner, /(?:--volumes|-v)/);
});
