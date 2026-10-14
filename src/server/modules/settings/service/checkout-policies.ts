import "server-only";

import type { Connection } from "mongoose";

import type { SupportedLocale } from "@/constants";
import type { StoredRichText } from "@/lib/rich-text";

import { getPolicyVersionModel } from "../model/policy-version";
import type { PolicyDocumentType } from "../validation/policy-version";

const CHECKOUT_POLICY_TYPES = ["terms-of-service", "privacy-policy"] as const;

export type CheckoutPolicy = Readonly<{
  id: string;
  documentType: (typeof CHECKOUT_POLICY_TYPES)[number];
  version: number;
  title: string;
  summary: string;
  sections: readonly Readonly<{ id: string; title: string; content: StoredRichText }>[];
}>;

/** Public, published policy projection for checkout review; drafts never leave the server. */
export async function getCheckoutPolicies(
  connection: Connection,
  locale: SupportedLocale,
  now: Date = new Date(),
): Promise<readonly CheckoutPolicy[]> {
  const records = await getPolicyVersionModel(connection)
    .find({
      documentType: { $in: CHECKOUT_POLICY_TYPES as readonly PolicyDocumentType[] },
      state: "published",
      effectiveAt: { $lte: now },
    })
    .sort({ documentType: 1, version: -1 })
    .lean()
    .exec();
  const selected = new Set<string>();
  const policies: CheckoutPolicy[] = [];
  for (const record of records) {
    if (selected.has(record.documentType)) continue;
    selected.add(record.documentType);
    const translation =
      record.translations.find((entry) => entry.locale === locale) ??
      record.translations.find((entry) => entry.locale === "en");
    if (!translation) continue;
    policies.push({
      id: record._id.toHexString(),
      documentType: record.documentType as CheckoutPolicy["documentType"],
      version: record.version,
      title: translation.title,
      summary: translation.summary,
      sections: translation.sections.map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content,
      })),
    });
  }
  return policies;
}
