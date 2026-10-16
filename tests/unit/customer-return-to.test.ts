import { describe, expect, it } from "vitest";

import { safeCustomerReturnTo } from "@/lib/customer-return-to";

describe("safe customer sign-in return path", () => {
  it("keeps profile deep links and the cart address handoff", () => {
    expect(safeCustomerReturnTo("/profile/orders?page=2")).toBe("/profile/orders?page=2");
    expect(safeCustomerReturnTo("/profile/change-password")).toBe("/profile/change-password");
    expect(safeCustomerReturnTo("/cart/address")).toBe("/cart/address");
    expect(safeCustomerReturnTo("/cart/address?unexpected=1")).toBe("/cart/address");
  });

  it.each([
    null,
    "https://evil.example/profile",
    "//evil.example/profile",
    "profile/orders",
    "/\\evil.example/profile",
    "/dashboard",
    "/profile#fragment",
    "/profile\n/orders",
  ])("falls back for unsafe or out-of-scope destinations: %s", (value) => {
    expect(safeCustomerReturnTo(value)).toBe("/profile");
  });
});
