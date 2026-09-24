import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sanitizeRichTextImportHtml } from "@/server/rich-text";

describe("rich-text HTML import sanitizer", () => {
  it("removes executable markup, event attributes, unsafe schemes, styles, and embeds", () => {
    const sanitized = sanitizeRichTextImportHtml(`
      <script>alert('xss')</script>
      <p onclick="alert(1)" style="background:url(javascript:alert(1))">Safe text</p>
      <a href="javascript:alert(1)" target="_blank">unsafe</a>
      <a href="https://example.com/article" rel="opener">safe</a>
      <img src="https://attacker.example/tracker.png" onerror="alert(1)">
      <iframe srcdoc="<script>alert(1)</script>"></iframe>
    `);

    expect(sanitized).toContain("Safe text");
    expect(sanitized).toContain('href="https://example.com/article"');
    expect(sanitized).not.toMatch(/script|onclick|style=|javascript:|<img|<iframe|target=|rel=/iu);
  });
});
