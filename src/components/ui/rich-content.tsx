import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { Fragment } from "react";

type RichTextMark =
  | { type: "bold" }
  | { type: "code" }
  | { type: "italic" }
  | { type: "underline" }
  | { attrs: { href: string }; type: "link" };

type RichTextTextNode = {
  marks?: readonly RichTextMark[];
  text: string;
  type: "text";
};

type RichTextContainerNode = {
  content?: readonly RichTextNode[];
  type: "blockquote" | "bulletList" | "doc" | "listItem" | "orderedList" | "paragraph";
};

type RichTextHeadingNode = {
  attrs: { level: 2 | 3 | 4 };
  content?: readonly RichTextNode[];
  type: "heading";
};

type RichTextHardBreakNode = { type: "hardBreak" };

export type RichTextNode =
  RichTextContainerNode | RichTextHardBreakNode | RichTextHeadingNode | RichTextTextNode;

export type RichTextDocument = RichTextContainerNode & { type: "doc" };

export type RichContentProps = {
  content: RichTextDocument;
};

function safeHref(href: string): string | undefined {
  if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) {
    return href;
  }

  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? href : undefined;
  } catch {
    return undefined;
  }
}

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
      case "link": {
        const href = safeHref(mark.attrs.href);
        return href ? (
          <Link href={href} key={index} underline="hover">
            {content}
          </Link>
        ) : (
          content
        );
      }
    }
  }, text);
}

function renderChildren(content: readonly RichTextNode[] | undefined, path: string): ReactNode {
  return content?.map((node, index) => (
    <Fragment key={`${path}-${index}`}>{renderNode(node, `${path}-${index}`)}</Fragment>
  ));
}

function renderNode(node: RichTextNode, path: string): ReactNode {
  switch (node.type) {
    case "doc":
      return renderChildren(node.content, path);
    case "paragraph":
      return (
        <Typography component="p" sx={{ mb: 3 }}>
          {renderChildren(node.content, path)}
        </Typography>
      );
    case "heading": {
      const component = `h${node.attrs.level}` as const;
      const variant = node.attrs.level === 2 ? "h2" : node.attrs.level === 3 ? "h3" : "h4";
      return (
        <Typography component={component} sx={{ mb: 3, mt: 6 }} variant={variant}>
          {renderChildren(node.content, path)}
        </Typography>
      );
    }
    case "bulletList":
      return (
        <Box component="ul" sx={{ my: 3, paddingInlineStart: 6 }}>
          {renderChildren(node.content, path)}
        </Box>
      );
    case "orderedList":
      return (
        <Box component="ol" sx={{ my: 3, paddingInlineStart: 6 }}>
          {renderChildren(node.content, path)}
        </Box>
      );
    case "listItem":
      return <Box component="li">{renderChildren(node.content, path)}</Box>;
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
          {renderChildren(node.content, path)}
        </Box>
      );
    case "hardBreak":
      return <br />;
    case "text":
      return renderMarks(node.text, node.marks);
  }
}

export function RichContent({ content }: RichContentProps) {
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
      {renderNode(content, "root")}
    </Box>
  );
}
