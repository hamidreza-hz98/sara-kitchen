import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText } from "@/lib/rich-text";
import {
  BlogServiceError,
  createBlogServices,
  type BlogInput,
  type BlogRepository,
  type BlogSnapshot,
  type BlogWrite,
} from "@/server/modules/blogs";

const actor = { id: "1".repeat(24), displayName: "Sara Kazemi", role: "content_editor" as const };
const at = new Date("2026-09-24T12:00:00.000Z");
const content = (text: string) =>
  createStoredRichText({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
const input: BlogInput = {
  translations: [
    {
      locale: "en",
      title: "Persian Pantry",
      excerpt: "English excerpt",
      content: content("English"),
    },
    { locale: "pt-PT", title: "Despensa Persa", excerpt: "Resumo", content: content("Português") },
    { locale: "fa", title: "آشپزخانه ایرانی", excerpt: "خلاصه", content: content("فارسی") },
  ],
  tags: ["persian-food"],
};

function harness() {
  let sequence = 0;
  const values = new Map<string, BlogSnapshot>();
  const writeSnapshot = (id: string, write: BlogWrite, previous?: BlogSnapshot): BlogSnapshot => ({
    id,
    ...write,
    publishAt: write.publishAt?.toISOString() ?? null,
    publishedAt: write.publishedAt?.toISOString() ?? null,
    seoPageId: previous?.seoPageId ?? null,
    viewCount: previous?.viewCount ?? 0,
    deletedAt: null,
    version: (previous?.version ?? -1) + 1,
    createdAt: previous?.createdAt ?? at.toISOString(),
    updatedAt: at.toISOString(),
  });
  const repository: BlogRepository = {
    findById: vi.fn(async (id) => values.get(id) ?? null),
    findBySlug: vi.fn(
      async (slug, publishedOnly = false) =>
        [...values.values()].find(
          (value) => value.slug === slug && (!publishedOnly || value.status === "published"),
        ) ?? null,
    ),
    list: vi.fn(async () => ({ items: [...values.values()], total: values.size })),
    listPublic: vi.fn(async () => {
      const items = [...values.values()].filter((value) => value.status === "published");
      return { items, total: items.length };
    }),
    isSlugTaken: vi.fn(async (slug, excludingId) =>
      [...values.values()].some((value) => value.slug === slug && value.id !== excludingId),
    ),
    wouldCreateRelationshipCycle: vi.fn(async () => false),
    create: vi.fn(async (write) => {
      const id = (++sequence).toString(16).padStart(24, "0");
      const value = writeSnapshot(id, write);
      values.set(id, value);
      return value;
    }),
    save: vi.fn(async (current, write) => {
      const value = writeSnapshot(current.id, write, current);
      values.set(current.id, value);
      return value;
    }),
    setSeoPageId: vi.fn(async (current, seoPageId) => {
      const value = { ...current, seoPageId, version: current.version + 1 };
      values.set(current.id, value);
      return value;
    }),
    removeInboundRelationships: vi.fn(async () => []),
    publishDue: vi.fn(async () => []),
  };
  const audit = vi.fn(async () => undefined);
  const invalidate = vi.fn();
  const removeInboundDishRelationships = vi.fn(async () => [] as readonly string[]);
  const seo = { sync: vi.fn(async () => "f".repeat(24)) };
  const services = createBlogServices({
    repository,
    inspectReferences: vi.fn(async () => ({ missing: [], archived: [] })),
    removeInboundDishRelationships,
    seo,
    audit,
    invalidate,
    previewSecret: "preview-secret-longer-than-thirty-two-characters",
    now: () => at,
  });
  return {
    services,
    repository,
    audit,
    invalidate,
    seo,
    values,
    removeInboundDishRelationships,
  };
}

describe("blog CRUD and publishing", () => {
  let test: ReturnType<typeof harness>;
  beforeEach(() => {
    test = harness();
  });

  it("creates a draft with server-owned author, slug, SEO, audit, and cache invalidation", async () => {
    const created = await test.services.create(actor, input);
    expect(created).toMatchObject({
      slug: "persian-pantry",
      status: "draft",
      authorAdminId: actor.id,
      authorSnapshot: { displayName: actor.displayName },
      seoPageId: "f".repeat(24),
    });
    expect(test.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", outcome: "success", blogId: created.id }),
    );
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:blogs:list");
    expect(test.invalidate).toHaveBeenCalledWith("sk:v1:seo:list");
  });

  it("keeps drafts private, supports authorized preview, then publish and unpublish", async () => {
    const created = await test.services.create(actor, input);
    await expect(test.services.getPublicBySlug(created.slug)).rejects.toMatchObject({
      code: "not_found",
    });
    const preview = await test.services.issuePreview(actor, created.id);
    await expect(test.services.previewBySlug(created.slug, preview.token)).resolves.toMatchObject({
      id: created.id,
    });
    await expect(
      test.services.previewBySlug(created.slug, `${preview.token}x`),
    ).rejects.toMatchObject({ code: "preview_denied" });

    const published = await test.services.publish(actor, created.id);
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBe(at.toISOString());
    await expect(test.services.getPublicBySlug(created.slug, "fa")).resolves.toMatchObject({
      title: "آشپزخانه ایرانی",
      content: input.translations[2]?.content,
    });

    const draft = await test.services.unpublish(actor, created.id);
    expect(draft).toMatchObject({ status: "draft", publishedAt: at.toISOString() });
    await expect(test.services.getPublicBySlug(created.slug)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(test.services.previewBySlug(created.slug, preview.token)).rejects.toMatchObject({
      code: "preview_denied",
    });
  });

  it("schedules only future publication and archives with relationship cleanup", async () => {
    const created = await test.services.create(actor, input);
    await expect(test.services.schedule(actor, created.id, at)).rejects.toMatchObject({
      code: "invalid_input",
    });
    const future = new Date(at.getTime() + 60_000);
    await expect(test.services.schedule(actor, created.id, future)).resolves.toMatchObject({
      status: "scheduled",
      publishAt: future.toISOString(),
    });
    await expect(test.services.archive(actor, created.id)).resolves.toMatchObject({
      status: "archived",
    });
    expect(test.repository.removeInboundRelationships).toHaveBeenCalledWith(created.id, actor.id);
    expect(test.removeInboundDishRelationships).toHaveBeenCalledWith(created.id, actor.id);
  });

  it("does not schedule an incomplete launch-locale draft", async () => {
    const created = await test.services.create(actor, {
      translations: [input.translations[0]!],
    });
    await expect(
      test.services.schedule(actor, created.id, new Date(at.getTime() + 60_000)),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("rejects missing references, cycles, and actors without publishing permission", async () => {
    const created = await test.services.create(actor, input);
    vi.mocked(test.repository.wouldCreateRelationshipCycle).mockResolvedValueOnce(true);
    await expect(
      test.services.update(actor, created.id, { relatedBlogIds: ["a".repeat(24)] }),
    ).rejects.toMatchObject({ code: "circular_relationship" });
    await expect(
      test.services.publish({ ...actor, role: "viewer" }, created.id),
    ).rejects.toBeInstanceOf(BlogServiceError);
    expect(test.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "denied" }));
  });
});
