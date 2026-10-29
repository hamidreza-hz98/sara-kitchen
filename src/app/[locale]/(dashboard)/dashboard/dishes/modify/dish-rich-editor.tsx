"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import Box from "@mui/material/Box";
import { useEffect } from "react";

import { RichTextToolbar } from "@/components/ui/rich-text-toolbar";

export type RichDocument = JSONContent & { type: "doc" };

const EMPTY_DOCUMENT: RichDocument = { type: "doc", content: [] };

export function DishRichEditor({
  value,
  onChange,
  labelledBy,
}: {
  value: RichDocument | null;
  onChange: (value: RichDocument) => void;
  labelledBy: string;
  labels: Readonly<{ bold: string; italic: string; bulletList: string; numberedList: string }>;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: value ?? EMPTY_DOCUMENT,
    immediatelyRender: false,
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON() as RichDocument),
  });

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value ?? EMPTY_DOCUMENT)) {
      editor.commands.setContent(value ?? EMPTY_DOCUMENT, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      <RichTextToolbar editor={editor} />
      <Box
        sx={{
          p: 2,
          minHeight: 180,
          "& .tiptap": { minHeight: 145, outline: "none" },
          "& .tiptap p": { m: 0 },
          "& .tiptap ul, & .tiptap ol": { ps: 3 },
        }}
      >
        <EditorContent editor={editor} aria-labelledby={labelledBy} />
      </Box>
    </Box>
  );
}
