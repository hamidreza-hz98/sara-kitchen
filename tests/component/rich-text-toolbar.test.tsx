import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { BlogRichEditor } from "@/app/[locale]/(dashboard)/dashboard/blog/modify/blog-rich-editor";
import { isStoredRichText } from "@/lib/rich-text";
import messages from "@/locales/messages/en";

describe("rich text toolbar", () => {
  it("formats text, updates the active state, and emits a valid article document", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <span id="article-label">Article content</span>
        <BlogRichEditor
          value={{ schemaVersion: 1, document: { type: "doc", content: [] } }}
          onChange={onChange}
          labelledBy="article-label"
          labels={{
            bold: "Bold",
            italic: "Italic",
            heading: "Heading",
            blockquote: "Quote",
            bulletList: "Bullets",
            numberedList: "Numbers",
          }}
        />
      </NextIntlClientProvider>,
    );
    const bold = await screen.findByRole("button", { name: "Bold" });
    await waitFor(() => expect(bold).toBeEnabled());
    const input = container.querySelector<HTMLElement>(".tiptap");
    expect(input).not.toBeNull();
    document.elementFromPoint = () => input!;
    await user.click(input!);
    await user.click(bold);
    await waitFor(() => expect(bold).toHaveAttribute("aria-pressed", "true"));
    await user.type(input!, "Hello");
    await user.click(screen.getByRole("button", { name: "Numbered list" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const value = onChange.mock.lastCall?.[0];
    expect(isStoredRichText(value)).toBe(true);
    expect(value.document.content[0].type).toBe("orderedList");
    expect(screen.getByRole("button", { name: "Numbered list" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });
});
