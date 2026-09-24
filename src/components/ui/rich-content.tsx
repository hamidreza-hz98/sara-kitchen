import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { Fragment } from "react";

import {
  isStoredRichText,
  normalizeRichTextHref,
  sanitizeRichTextDocument,
  type RichTextDocument,
  type RichTextMark,
  type RichTextMediaNode,
  type RichTextNode,
  type StoredRichText,
} from "@/lib/rich-text";

export type { RichTextDocument, RichTextNode } from "@/lib/rich-text";

export type RichContentProps = {
  content: RichTextDocument | StoredRichText;
  renderMedia?: (media: RichTextMediaNode) => ReactNode;
};

function renderMarks(text: string, marks: readonly RichTextMark[] = []): ReactNode {
  return marks.reduce<ReactNode>((content, mark, index) => {
    switch (mark.type) {
      case "bold":
        return <strong key={index}>{content}</strong>;
      case "code":
        return <code key={index}>{content}</code>;
      case "italic":
        return <em key={index}>{content}</em>;
      case "underline":
        return <u key={index}>{content}</u>;
      case "strike":
        return <s key={index}>{content}</s>;
      case "link": {
        const href = normalizeRichTextHref(mark.attrs.href);
        const external = href?.startsWith("https://") ?? false;
        return href ? (
          <Link
            href={href}
            key={index}
            underline="hover"
            {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
          >
            {content}
          </Link>
        ) : (
          content
        );
      }
    }
  }, text);
}

function renderChildren(
  content: readonly RichTextNode[] | undefined,
  path: string,
  renderMedia: RichContentProps["renderMedia"],
): ReactNode {
  return content?.map((node, index) => (
    <Fragment key={`${path}-${index}`}>
      {renderNode(node, `${path}-${index}`, renderMedia)}
    </Fragment>
  ));
}

function renderNode(
  node: RichTextNode,
  path: string,
  renderMedia: RichContentProps["renderMedia"],
): ReactNode {
  switch (node.type) {
    case "doc":
      return renderChildren(node.content, path, renderMedia);
    case "paragraph":
      return (
        <Typography component="p" sx={{ mb: 3 }}>
          {renderChildren(node.content, path, renderMedia)}
        </Typography>
      );
    case "heading": {
      const component = `h${node.attrs.level}` as const;
      const variant = node.attrs.level === 2 ? "h2" : node.attrs.level === 3 ? "h3" : "h4";
      return (
        <Typography component={component} sx={{ mb: 3, mt: 6 }} variant={variant}>
          {renderChildren(node.content, path, renderMedia)}
        </Typography>
      );
    }
    case "bulletList":
      return (
        <Box component="ul" sx={{ my: 3, paddingInlineStart: 6 }}>
          {renderChildren(node.content, path, renderMedia)}
        </Box>
      );
    case "orderedList":
      return (
        <Box component="ol" sx={{ my: 3, paddingInlineStart: 6 }}>
          {renderChildren(node.content, path, renderMedia)}
        </Box>
      );
    case "listItem":
      return <Box component="li">{renderChildren(node.content, path, renderMedia)}</Box>;
    case "blockquote":
      return (
        <Box
          component="blockquote"
          sx={{
            my: 4,
            mx: 0,
            paddingInlineStart: 4,
            borderInlineStart: "4px solid",
            borderColor: "primary.main",
          }}
        >
          {renderChildren(node.content, path, renderMedia)}
        </Box>
      );
    case "hardBreak":
      return <br />;
    case "text":
      return renderMarks(node.text, node.marks);
    case "media":
      return renderMedia?.(node) ?? null;
  }
}

export function RichContent({ content, renderMedia }: RichContentProps) {
  const sanitized = sanitizeRichTextDocument(
    isStoredRichText(content) ? content.document : content,
  );
  return (
    <Box
      component="article"
      sx={{
        color: "text.primary",
        overflowWrap: "anywhere",
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& code": {
          px: 1,
          py: 0.5,
          borderRadius: 1,
          bgcolor: "action.hover",
          fontFamily: "monospace",
        },
      }}
    >
      {renderNode(sanitized, "root", renderMedia)}
    </Box>
  );
}
