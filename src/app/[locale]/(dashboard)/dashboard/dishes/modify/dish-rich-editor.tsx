"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/core";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import { useEffect } from "react";

export type RichDocument = JSONContent & { type: "doc" };

const EMPTY_DOCUMENT: RichDocument = { type: "doc", content: [] };

export function DishRichEditor({
  value,
  onChange,
  labelledBy,
  labels,
}: {
  value: RichDocument | null;
  onChange: (value: RichDocument) => void;
  labelledBy: string;
  labels: Readonly<{ bold: string; italic: string; bulletList: string; numberedList: string }>;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
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
      <Stack
        direction="row"
        sx={{ p: 0.75, gap: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tooltip title={labels.bold}>
          <ToggleButton
            size="small"
            value="bold"
            selected={editor?.isActive("bold") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label={labels.bold}
          >
            <strong>B</strong>
          </ToggleButton>
        </Tooltip>
        <Tooltip title={labels.italic}>
          <ToggleButton
            size="small"
            value="italic"
            selected={editor?.isActive("italic") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label={labels.italic}
          >
            <em>I</em>
          </ToggleButton>
        </Tooltip>
        <Tooltip title={labels.bulletList}>
          <ToggleButton
            size="small"
            value="bullet"
            selected={editor?.isActive("bulletList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            aria-label={labels.bulletList}
          >
            •
          </ToggleButton>
        </Tooltip>
        <Tooltip title={labels.numberedList}>
          <ToggleButton
            size="small"
            value="numbered"
            selected={editor?.isActive("orderedList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            aria-label={labels.numberedList}
          >
            1.
          </ToggleButton>
        </Tooltip>
      </Stack>
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
