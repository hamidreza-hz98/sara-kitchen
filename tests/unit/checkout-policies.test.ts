import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ find: vi.fn(), exec: vi.fn() }));
vi.mock("@/server/modules/settings/model/policy-version", () => ({
  getPolicyVersionModel: () => ({ find: state.find }),
}));

import { getCheckoutPolicies } from "@/server/modules/settings/service/checkout-policies";

describe("published checkout policies", () => {
  it("selects the latest effective version and falls back to canonical English", async () => {
    state.find.mockReturnValue({ sort: () => ({ lean: () => ({ exec: state.exec }) }) });
    state.exec.mockResolvedValue([
      {
        _id: { toHexString: () => "1" },
        documentType: "terms-of-service",
        version: 2,
        translations: [{ locale: "en", title: "Terms v2", summary: "Read this", sections: [] }],
      },
      {
        _id: { toHexString: () => "2" },
        documentType: "terms-of-service",
        version: 1,
        translations: [{ locale: "en", title: "Old", summary: "", sections: [] }],
      },
      {
        _id: { toHexString: () => "3" },
        documentType: "privacy-policy",
        version: 4,
        translations: [
          { locale: "pt-PT", title: "Privacidade", summary: "", sections: [] },
          { locale: "en", title: "Privacy", summary: "", sections: [] },
        ],
      },
    ]);
    const now = new Date("2026-10-14T12:00:00Z");
    const result = await getCheckoutPolicies({} as never, "pt-PT", now);
    expect(state.find).toHaveBeenCalledWith({
      documentType: { $in: ["terms-of-service", "privacy-policy"] },
      state: "published",
      effectiveAt: { $lte: now },
    });
    expect(result.map(({ title }) => title)).toEqual(["Terms v2", "Privacidade"]);
  });
});
