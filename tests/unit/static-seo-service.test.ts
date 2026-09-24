import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SEO_EXCLUDED_PATH_PREFIXES,
  STATIC_SEO_PAGES,
  StaticSeoServiceError,
  createStaticSeoServices,
  isSeoExcludedPath,
  staticSeoCreateSchema,
  type StaticSeoRepository,
  type StaticSeoSnapshot,
  type StaticSeoWrite,
} from "@/server/modules/seo";

const owner = { id: "a".repeat(24), role: "owner" as const };
const input = {
  key: "home" as const,
  translations: [
    {
      locale: "en" as const,
      title: "Persian homemade food in Porto",
      description: "Order Sara Kitchen's homemade Persian food across Porto.",
      keywords: ["Persian food", "Porto delivery"],
    },
    {
      locale: "pt-PT" as const,
      title: "Comida persa caseira no Porto",
      description: "Encomende comida persa caseira da Sara Kitchen no Porto.",
    },
    {
      locale: "fa" as const,
      title: "غذای خانگی ایرانی در پورتو",
      description: "غذای خانگی آشپزخانه سارا را در پورتو سفارش دهید.",
    },
  ],
};

function harness() {
  const records = new Map<string, StaticSeoSnapshot>();
  const audit = vi.fn(async () => undefined);
  const invalidate = vi.fn();
  const validateShareImage = vi.fn(async () => undefined);
  let version = 0;
  const make = (key: keyof typeof STATIC_SEO_PAGES, value: StaticSeoWrite): StaticSeoSnapshot => ({
    id: (records.size + 1).toString(16).padStart(24, "0"),
    key,
    ...STATIC_SEO_PAGES[key],
    ...structuredClone(value),
    version: version++,
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-09-24T12:00:00.000Z",
  });
  const repository: StaticSeoRepository = {
    list: async () => [...records.values()],
    findByKey: async (key) => records.get(key) ?? null,
    create: async (key, value) => {
      const record = make(key, value);
      records.set(key, record);
      return record;
    },
    save: async (current, value) => {
      const record = { ...make(current.key, value), id: current.id, createdAt: current.createdAt };
      records.set(current.key, record);
      return record;
    },
  };
  return {
    records,
    audit,
    invalidate,
    validateShareImage,
    services: createStaticSeoServices({ repository, audit, invalidate, validateShareImage }),
  };
}

describe("static-page SEO management", () => {
  it("defines unique approved public routes and excludes private/authentication paths", () => {
    expect(STATIC_SEO_PAGES).toMatchObject({
      home: { path: "/" },
      menu: { path: "/menu" },
      about: { path: "/about" },
      contact: { path: "/contact" },
      blog: { path: "/blog" },
      faq: { path: "/faq" },
      terms: { path: "/terms" },
    });
    expect(new Set(Object.values(STATIC_SEO_PAGES).map((value) => value.path)).size).toBe(
      Object.keys(STATIC_SEO_PAGES).length,
    );
    for (const path of SEO_EXCLUDED_PATH_PREFIXES) expect(isSeoExcludedPath(path)).toBe(true);
    expect(isSeoExcludedPath("/authentication/forgot-password")).toBe(true);
    expect(isSeoExcludedPath("/menu")).toBe(false);
    expect(staticSeoCreateSchema.safeParse({ ...input, key: "authentication" }).success).toBe(
      false,
    );
    expect(staticSeoCreateSchema.safeParse({ ...input, path: "/login" }).success).toBe(false);
  });

  it("allows authorized creation once per approved route", async () => {
    const test = harness();
    const created = await test.services.create(owner, input);
    expect(created).toMatchObject({ key: "home", path: "/", slug: "home", active: true });
    expect(created.translations).toHaveLength(3);
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:seo:list");
    await expect(test.services.create(owner, input)).rejects.toMatchObject({ code: "conflict" });
  });

  it("updates localized metadata without accepting route mutation", async () => {
    const test = harness();
    const created = await test.services.create(owner, input);
    const image = "b".repeat(24);
    const updated = await test.services.update(owner, "home", {
      translations: input.translations.map((entry) => ({
        ...entry,
        title: `${entry.title} | Sara Kitchen`,
      })),
      shareImageMediaId: image,
      robots: { maxImagePreview: "large" },
    });
    expect(updated).toMatchObject({
      id: created.id,
      path: "/",
      slug: "home",
      shareImageMediaId: image,
    });
    expect(test.validateShareImage).toHaveBeenLastCalledWith(image);
  });

  it("enforces action permissions and missing-page behavior", async () => {
    const test = harness();
    await expect(test.services.create({ ...owner, role: "viewer" }, input)).rejects.toBeInstanceOf(
      StaticSeoServiceError,
    );
    await expect(test.services.get(owner, "menu")).rejects.toMatchObject({ code: "not_found" });
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });
});
