/** Public entry point for blog authoring and publishing use cases. */
export const MODULE_NAME = "blogs" as const;

export {
  BLOG_CONTENT_MAX_BYTES,
  BLOG_MAX_READ_TIME_MINUTES,
  BLOG_MAX_RELATIONS,
  BLOG_MAX_TAGS,
  BLOG_STATUSES,
  blogSchema,
  getBlogModel,
} from "./model/blog";
export type {
  BlogAuthorSnapshot,
  BlogRecord,
  BlogRichTextDocument,
  BlogStatus,
  BlogTranslation,
} from "./model/blog";
