import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import englishMessages from "@/locales/messages/en/validation.json";
import { ApiError } from "@/server/http";
import { parseMediaListQuery } from "@/server/modules/media";
import type { ValidationMessageTranslator } from "@/validations/request";

const translate: ValidationMessageTranslator = (key) => englishMessages[key];
const options = { translate };

describe("media read query", () => {
  it("builds bounded pagination, search, date, and media filters", () => {
    const plan = parseMediaListQuery(
      new URLSearchParams(
        "page=2&pageSize=25&search=Persian%20Meal&kind=image&mimeType=image%2Fwebp" +
          "&uploaderId=507f1f77bcf86cd799439011&createdFrom=2026-01-01" +
          "&createdTo=2026-02-01&usage=used&processingState=ready" +
          "&sortBy=usageCount&sortDirection=asc",
      ),
      options,
    );
    expect(plan).toMatchObject({
      page: 2,
      pageSize: 25,
      skip: 25,
      limit: 25,
      sort: { usageCount: 1, _id: 1 },
      filter: {
        deletedAt: null,
        kind: "image",
        mimeType: "image/webp",
        uploaderId: "507f1f77bcf86cd799439011",
        processingState: "ready",
        usageCount: { $gt: 0 },
      },
    });
    expect(plan.filter.$text).toEqual({ $search: "persian meal" });
    expect(plan.filter.createdAt).toEqual({
      $gte: new Date("2026-01-01"),
      $lte: new Date("2026-02-01"),
    });
  });

  it("maps unused media to an indexed zero usage query", () => {
    expect(parseMediaListQuery(new URLSearchParams("usage=unused"), options).filter).toMatchObject({
      deletedAt: null,
      usageCount: 0,
    });
  });

  it("rejects malformed, repeated, expensive, and reversed filters", () => {
    for (const query of [
      "page=0",
      "page=101&pageSize=100",
      "search=a",
      "kind=archive",
      "mimeType=not-a-type",
      "uploaderId=nope",
      "usage=all",
      "processingState=deleted",
      "createdFrom=2026-02-01&createdTo=2026-01-01",
      "sortBy=objectKey",
      "kind=image&kind=pdf",
      "unknown=value",
    ]) {
      expect(() => parseMediaListQuery(new URLSearchParams(query), options), query).toThrow(
        ApiError,
      );
    }
  });
});
