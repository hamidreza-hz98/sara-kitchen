import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { getBlogModel } from "../model/blog";
import { getBlogViewReceiptModel } from "../model/blog-view-receipt";
import type { BlogViewCandidate } from "../policy/blog-view";

export type BlogViewPersistenceResult = "counted" | "duplicate" | "blog_unavailable";
export interface BlogViewRepository {
  count(candidate: BlogViewCandidate): Promise<BlogViewPersistenceResult>;
}

export function createBlogViewRepository(connection: Connection): BlogViewRepository {
  const Blog = getBlogModel(connection);
  const Receipt = getBlogViewReceiptModel(connection);
  return {
    async count(candidate) {
      const blogId = new Types.ObjectId(candidate.blogId);
      let claim;
      try {
        claim = await Receipt.updateOne(
          {
            blogId,
            visitorHash: candidate.visitorHash,
            windowStartedAt: candidate.windowStartedAt,
          },
          {
            $setOnInsert: {
              blogId,
              visitorHash: candidate.visitorHash,
              windowStartedAt: candidate.windowStartedAt,
              expiresAt: candidate.expiresAt,
            },
          },
          { upsert: true },
        );
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000)
          return "duplicate";
        throw error;
      }
      if (claim.upsertedCount !== 1) return "duplicate";
      const receipt = {
        blogId,
        visitorHash: candidate.visitorHash,
        windowStartedAt: candidate.windowStartedAt,
      };
      try {
        const result = await Blog.updateOne(
          {
            _id: blogId,
            deletedAt: null,
            status: "published",
            viewCount: { $lt: Number.MAX_SAFE_INTEGER },
          },
          { $inc: { viewCount: 1 } },
        );
        if (result.modifiedCount === 1) return "counted";
        await Receipt.deleteOne(receipt);
        return "blog_unavailable";
      } catch (error) {
        await Receipt.deleteOne(receipt).catch(() => undefined);
        throw error;
      }
    },
  };
}
