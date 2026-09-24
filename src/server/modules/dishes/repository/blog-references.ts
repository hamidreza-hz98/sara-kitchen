import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import { getDishModel } from "../model/dish";

/** Blog-owned archive orchestration calls this public port; Blogs never access the Dish model. */
export async function removeBlogRelationshipsFromDishes(
  connection: Connection,
  blogId: string,
  actorId: string,
): Promise<readonly string[]> {
  if (!Types.ObjectId.isValid(blogId)) return [];
  const BlogId = new Types.ObjectId(blogId);
  const Dish = getDishModel(connection);
  const affected = await Dish.find({ deletedAt: null, relatedBlogIds: BlogId }).select({ _id: 1 });
  if (affected.length > 0) {
    await Dish.updateMany(
      { _id: { $in: affected.map((dish) => dish._id) } },
      {
        $pull: { relatedBlogIds: BlogId },
        $set: { updatedBy: createActorMetadata("admin", actorId) },
      },
      { timestamps: true },
    );
  }
  return affected.map((dish) => dish._id.toHexString());
}
