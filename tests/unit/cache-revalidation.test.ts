import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, updateTag } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag, updateTag }));

import { revalidateContentFromAction } from "@/server/cache/action-revalidation";
import { revalidateContentFromRoute } from "@/server/cache/route-revalidation";

describe("Next.js content revalidation adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expires only affected tags immediately after route mutations", () => {
    revalidateContentFromRoute({ area: "categories", ids: ["cat-1"] });
    expect(revalidateTag.mock.calls).toEqual([
      ["sk:v1:categories:list", { expire: 0 }],
      ["sk:v1:categories:item:cat-1", { expire: 0 }],
      ["sk:v1:seo:list", { expire: 0 }],
    ]);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("uses Server Action-only updateTag for read-your-writes", () => {
    revalidateContentFromAction({ area: "settings", ids: ["homepage"] });
    expect(updateTag.mock.calls).toEqual([
      ["sk:v1:settings:list"],
      ["sk:v1:settings:item:homepage"],
      ["sk:v1:seo:list"],
    ]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
