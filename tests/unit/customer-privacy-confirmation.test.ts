// @vitest-environment node

import { NextRequest } from "next/server";
import type { Connection } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ limit: vi.fn(), verify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth", () => ({ limitSensitiveAccountOperation: state.limit }));
vi.mock("@/server/modules/customers", () => ({ verifyCustomerPasswordForLogin: state.verify }));

import { confirmCustomerPrivacyPassword } from "@/app/api/profile/privacy-confirmation";

const connection = {} as Connection;
const request = new NextRequest("http://localhost:3000/api/profile/export", { method: "POST" });
const customerId = "507f1f77bcf86cd799439011";

beforeEach(() => {
  vi.clearAllMocks();
  state.limit.mockResolvedValue(undefined);
});

describe("customer privacy confirmation", () => {
  it("rate-limits and verifies the current password for the exact customer", async () => {
    state.verify.mockResolvedValue(true);
    await expect(
      confirmCustomerPrivacyPassword(connection, request, customerId, "correct"),
    ).resolves.toBeUndefined();
    expect(state.limit).toHaveBeenCalledWith(connection, request, {
      principal: "customer",
      actorId: customerId,
      operation: "privacy",
    });
    expect(state.verify).toHaveBeenCalledWith(connection, customerId, "correct");
  });

  it("rejects an incorrect password and does not bypass the rate limit", async () => {
    state.verify.mockResolvedValue(false);
    await expect(
      confirmCustomerPrivacyPassword(connection, request, customerId, "wrong"),
    ).rejects.toMatchObject({ status: 403 });
    expect(state.limit).toHaveBeenCalledOnce();
  });
});
