import { createConnection, Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStoredRichText } from "@/lib/rich-text";
import {
  calculatePolicyContentDigest,
  getPolicyConsentModel,
  getPolicyVersionModel,
  parsePolicyVersionContent,
  type PolicyVersionContent,
} from "@/server/modules/settings";

function content(): PolicyVersionContent {
  const introduction = createStoredRichText({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "These terms govern orders from Sara Kitchen." }],
      },
    ],
  });
  return {
    documentType: "terms-of-service",
    version: 1,
    effectiveAt: new Date("2026-09-01T00:00:00.000Z"),
    sectionIds: ["introduction"],
    translations: [
      {
        locale: "en",
        title: "Terms of service",
        summary: "Terms for ordering from Sara Kitchen.",
        sections: [{ id: "introduction", title: "Introduction", content: introduction }],
      },
      {
        locale: "pt-PT",
        title: "Termos de serviço",
        summary: "Termos para encomendas.",
        sections: [],
      },
    ],
  };
}

describe("Terms and policy settings", () => {
  it("accepts versioned translated rich-text sections and a typed effective date", () => {
    const parsed = parsePolicyVersionContent(content());
    expect(parsed).toMatchObject({
      documentType: "terms-of-service",
      version: 1,
      sectionIds: ["introduction"],
    });
    expect(parsed.effectiveAt).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });

  it("rejects duplicate sections, missing canonical coverage, and unsafe rich content", () => {
    const duplicate = content();
    duplicate.sectionIds.push("introduction");
    expect(() => parsePolicyVersionContent(duplicate)).toThrow(/unique/u);

    const incomplete = content();
    incomplete.translations[0]!.sections = [];
    expect(() => parsePolicyVersionContent(incomplete)).toThrow(/Canonical English/u);

    const unsafe = content() as unknown as Record<string, unknown>;
    const translations = unsafe.translations as Array<{
      sections: Array<{ content: unknown }>;
    }>;
    translations[0]!.sections[0]!.content = {
      schemaVersion: 1,
      document: { type: "doc", content: [{ type: "script", src: "https://evil.test/x.js" }] },
    };
    expect(() => parsePolicyVersionContent(unsafe)).toThrow(/rich-text policy/u);
  });

  it("creates a deterministic SHA-256 evidence digest over exact version content", () => {
    const first = calculatePolicyContentDigest(parsePolicyVersionContent(content()));
    const second = calculatePolicyContentDigest(parsePolicyVersionContent(content()));
    expect(first).toMatch(/^[a-f\d]{64}$/u);
    expect(second).toBe(first);

    const changed = content();
    changed.translations[0]!.title = "Updated terms of service";
    expect(calculatePolicyContentDigest(parsePolicyVersionContent(changed))).not.toBe(first);
  });

  it("requires coherent draft/released/retired publication state", async () => {
    const Policy = getPolicyVersionModel(createConnection());
    const base = {
      ...content(),
      createdByAdminId: new Types.ObjectId(),
    };
    await expect(
      new Policy({
        ...base,
        state: "draft",
        publishedAt: new Date(),
        contentDigest: null,
      }).validate(),
    ).rejects.toThrow(/publication time and a content digest/u);
    await expect(
      new Policy({
        ...base,
        state: "published",
        publishedAt: new Date(),
        contentDigest: "a".repeat(64),
        retiredAt: null,
      }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      new Policy({
        ...base,
        state: "retired",
        publishedAt: new Date("2026-09-02T00:00:00.000Z"),
        contentDigest: "a".repeat(64),
        retiredAt: new Date("2026-09-01T00:00:00.000Z"),
      }).validate(),
    ).rejects.toThrow(/retirement cannot precede/u);
  });

  it("requires account consent to reference the same customer subject", async () => {
    const Consent = getPolicyConsentModel(createConnection());
    const subjectId = new Types.ObjectId();
    const consent = new Consent({
      subjectKind: "account",
      subjectId,
      customerId: new Types.ObjectId(),
      policyVersionId: new Types.ObjectId(),
      policySnapshot: {
        documentType: "terms-of-service",
        version: 1,
        effectiveAt: new Date("2026-09-01T00:00:00.000Z"),
        contentDigest: "a".repeat(64),
      },
      acceptedLocale: "en",
      acceptedAt: new Date("2026-09-02T00:00:00.000Z"),
      source: "signup",
    });
    await expect(consent.validate()).rejects.toThrow(/same customer subject/u);
  });
});
