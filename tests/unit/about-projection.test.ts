import { describe, expect, it, vi } from "vitest";

import { projectAboutContent } from "@/app/[locale]/(storefront)/about/about-projection";
import { createStoredRichText } from "@/lib/rich-text";
import type { AboutSettingsPayload } from "@/server/modules/settings";

const heroId = "000000000000000000000001";
const kitchenId = "000000000000000000000002";
const teamId = "000000000000000000000003";
const embeddedId = "000000000000000000000004";
const richText = (text: string) =>
  createStoredRichText({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

const settings: AboutSettingsPayload = {
  data: {
    heroMediaId: heroId,
    kitchenMediaIds: [kitchenId],
    teamMembers: [{ id: "chef", portraitMediaId: teamId, enabled: true, order: 1 }],
    values: [{ id: "care", iconMediaId: null, enabled: true, order: 1 }],
    storySections: [
      {
        id: "origins",
        mediaId: null,
        mediaPlacement: "end",
        enabled: true,
        order: 1,
      },
    ],
    callsToAction: [
      {
        id: "menu",
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
        title: "Our story",
        summary: "Persian food in Porto",
        content: createStoredRichText({
          type: "doc",
          content: [
            {
              type: "media",
              attrs: {
                mediaId: embeddedId,
                kind: "image",
                alt: "Kitchen work",
              },
            },
          ],
        }),
        heroMediaAlt: "Kitchen hero",
        kitchenMedia: [{ mediaId: kitchenId, alt: "Kitchen" }],
        teamMembers: [
          {
            id: "chef",
            name: "Sara",
            role: "Chef",
            bio: "",
            portraitAlt: "Sara portrait",
          },
        ],
        values: [{ id: "care", title: "Care", description: "Made with care" }],
        storySections: [
          {
            id: "origins",
            title: "Origins",
            content: richText("Our beginning"),
            mediaAlt: "",
          },
        ],
        callsToAction: [{ id: "menu", label: "Explore the menu" }],
      },
    },
    {
      locale: "pt-PT",
      value: {
        eyebrow: "A nossa cozinha",
        title: "A nossa história",
        summary: "Comida persa no Porto",
        content: richText("História"),
        heroMediaAlt: "Cozinha",
        kitchenMedia: [],
        teamMembers: [],
        values: [],
        storySections: [],
        callsToAction: [{ id: "menu", label: "Ver a ementa" }],
      },
    },
  ],
};

describe("About public projection", () => {
  it("uses item-level canonical fallback without losing localized page copy", async () => {
    const image = vi.fn(async (id: string, alt: string) => ({
      url: `https://example.test/${id}`,
      alt,
    }));
    const content = await projectAboutContent(settings, "pt-PT", image);
    expect(content.title).toBe("A nossa história");
    expect(content.values[0]?.title).toBe("Care");
    expect(content.team[0]?.name).toBe("Sara");
    expect(content.actions[0]?.label).toBe("Ver a ementa");
    expect(content.kitchen[0]?.alt).toBe("Kitchen");
  });

  it("keeps story and values when referenced images cannot be loaded", async () => {
    const content = await projectAboutContent(settings, "fa", async () => null);
    expect(content.hero).toBeNull();
    expect(content.kitchen).toHaveLength(0);
    expect(content.sections[0]?.title).toBe("Origins");
    expect(content.team[0]?.portrait).toBeNull();
  });

  it("resolves embedded image URLs only for published selected rich content", async () => {
    const embed = vi.fn(async (id: string) => ({
      kind: "image" as const,
      url: `https://example.test/${id}`,
    }));
    const content = await projectAboutContent(settings, "en", async () => null, embed);
    expect(content.embeddedMedia[embeddedId]?.url).toContain(embeddedId);
    expect(embed).toHaveBeenCalledExactlyOnceWith(embeddedId, "image");
  });
});
