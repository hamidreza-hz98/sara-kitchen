import "server-only";

import type { ApplicationLogger } from "@/server/observability";

import { evaluateBlogViewSignal, type BlogViewSignal } from "../policy/blog-view";
import type { BlogViewRepository } from "../repository/blog-view";

export type BlogViewWorkScheduler = (work: () => Promise<void>) => void;
export function createBlogViewCounter(
  dependencies: Readonly<{
    repository: BlogViewRepository;
    schedule: BlogViewWorkScheduler;
    secret: string;
    logger?: Pick<ApplicationLogger, "error">;
    now?: () => Date;
  }>,
) {
  return {
    queue(signal: BlogViewSignal): "scheduled" | "ignored" {
      const decision = evaluateBlogViewSignal(signal, {
        secret: dependencies.secret,
        ...(dependencies.now ? { at: dependencies.now() } : {}),
      });
      if (!decision.countable) return "ignored";
      dependencies.schedule(async () => {
        try {
          await dependencies.repository.count(decision.candidate);
        } catch (error) {
          dependencies.logger?.error({
            action: "blog-view.count.failed",
            error,
            message: "Blog view count update failed.",
            context: { blogId: decision.candidate.blogId },
          });
        }
      });
      return "scheduled";
    },
  };
}
