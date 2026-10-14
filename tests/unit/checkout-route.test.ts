import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth", () => ({
  isSameOriginMutation: (request: Request) =>
    request.headers.get("origin") === "https://sarakitchen.pt",
}));

import { POST } from "@/app/api/checkout/route";

describe("checkout fail-closed boundary", () => {
  it("never creates an order or payment before atomic checkout is implemented", async () => {
    const response = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers: { origin: "https://sarakitchen.pt" },
      }) as never,
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "CONFLICT" },
    });
  });

  it("rejects cross-origin attempts", async () => {
    const response = await POST(
      new Request("https://sarakitchen.pt/api/checkout", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }) as never,
    );
    expect(response.status).toBe(403);
  });
});
