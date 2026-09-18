"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

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
  const t = useTranslations("dashboard.categoryEditor");
  const editor = useEditor({
    extensions: [StarterKit],
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
        <Tooltip title={t("bold")}>
          <ToggleButton
            size="small"
            value="bold"
            selected={editor?.isActive("bold") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label={t("bold")}
            sx={{ fontWeight: 700 }}
          >
            B
          </ToggleButton>
        </Tooltip>
        <Tooltip title={t("italic")}>
          <ToggleButton
            size="small"
            value="italic"
            selected={editor?.isActive("italic") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label={t("italic")}
            sx={{ fontStyle: "italic" }}
          >
            I
          </ToggleButton>
        </Tooltip>
        <Tooltip title={t("bulletList")}>
          <ToggleButton
            size="small"
            value="bullet"
            selected={editor?.isActive("bulletList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            aria-label={t("bulletList")}
          >
            •
          </ToggleButton>
        </Tooltip>
        <Tooltip title={t("numberedList")}>
          <ToggleButton
            size="small"
            value="numbered"
            selected={editor?.isActive("orderedList") ?? false}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            aria-label={t("numberedList")}
          >
            1.
          </ToggleButton>
        </Tooltip>
      </Stack>
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
