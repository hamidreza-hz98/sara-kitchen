"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Box from "@mui/material/Box";
import FormLabel from "@mui/material/FormLabel";
import { useEffect } from "react";

import { RichTextToolbar } from "@/components/ui/rich-text-toolbar";
import {
  sanitizeRichTextDocument,
  type RichTextDocument,
  type StoredRichText,
} from "@/lib/rich-text";

function storedDocument(node: JSONContent): RichTextDocument {
  function clean(value: JSONContent): JSONContent {
    const result = { ...value };
    if (result.type === "orderedList") delete result.attrs;
    if (result.marks)
      result.marks = result.marks.map((mark) =>
        mark.type === "link" ? { type: "link", attrs: { href: mark.attrs?.href } } : mark,
      );
    if (result.content) result.content = result.content.map(clean);
    return result;
  }
  return sanitizeRichTextDocument(clean(node));
}

export const EMPTY_STORED_RICH_TEXT: StoredRichText = {
  schemaVersion: 1,
  document: { type: "doc", content: [] },
};

export function SettingsRichTextField({
  label,
  value,
  disabled,
  direction,
  required = false,
  minHeight = 180,
  onChange,
}: {
  label: string;
  value: StoredRichText;
  disabled: boolean;
  direction: "ltr" | "rtl";
  required?: boolean;
  minHeight?: number;
  onChange: (value: StoredRichText) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
      }),
    ],
    content: value.document as JSONContent,
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor: updated }) =>
      onChange({ schemaVersion: 1, document: storedDocument(updated.getJSON()) }),
  });

  useEffect(() => {
    if (
      editor &&
      JSON.stringify(storedDocument(editor.getJSON())) !== JSON.stringify(value.document)
    ) {
      editor.commands.setContent(value.document as JSONContent, { emitUpdate: false });
    }
    editor?.setEditable(!disabled);
  }, [disabled, editor, value]);

  return (
    <Box sx={{ minWidth: 0 }}>
      <FormLabel required={required} sx={{ display: "block", mb: 0.75 }}>
        {label}
      </FormLabel>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <RichTextToolbar editor={disabled ? null : editor} />
        <Box
          sx={{
            p: 2,
            minHeight,
            "& .tiptap": { minHeight: minHeight - 30, outline: "none" },
            "& .tiptap p": { my: 1 },
            "& .tiptap ul, & .tiptap ol": { ps: 3 },
            "& .tiptap blockquote": {
              borderInlineStart: 3,
              borderColor: "primary.main",
              ps: 2,
              color: "text.secondary",
            },
          }}
        >
          <Box dir={direction}>
            <EditorContent editor={editor} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
