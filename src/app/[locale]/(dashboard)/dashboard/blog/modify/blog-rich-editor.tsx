"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import { useEffect } from "react";

import type { RichTextDocument, StoredRichText } from "@/lib/rich-text";

const EMPTY_DOCUMENT: RichTextDocument = { type: "doc", content: [] };

export function BlogRichEditor({
  value,
  onChange,
  labelledBy,
  labels,
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
        document: updated.getJSON() as RichTextDocument,
      }),
  });

  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value.document)) {
      editor.commands.setContent(value.document as JSONContent, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      <Stack
        direction="row"
        sx={{
          p: 0.75,
          gap: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexWrap: "wrap",
        }}
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
        <Tooltip title={labels.heading}>
          <ToggleButton
            size="small"
            value="heading"
            selected={editor?.isActive("heading", { level: 2 }) ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label={labels.heading}
          >
            H2
          </ToggleButton>
        </Tooltip>
        <Tooltip title={labels.blockquote}>
          <ToggleButton
            size="small"
            value="blockquote"
            selected={editor?.isActive("blockquote") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            aria-label={labels.blockquote}
          >
            “ ”
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
