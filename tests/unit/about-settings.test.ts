import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText, type StoredRichText } from "@/lib/rich-text";
import {
  AboutSettingsReferenceError,
  collectAboutMediaUses,
  parseAboutSettings,
  validateAboutSettingsMediaReferences,
  type AboutReferenceDependencies,
  type AboutSettingsPayload,
} from "@/server/modules/settings";

const ids = {
  hero: "000000000000000000000001",
  kitchen: "000000000000000000000002",
  portrait: "000000000000000000000003",
  icon: "000000000000000000000004",
  story: "000000000000000000000005",
  embeddedImage: "000000000000000000000006",
  embeddedVideo: "000000000000000000000007",
};

function richText(text: string, media?: { id: string; kind: "image" | "video" }): StoredRichText {
  return createStoredRichText({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text }] },
      ...(media
        ? [
            {
              type: "media" as const,
              attrs: { mediaId: media.id, kind: media.kind, alt: `${text} media` },
            },
          ]
        : []),
    ],
  });
}

function payload(): AboutSettingsPayload {
  return {
    data: {
      heroMediaId: ids.hero,
      kitchenMediaIds: [ids.kitchen],
      teamMembers: [{ id: "chef-sara", portraitMediaId: ids.portrait, enabled: true, order: 1 }],
      values: [{ id: "homemade", iconMediaId: ids.icon, enabled: true, order: 1 }],
      storySections: [
        {
          id: "our-beginning",
          mediaId: ids.story,
          mediaPlacement: "end",
          enabled: true,
          order: 1,
        },
      ],
      callsToAction: [
        {
          id: "explore-menu",
          href: "/menu",
          openInNewTab: false,
          variant: "primary",
          enabled: true,
          order: 1,
        },
      ],
    },
    translations: [
      {
        locale: "en",
        value: {
          eyebrow: "Our kitchen",
          title: "Persian food, made with care",
          summary: "Sara Kitchen brings home-cooked Persian food to Porto.",
          content: richText("Our story", { id: ids.embeddedImage, kind: "image" }),
          heroMediaAlt: "Sara preparing Persian food",
          kitchenMedia: [{ mediaId: ids.kitchen, alt: "Sara Kitchen workspace" }],
          teamMembers: [
            {
              id: "chef-sara",
              name: "Sara Kazemi",
              role: "Chef and founder",
              bio: "Cooking Persian recipes in Porto.",
              portraitAlt: "Portrait of Sara Kazemi",
            },
          ],
          values: [
            { id: "homemade", title: "Homemade", description: "Prepared in small batches." },
          ],
          storySections: [
            {
              id: "our-beginning",
              title: "Our beginning",
              content: richText("From Iran to Porto", {
                id: ids.embeddedVideo,
                kind: "video",
              }),
              mediaAlt: "Traditional Persian ingredients",
            },
          ],
          callsToAction: [{ id: "explore-menu", label: "Explore the menu" }],
        },
      },
      {
        locale: "pt-PT",
        value: {
          eyebrow: "A nossa cozinha",
          title: "Comida persa feita com carinho",
          summary: "Comida caseira persa no Porto.",
          content: richText("A nossa história"),
          heroMediaAlt: "Sara a preparar comida persa",
          kitchenMedia: [],
          teamMembers: [],
          values: [],
          storySections: [],
          callsToAction: [{ id: "explore-menu", label: "Ver o menu" }],
        },
      },
    ],
  };
}

function mediaDependencies(
  overrides: Readonly<
    Record<string, { kind: "image" | "video"; processingState: "ready" | "failed" }>
  > = {},
): AboutReferenceDependencies {
  return {
    getMedia: async (mediaIds) =>
      mediaIds.map((id) => ({
        id,
        kind: overrides[id]?.kind ?? (id === ids.embeddedVideo ? "video" : "image"),
        processingState: overrides[id]?.processingState ?? "ready",
      })),
  };
}

describe("About settings", () => {
  it("accepts translated rich content, kitchen/team media, values, stories, and calls to action", () => {
    const parsed = parseAboutSettings(payload());
    expect(parsed.data.teamMembers[0]?.id).toBe("chef-sara");
    expect(parsed.translations[0]?.value.content.schemaVersion).toBe(1);
  });

  it("rejects unsafe rich-text content rather than storing executable markup", () => {
    const unsafe = payload() as unknown as Record<string, unknown>;
    const translations = unsafe.translations as Array<{ value: { content: unknown } }>;
    translations[0]!.value.content = {
      schemaVersion: 1,
      document: {
        type: "doc",
        content: [
          { type: "script", content: [{ type: "text", text: "alert(document.cookie)" }] },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "click",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      },
    };
    expect(() => parseAboutSettings(unsafe)).toThrow(/rich-text policy/u);
  });

  it("rejects unsafe calls to action and duplicate item identity/order", () => {
    const unsafe = payload();
    unsafe.data.callsToAction[0]!.href = "javascript:alert(1)";
    expect(() => parseAboutSettings(unsafe)).toThrow(/public internal path/u);

    const duplicate = payload();
    duplicate.data.values.push({ ...duplicate.data.values[0]! });
    expect(() => parseAboutSettings(duplicate)).toThrow(/unique/u);
  });

  it("requires complete canonical English references and accessible media text", () => {
    const incomplete = payload();
    incomplete.translations[0]!.value.teamMembers = [];
    incomplete.translations[0]!.value.heroMediaAlt = "";
    expect(() => parseAboutSettings(incomplete)).toThrow(/Canonical English/u);
  });

  it("collects explicit and embedded media references from every localized rich document", () => {
    const uses = collectAboutMediaUses(parseAboutSettings(payload()));
    expect(uses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.hero, kind: "image", path: "data.heroMediaId" }),
        expect.objectContaining({ id: ids.portrait, kind: "image" }),
        expect.objectContaining({ id: ids.embeddedImage, kind: "image" }),
        expect.objectContaining({ id: ids.embeddedVideo, kind: "video" }),
      ]),
    );
  });

  it("accepts existing, ready media whose kind matches its use", async () => {
    await expect(
      validateAboutSettingsMediaReferences(parseAboutSettings(payload()), mediaDependencies()),
    ).resolves.toBeUndefined();
  });

  it("rejects missing, wrong-kind, and unprocessed media with field-safe paths", async () => {
    const parsed = parseAboutSettings(payload());
    const dependencies: AboutReferenceDependencies = {
      getMedia: async (mediaIds) =>
        mediaIds
          .filter((id) => id !== ids.story)
          .map((id) => ({
            id,
            kind: "image",
            processingState: id === ids.portrait ? "failed" : "ready",
          })),
    };
    const validation = validateAboutSettingsMediaReferences(parsed, dependencies);
    await expect(validation).rejects.toBeInstanceOf(AboutSettingsReferenceError);
    await expect(validation).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "missing", id: ids.story }),
        expect.objectContaining({ code: "media_not_ready", id: ids.portrait }),
        expect.objectContaining({
          code: "wrong_media_kind",
          id: ids.embeddedVideo,
          expectedKind: "video",
        }),
      ]),
    });
  });
});
