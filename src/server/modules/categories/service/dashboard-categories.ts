import "server-only";

import type { Connection } from "mongoose";

import { getCategoryModel } from "../model/category";

export function countPublishedDashboardCategories(connection: Connection): Promise<number> {
  return getCategoryModel(connection)
    .countDocuments({ status: "published", deletedAt: null })
    .hint("category_active_status_sort")
    .exec();
}
