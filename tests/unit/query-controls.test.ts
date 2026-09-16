import { z } from "zod";
import { describe, expect, it } from "vitest";

import englishMessages from "@/locales/messages/en/validation.json";
import { ApiError } from "@/server/http/api-error";
import {
  createListQueryControls,
  escapeSearchPattern,
  pageResult,
} from "@/server/database/query-controls";
import type { ValidationMessageTranslator } from "@/validations/request";

const translate: ValidationMessageTranslator = (key) => englishMessages[key];
const controls = createListQueryControls({
  filters: { status: z.enum(["active", "draft"]) },
  sortFields: ["name", "price"],
  defaultSort: "name",
  projectionFields: ["name", "price", "status"],
  defaultProjection: ["name", "price"],
  search: true,
});

function parse(query: string) {
  return controls.parse(new URLSearchParams(query), { translate });
}

describe("list query controls", () => {
  it("uses bounded defaults, allowlisted projection and stable id tie-breaker", () => {
    expect(parse("")).toMatchObject({
      filter: {},
      projection: { _id: 1, name: 1, price: 1 },
      sort: { name: 1, _id: 1 },
      page: 1,
      pageSize: 20,
      skip: 0,
      limit: 20,
    });
    expect(
      parse("page=2&pageSize=3&status=draft&sortBy=price&sortDirection=desc&fields=status"),
    ).toMatchObject({
      filter: { status: "draft" },
      projection: { _id: 1, status: 1 },
      sort: { price: -1, _id: -1 },
      skip: 3,
      limit: 3,
    });
  });

  it("rejects malformed, unlisted, repeated and costly controls", () => {
    for (const query of [
      "page=0",
      "page=2&pageSize=10000",
      "page=101&pageSize=100",
      "page=1&page=2",
      "sortBy=password",
      "status=deleted",
      "unknown=1",
      "fields=password",
      "fields=name,name",
      "fields=",
      "search=*",
      "search=a",
      `search=${"a".repeat(81)}`,
    ]) {
      expect(() => parse(query), query).toThrow(ApiError);
    }
  });

  it("normalizes and anchors search without accepting regex operators", () => {
    expect(escapeSearchPattern("a.*(b)")).toBe("a\\.\\*\\(b\\)");
    const filter = parse("search=%C3%87hef.*").filter;
    expect(filter.normalizedSearchText).toEqual(/^chef/u);
  });

  it("never allows object filter values or dangerous config paths", () => {
    const unsafe = createListQueryControls({
      filters: { status: z.any() },
      sortFields: ["name"],
      defaultSort: "name",
      projectionFields: ["name"],
      defaultProjection: ["name"],
    });
    expect(() => unsafe.parse(new URLSearchParams("status=x"), { translate })).not.toThrow();
    expect(() =>
      createListQueryControls({
        filters: { $where: z.string() },
        sortFields: ["name"],
        defaultSort: "name",
        projectionFields: ["name"],
        defaultProjection: ["name"],
      }),
    ).toThrow(TypeError);
  });

  it("reports stable metadata with explicit zero and out-of-range pages", () => {
    expect(pageResult(["dish"], 41, parse("page=2"))).toEqual({
      data: ["dish"],
      meta: {
        pagination: {
          page: 2,
          pageSize: 20,
          totalItems: 41,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
        sort: { by: "name", direction: "asc" },
      },
    });
    expect(pageResult([], 0, parse(""))).toMatchObject({
      meta: { pagination: { totalPages: 0, hasNextPage: false, hasPreviousPage: false } },
    });
    expect(() => pageResult([], -1, parse(""))).toThrow(RangeError);
  });
});
