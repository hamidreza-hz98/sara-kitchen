"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Box from "@mui/material/Box";
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

const EMPTY_DOCUMENT: RichTextDocument = { type: "doc", content: [] };

export function BlogRichEditor({
  value,
  onChange,
  labelledBy,
}: {
  value: StoredRichText;
  onChange: (value: StoredRichText) => void;
  labelledBy: string;
  labels: Readonly<{
    bold: string;
    italic: string;
    heading: string;
    blockquote: string;
    bulletList: string;
    numberedList: string;
  }>;
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
    onUpdate: ({ editor: updated }) =>
      onChange({
        schemaVersion: 1,
        document: storedDocument(updated.getJSON()),
      }),
  });

  useEffect(() => {
    if (
      editor &&
      JSON.stringify(storedDocument(editor.getJSON())) !== JSON.stringify(value.document)
    ) {
      editor.commands.setContent(value.document as JSONContent, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      <RichTextToolbar editor={editor} />
      <Box
        sx={{
          p: 2,
          minHeight: 260,
          "& .tiptap": { minHeight: 220, outline: "none" },
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
        <EditorContent editor={editor} aria-labelledby={labelledBy} />
      </Box>
    </Box>
  );
}

export { EMPTY_DOCUMENT };
