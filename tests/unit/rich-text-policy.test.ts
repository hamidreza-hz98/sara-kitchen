import { describe, expect, it } from "vitest";

import {
  RICH_TEXT_SCHEMA_VERSION,
  RichTextPolicyError,
  createStoredRichText,
  isStoredRichText,
  normalizeRichTextHref,
  readStoredRichText,
  sanitizeRichTextDocument,
  validateRichTextDocument,
} from "@/lib/rich-text";

const mediaId = "507f1f77bcf86cd799439011";

const validDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Persian food", marks: [{ type: "bold" }] }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Read ", marks: [{ type: "italic" }] },
        {
          type: "text",
          text: "our menu",
          marks: [{ type: "link", attrs: { href: "/menu" } }],
        },
        { type: "hardBreak" },
        { type: "text", text: "today" },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Homemade" }] }],
        },
      ],
    },
    {
      type: "media",
      attrs: { mediaId, kind: "image", alt: "A bowl of Fesenjan", caption: "Made in Porto" },
    },
  ],
} as const;

describe("rich-text document policy", () => {
  it("accepts the versioned semantic allow-list and round-trips current storage", () => {
    expect(validateRichTextDocument(validDocument)).toEqual([]);
    const stored = createStoredRichText(validDocument);
    expect(stored).toEqual({ schemaVersion: RICH_TEXT_SCHEMA_VERSION, document: validDocument });
    expect(readStoredRichText(stored)).toEqual(stored);
    expect(isStoredRichText(stored)).toBe(true);
  });

  it.each([
    ["raw HTML node", { type: "doc", content: [{ type: "html", attrs: { html: "<script />" } }] }],
    ["script node", { type: "doc", content: [{ type: "script", content: [] }] }],
    [
      "event attribute",
      { type: "doc", content: [{ type: "paragraph", attrs: { onClick: "alert(1)" } }] },
    ],
    [
      "JavaScript link",
      {
        type: "doc",
        content: [
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
    ],
    [
      "embedded object URL",
      {
        type: "doc",
        content: [
          {
            type: "media",
            attrs: {
              mediaId,
              kind: "image",
              alt: "Dish",
              src: "https://attacker.example/tracker.png",
            },
          },
        ],
      },
    ],
    [
      "block inside paragraph",
      {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "blockquote", content: [] }] }],
      },
    ],
    ["unknown root field", { type: "doc", content: [], dangerouslySetInnerHTML: {} }],
    ["missing content array", { type: "doc" }],
  ])("rejects %s", (_label, document) => {
    expect(validateRichTextDocument(document)).not.toEqual([]);
    expect(() => createStoredRichText(document)).toThrow(RichTextPolicyError);
  });

  it("defensively strips executable or malformed content on reads", () => {
    const sanitized = sanitizeRichTextDocument({
      type: "doc",
      content: [
        { type: "script", attrs: { src: "https://attacker.example/x.js" } },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "<img src=x onerror=alert(1)>",
              marks: [
                { type: "link", attrs: { href: "data:text/html,<script>alert(1)</script>" } },
                { type: "bold", attrs: { onclick: "alert(1)" } },
              ],
            },
          ],
        },
      ],
    });

    expect(sanitized).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }],
        },
      ],
    });
    expect(JSON.stringify(sanitized)).not.toContain("data:text/html");
    expect(JSON.stringify(sanitized)).not.toContain("onclick");
  });

  it("rejects cycles, oversized text, future versions, and malformed media", () => {
    const cyclic: Record<string, unknown> = { type: "doc", content: [] };
    (cyclic.content as unknown[]).push(cyclic);
    expect(validateRichTextDocument(cyclic)).not.toEqual([]);
    expect(
      validateRichTextDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(500_001) }],
          },
        ],
      }),
    ).toEqual([{ code: "limit_exceeded", path: "document" }]);
    expect(isStoredRichText({ schemaVersion: 2, document: validDocument })).toBe(false);
    expect(() => readStoredRichText({ schemaVersion: 2, document: validDocument })).toThrow(
      /unsupported_version/u,
    );
    expect(
      validateRichTextDocument({
        type: "doc",
        content: [{ type: "media", attrs: { mediaId: "invalid", kind: "image", alt: "Dish" } }],
      }),
    ).not.toEqual([]);
  });

  it.each([
    ["/blog/fesenjan", "/blog/fesenjan"],
    ["#ingredients", "#ingredients"],
    ["https://example.com/article", "https://example.com/article"],
    ["mailto:hello@example.com", "mailto:hello@example.com"],
    ["tel:+351 939 086 377", "tel:+351 939 086 377"],
    ["http://example.com", null],
    ["//example.com", null],
    ["javascript:alert(1)", null],
    ["data:text/html,<script>alert(1)</script>", null],
    ["https://user:password@example.com", null],
  ])("normalizes link %s", (href, expected) => {
    expect(normalizeRichTextHref(href)).toBe(expected);
  });
});
