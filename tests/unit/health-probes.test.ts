import { beforeEach, describe, expect, it, vi } from "vitest";

const { connectToDatabase, bucketExists, getServerEnvironment } = vi.hoisted(() => ({
  connectToDatabase: vi.fn(),
  bucketExists: vi.fn(),
  getServerEnvironment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/database", () => ({ connectToDatabase }));
vi.mock("@/server/environment", () => ({ getServerEnvironment }));
vi.mock("minio", () => ({
  Client: class {
    bucketExists = bucketExists;
  },
}));

import { getReadiness } from "@/server/health/probes";

describe("required service probes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue({
      MINIO_ENDPOINT: "private.example.test",
      MINIO_PORT: 9000,
      MINIO_USE_SSL: true,
      MINIO_ACCESS_KEY: "private-access",
      MINIO_SECRET_KEY: "private-secret",
      MINIO_REGION: "eu-west-1",
      MINIO_BUCKET: "sara-media",
    });
    connectToDatabase.mockResolvedValue({
      db: { admin: () => ({ command: async () => ({ ok: 1 }) }) },
    });
    bucketExists.mockResolvedValue(true);
  });

  it("pings MongoDB and verifies the actual configured MinIO bucket", async () => {
    await expect(getReadiness()).resolves.toEqual({
      status: "ready",
      dependencies: { mongodb: "ready", objectStorage: "ready" },
    });
    expect(bucketExists).toHaveBeenCalledWith("sara-media");
  });

  it("reports unhealthy MongoDB and missing or inaccessible object storage safely", async () => {
    connectToDatabase.mockRejectedValue(new Error("mongodb://user:secret@private-host"));
    bucketExists.mockResolvedValue(false);
    const report = await getReadiness();
    expect(report).toEqual({
      status: "not_ready",
      dependencies: { mongodb: "unavailable", objectStorage: "unavailable" },
    });
    expect(JSON.stringify(report)).not.toContain("secret");

    connectToDatabase.mockResolvedValue({
      db: { admin: () => ({ command: async () => ({ ok: 1 }) }) },
    });
    bucketExists.mockRejectedValue(new Error("MINIO_SECRET_KEY=private-secret"));
    await expect(getReadiness()).resolves.toMatchObject({
      status: "not_ready",
      dependencies: { mongodb: "ready", objectStorage: "unavailable" },
    });
  });
});
