import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Sanitize legacy/import HTML before parsing it into the JSON document format. The returned HTML
 * is an interchange value only: it must be converted and validated, never persisted or rendered.
 */
export function sanitizeRichTextImportHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "code",
      "a",
    ],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    nestingLimit: 12,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "template"],
    parseStyleAttributes: false,
  });
}
