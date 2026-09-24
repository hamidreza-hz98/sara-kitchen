import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStructuredDataGraph, type SeoMetadataRecord } from "@/server/modules/seo";
import {
  FaqSettingsOperationError,
  applyFaqSettingsOperation,
  parseFaqSettings,
  projectPublicFaqSettings,
  toFaqStructuredDataInputs,
  type FaqSettingsPayload,
} from "@/server/modules/settings";

function payload(): FaqSettingsPayload {
  return {
    data: {
      entries: [
        { id: "delivery-area", active: true, order: 1 },
        { id: "order-ahead", active: true, order: 2 },
        { id: "old-question", active: false, order: 3 },
      ],
    },
    translations: [
      {
        locale: "en",
        value: {
          title: "Frequently asked questions",
          description: "Answers about ordering from Sara Kitchen.",
          entries: [
            {
              id: "delivery-area",
              question: "Where do you deliver?",
              answer: "Throughout the city of Porto.",
            },
            {
              id: "order-ahead",
              question: "How early should I order?",
              answer: "Please order at least 24 hours in advance.",
            },
            { id: "old-question", question: "Old question?", answer: "Old answer." },
          ],
        },
      },
      {
        locale: "pt-PT",
        value: {
          title: "Perguntas frequentes",
          description: "Respostas sobre encomendas.",
          entries: [
            {
              id: "delivery-area",
              question: "Onde fazem entregas?",
              answer: "Em toda a cidade do Porto.",
            },
          ],
        },
      },
    ],
  };
}

function faqSeoRecord(inputs: Readonly<Record<string, unknown>>): SeoMetadataRecord {
  return {
    path: "/faq",
    canonicalUrl: null,
    translations: [
      {
        locale: "pt-PT",
        title: "Perguntas frequentes",
        description: "Respostas sobre encomendas.",
        keywords: [],
        openGraph: { title: null, description: null },
        twitter: { title: null, description: null },
      },
    ],
    robots: {
      index: true,
      follow: true,
      noArchive: false,
      noImageIndex: false,
      noSnippet: false,
      maxSnippet: -1,
      maxImagePreview: "large",
      maxVideoPreview: -1,
    },
    openGraph: { type: "website", siteName: null },
    twitter: { card: "summary_large_image", creator: null, site: null },
    shareImageMediaId: null,
    structuredData: { types: ["faq-page"], inputs: { ...inputs } },
    targetType: "static",
    entityKind: null,
  };
}

describe("FAQ settings", () => {
  it("accepts stable IDs, active state, order, and partial non-canonical locales", () => {
    const parsed = parseFaqSettings(payload());
    expect(parsed.data.entries.map(({ id }) => id)).toEqual([
      "delivery-area",
      "order-ahead",
      "old-question",
    ]);
  });

  it("requires unique identity/order and complete canonical English content", () => {
    const duplicate = payload();
    duplicate.data.entries[1]!.id = "delivery-area";
    duplicate.data.entries[1]!.order = 1;
    expect(() => parseFaqSettings(duplicate)).toThrow(/unique/u);

    const incomplete = payload();
    incomplete.translations[0]!.value.entries.pop();
    expect(() => parseFaqSettings(incomplete)).toThrow(/Canonical English/u);
  });

  it("resolves each active item through requested, configured, then English fallback", () => {
    const projected = projectPublicFaqSettings(parseFaqSettings(payload()), "fa", "pt-PT");
    expect(projected.entries).toEqual([
      expect.objectContaining({
        id: "delivery-area",
        question: "Onde fazem entregas?",
        resolvedLocale: "pt-PT",
        isFallback: true,
      }),
      expect.objectContaining({
        id: "order-ahead",
        question: "How early should I order?",
        resolvedLocale: "en",
        isFallback: true,
      }),
    ]);
    expect(projected.entries.some(({ id }) => id === "old-question")).toBe(false);
  });

  it("adds and edits entries immutably while enforcing canonical content", () => {
    const current = parseFaqSettings(payload());
    const added = applyFaqSettingsOperation(current, {
      type: "add",
      id: "pickup",
      translations: [
        { locale: "en", question: "Can I collect my order?", answer: "Yes, pickup is free." },
        { locale: "pt-PT", question: "Posso levantar?", answer: "Sim, a recolha é gratuita." },
      ],
    });
    const edited = applyFaqSettingsOperation(added, {
      type: "edit",
      id: "pickup",
      active: false,
      translations: [
        { locale: "en", question: "Is pickup available?", answer: "Yes, pickup remains free." },
      ],
    });
    expect(current.data.entries.some(({ id }) => id === "pickup")).toBe(false);
    expect(edited.data.entries.find(({ id }) => id === "pickup")?.active).toBe(false);
    expect(edited.translations[0]?.value.entries.find(({ id }) => id === "pickup")?.question).toBe(
      "Is pickup available?",
    );
    expect(() =>
      applyFaqSettingsOperation(current, {
        type: "add",
        id: "pickup",
        translations: [{ locale: "pt-PT", question: "Posso levantar?", answer: "Sim." }],
      }),
    ).toThrow(/Canonical English/u);
  });

  it("reorders the exact ID set and rejects partial or duplicate reorder requests", () => {
    const current = parseFaqSettings(payload());
    const reordered = applyFaqSettingsOperation(current, {
      type: "reorder",
      ids: ["old-question", "order-ahead", "delivery-area"],
    });
    expect(
      reordered.data.entries
        .toSorted((left, right) => left.order - right.order)
        .map(({ id }) => id),
    ).toEqual(["old-question", "order-ahead", "delivery-area"]);
    expect(current.data.entries[0]?.order).toBe(1);
    expect(() =>
      applyFaqSettingsOperation(current, {
        type: "reorder",
        ids: ["delivery-area", "delivery-area"],
      }),
    ).toThrow(FaqSettingsOperationError);
  });

  it("removes entries and all localized copies while compacting order", () => {
    const removed = applyFaqSettingsOperation(parseFaqSettings(payload()), {
      type: "remove",
      id: "delivery-area",
    });
    expect(removed.data.entries.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: "order-ahead", order: 0 },
      { id: "old-question", order: 1 },
    ]);
    expect(
      removed.translations.every((translation) =>
        translation.value.entries.every(({ id }) => id !== "delivery-area"),
      ),
    ).toBe(true);
  });

  it("feeds active localized FAQs into the validated FAQPage structured-data generator", () => {
    const settings = projectPublicFaqSettings(parseFaqSettings(payload()), "pt-PT");
    const inputs = toFaqStructuredDataInputs(settings);
    const graph = createStructuredDataGraph(faqSeoRecord(inputs), "pt-PT", {
      url: "https://sarakitchen.pt",
      name: "Sara Kitchen",
    });
    const faqNode = graph?.["@graph"].find(({ "@type": type }) => type === "FAQPage");
    expect(faqNode).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [{ name: "Onde fazem entregas?" }, { name: "How early should I order?" }],
    });
  });
});
