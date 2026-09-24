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
export { blogViewReceiptSchema, getBlogViewReceiptModel } from "./model/blog-view-receipt";
export type { BlogViewReceiptRecord } from "./model/blog-view-receipt";
export {
  BLOG_PREVIEW_TOKEN_LIFETIME_MS,
  issueBlogPreviewToken,
  verifyBlogPreviewToken,
} from "./policy/preview-token";
export {
  BLOG_VIEW_DEDUPLICATION_WINDOW_MS,
  BLOG_VIEW_MINIMUM_ENGAGEMENT_MS,
  BLOG_VIEW_RECEIPT_RETENTION_MS,
  evaluateBlogViewSignal,
} from "./policy/blog-view";
export type { BlogViewCandidate, BlogViewDecision, BlogViewSignal } from "./policy/blog-view";
export {
  BlogRepositoryConflictError,
  blogWriteFromSnapshot,
  createBlogRepository,
} from "./repository/blog";
export type {
  BlogListOptions,
  BlogListResult,
  BlogRepository,
  BlogSnapshot,
  BlogWrite,
} from "./repository/blog";
export { createBlogViewRepository } from "./repository/blog-view";
export { isPublishedBlogSlug, listPublishedBlogsForSitemap } from "./repository/sitemap";
export type { BlogSitemapEntry } from "./repository/sitemap";
export type { BlogViewPersistenceResult, BlogViewRepository } from "./repository/blog-view";
export { createBlogAuditSink } from "./service/blog-audit";
export { BlogServiceError, createBlogServices } from "./service/blog-crud";
export type {
  BlogAction,
  BlogActor,
  BlogAuditEvent,
  BlogInput,
  BlogPublicDetail,
  BlogPublicItem,
  BlogReferenceInspection,
  BlogReferenceIssue,
  BlogReferenceSet,
  BlogSeoPort,
  BlogServiceDependencies,
  BlogUpdate,
} from "./service/blog-crud";
export { createBlogViewCounter } from "./service/blog-view";
export type { BlogViewWorkScheduler } from "./service/blog-view";
export {
  blogCreateSchema,
  blogDetailQuerySchema,
  blogEmptyMutationSchema,
  blogIdParametersSchema,
  blogManagementListQuerySchema,
  blogPreviewQuerySchema,
  blogPublicListQuerySchema,
  blogScheduleSchema,
  blogSlugParametersSchema,
  blogUpdateSchema,
  blogViewSchema,
} from "./validation/blog-request";
