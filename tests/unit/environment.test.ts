import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLIENT_ENVIRONMENT_KEYS,
  clientEnvironmentSchema,
  parseClientEnvironment,
} from "@/validations/env/client-schema";
import { validateEnvironment } from "@/server/environment-core";
import { SERVER_ENVIRONMENT_KEYS, serverEnvironmentSchema } from "@/validations/env/server-schema";

const validEnvironment = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://127.0.0.1:27017/sara-kitchen-test",
  AUTH_SESSION_SECRET: "test-session-secret-with-more-than-32-characters",
  AUTH_PASSWORD_RESET_SECRET: "different-reset-secret-with-more-than-32-characters",
  MINIO_ENDPOINT: "127.0.0.1",
  MINIO_PORT: "9000",
  MINIO_USE_SSL: "false",
  MINIO_ACCESS_KEY: "test-access-key",
  MINIO_SECRET_KEY: "test-secret-key",
  MINIO_BUCKET: "sara-kitchen-test",
  MINIO_REGION: "us-east-1",
  KITCHEN_LATITUDE: "41.1579",
  KITCHEN_LONGITUDE: "-8.6291",
  MBWAY_ENABLED: "false",
  MBWAY_API_URL: "",
  MBWAY_MERCHANT_ID: "",
  MBWAY_API_KEY: "",
  MBWAY_WEBHOOK_SECRET: "",
  WHATSAPP_ENABLED: "false",
  WHATSAPP_API_URL: "",
  WHATSAPP_PHONE_NUMBER_ID: "",
  WHATSAPP_ACCESS_TOKEN: "",
  WHATSAPP_EMPLOYER_NUMBER: "",
} satisfies Record<string, string>;

describe("environment validation", () => {
  it("parses and normalizes a complete environment", () => {
    const environment = validateEnvironment(validEnvironment);

    expect(environment.server.MINIO_PORT).toBe(9000);
    expect(environment.server.MINIO_USE_SSL).toBe(false);
    expect(environment.server.KITCHEN_LATITUDE).toBe(41.1579);
    expect(environment.client.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(environment.client.NEXT_PUBLIC_SENTRY_ENABLED).toBe(false);
  });

  it("reports every missing field without printing supplied secret values", () => {
    const exposedValue = "a-secret-value-that-must-not-appear-in-errors";
    let message = "";

    try {
      validateEnvironment({ AUTH_SESSION_SECRET: exposedValue });
    } catch (error) {
      message = String(error);
    }

    expect(message).toContain("NEXT_PUBLIC_SITE_URL is required");
    expect(message).toContain("MONGODB_URI is required");
    expect(message).not.toContain(exposedValue);
  });

  it("requires integration credentials only when the integration is enabled", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MBWAY_ENABLED: "true",
      }),
    ).toThrowError(/MBWAY_API_URL is required when the integration is enabled/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SENTRY_ENABLED: "true",
      }),
    ).toThrowError(/SENTRY_DSN is required when the integration is enabled/);

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SENTRY_SOURCE_MAPS_ENABLED: "true",
      }),
    ).toThrowError(/SENTRY_AUTH_TOKEN is required when the integration is enabled/);
  });

  it("rejects unknown browser-exposed variables", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NEXT_PUBLIC_DATABASE_PASSWORD: "must-never-be-public",
      }),
    ).toThrowError(/NEXT_PUBLIC_DATABASE_PASSWORD: Unrecognized public variable/);
  });

  it("strips server values from the client environment result", () => {
    const clientEnvironment = parseClientEnvironment({
      NEXT_PUBLIC_SITE_URL: validEnvironment.NEXT_PUBLIC_SITE_URL,
      AUTH_SESSION_SECRET: validEnvironment.AUTH_SESSION_SECRET,
    });

    expect(clientEnvironment).toEqual({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SENTRY_ENABLED: false,
    });
    expect(clientEnvironment).not.toHaveProperty("AUTH_SESSION_SECRET");
    expect(SERVER_ENVIRONMENT_KEYS.every((key) => !key.startsWith("NEXT_PUBLIC_"))).toBe(true);
  });

  it("keeps the committed example complete and free of operational credentials", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const entries = Object.fromEntries(
      example
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );

    expect(Object.keys(entries).sort()).toEqual(
      [...CLIENT_ENVIRONMENT_KEYS, ...SERVER_ENVIRONMENT_KEYS].sort(),
    );
    expect(Object.keys(clientEnvironmentSchema.shape).sort()).toEqual(
      [...CLIENT_ENVIRONMENT_KEYS].sort(),
    );
    expect(Object.keys(serverEnvironmentSchema.shape).sort()).toEqual(
      [...SERVER_ENVIRONMENT_KEYS].sort(),
    );

    for (const key of [
      "AUTH_SESSION_SECRET",
      "AUTH_PASSWORD_RESET_SECRET",
      "MINIO_ACCESS_KEY",
      "MINIO_SECRET_KEY",
    ]) {
      expect(entries[key]).toMatch(/^replace-with/);
    }

    for (const key of [
      "MBWAY_API_URL",
      "MBWAY_MERCHANT_ID",
      "MBWAY_API_KEY",
      "MBWAY_WEBHOOK_SECRET",
      "WHATSAPP_API_URL",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_EMPLOYER_NUMBER",
    ]) {
      expect(entries[key]).toBe("");
    }
  });
});
