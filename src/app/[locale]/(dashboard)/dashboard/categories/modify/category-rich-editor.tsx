"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Box from "@mui/material/Box";
import { useEffect } from "react";

import { RichTextToolbar } from "@/components/ui/rich-text-toolbar";

function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function editorContent(value: string): string {
  return value.includes("<") ? value : `<p>${escapeHtml(value)}</p>`;
}

export function CategoryRichEditor({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        horizontalRule: false,
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: editorContent(value),
    immediatelyRender: false,
    onUpdate: ({ editor: updated }) => onChange(updated.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== editorContent(value))
      editor.commands.setContent(editorContent(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <RichTextToolbar editor={editor} />
      <Box
        sx={{
          p: 2,
          minHeight: 150,
          "& .tiptap": { minHeight: 120, outline: "none" },
          "& .tiptap p": { m: 0 },
          "& .tiptap ul, & .tiptap ol": { ps: 3 },
        }}
      >
        <EditorContent editor={editor} aria-labelledby={labelledBy} />
      </Box>
    </Box>
  );
}
