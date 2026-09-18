import { describe, expect, it } from "vitest";

import {
  mediaListApiSearchParams,
  parseMediaListUiQuery,
  patchMediaListSearchParams,
} from "@/lib/media-list-query";

describe("media list URL query", () => {
  it("parses supported URL state and converts only API parameters", () => {
    const query = parseMediaListUiQuery(
      new URLSearchParams(
        "page=3&pageSize=24&view=list&search=saffron&kind=image&usage=used&processingState=ready&sort=originalName:asc",
      ),
    );
    expect(query).toMatchObject({
      page: 3,
      pageSize: 24,
      view: "list",
      search: "saffron",
      kind: "image",
      usage: "used",
      processingState: "ready",
      sortBy: "originalName",
      sortDirection: "asc",
    });
    const api = mediaListApiSearchParams(query);
    expect(api.get("view")).toBeNull();
    expect(api.get("sortBy")).toBe("originalName");
    expect(api.get("sortDirection")).toBe("asc");
  });

  it("uses bounded defaults for malformed state", () => {
    expect(
      parseMediaListUiQuery(
        new URLSearchParams("page=-1&pageSize=100&view=cards&search=x&sort=unknown"),
      ),
    ).toEqual({ page: 1, pageSize: 12, view: "grid", sortBy: "createdAt", sortDirection: "desc" });
  });

  it("patches one concern without discarding other URL state", () => {
    const result = patchMediaListSearchParams(new URLSearchParams("page=4&kind=image&view=list"), {
      page: 1,
      usage: "unused",
      kind: undefined,
    });
    expect(result.toString()).toBe("page=1&view=list&usage=unused");
  });
});
