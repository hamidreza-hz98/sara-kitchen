"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import FormatBoldRounded from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRounded from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRounded from "@mui/icons-material/FormatUnderlinedRounded";
import StrikethroughSRounded from "@mui/icons-material/StrikethroughSRounded";
import FormatListBulletedRounded from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRounded from "@mui/icons-material/FormatListNumberedRounded";
import FormatQuoteRounded from "@mui/icons-material/FormatQuoteRounded";
import FormatClearRounded from "@mui/icons-material/FormatClearRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import RedoRounded from "@mui/icons-material/RedoRounded";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function RichTextToolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations("dashboard.richTextToolbar");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            underline: current.isActive("underline"),
            strike: current.isActive("strike"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            quote: current.isActive("blockquote"),
            bullet: current.isActive("bulletList"),
            ordered: current.isActive("orderedList"),
            undo: current.can().undo(),
            redo: current.can().redo(),
          }
        : null,
  });
  type Action = {
    label: string;
    icon: ReactNode;
    run: () => void;
    active?: boolean | undefined;
    disabled?: boolean;
    toggle?: boolean;
  };
  const groups: Action[][] = [
    [
      {
        label: t("bold"),
        icon: <FormatBoldRounded />,
        active: state?.bold,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleBold().run();
        },
      },
      {
        label: t("italic"),
        icon: <FormatItalicRounded />,
        active: state?.italic,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleItalic().run();
        },
      },
      {
        label: t("underline"),
        icon: <FormatUnderlinedRounded />,
        active: state?.underline,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleUnderline().run();
        },
      },
      {
        label: t("strike"),
        icon: <StrikethroughSRounded />,
        active: state?.strike,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleStrike().run();
        },
      },
    ],
    [
      {
        label: t("heading2"),
        icon: "H2",
        active: state?.h2,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleHeading({ level: 2 }).run();
        },
      },
      {
        label: t("heading3"),
        icon: "H3",
        active: state?.h3,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleHeading({ level: 3 }).run();
        },
      },
      {
        label: t("quote"),
        icon: <FormatQuoteRounded />,
        active: state?.quote,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleBlockquote().run();
        },
      },
    ],
    [
      {
        label: t("bulletList"),
        icon: <FormatListBulletedRounded />,
        active: state?.bullet,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleBulletList().run();
        },
      },
      {
        label: t("numberedList"),
        icon: <FormatListNumberedRounded />,
        active: state?.ordered,
        toggle: true,
        run: () => {
          editor?.chain().focus().toggleOrderedList().run();
        },
      },
      {
        label: t("clear"),
        icon: <FormatClearRounded />,
        run: () => {
          editor?.chain().focus().unsetAllMarks().clearNodes().run();
        },
      },
    ],
    [
      {
        label: t("undo"),
        icon: <UndoRounded />,
        disabled: !state?.undo,
        run: () => {
          editor?.chain().focus().undo().run();
        },
      },
      {
        label: t("redo"),
        icon: <RedoRounded />,
        disabled: !state?.redo,
        run: () => {
          editor?.chain().focus().redo().run();
        },
      },
    ],
  ];
  return (
    <Box
      role="toolbar"
      aria-label={t("toolbar")}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.75,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    >
      {groups.map((group, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            gap: 0.25,
            alignItems: "center",
            ...(index
              ? { borderInlineStart: "1px solid", borderColor: "divider", ps: 0.75, ms: 0.25 }
              : {}),
          }}
        >
          {group.map((action) => (
            <Tooltip title={action.label} key={action.label}>
              <span>
                <IconButton
                  type="button"
                  size="small"
                  aria-label={action.label}
                  aria-pressed={action.toggle ? !!action.active : undefined}
                  disabled={!editor || action.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={action.run}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    fontSize: 13,
                    fontWeight: 800,
                    color: action.active ? "primary.dark" : "text.secondary",
                    bgcolor: action.active ? "action.selected" : "transparent",
                    "& .MuiSvgIcon-root": { fontSize: 20 },
                  }}
                >
                  {action.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Box>
      ))}
    </Box>
  );
}
