import "server-only";

import { Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

export type BlogViewReceiptRecord = BaseDocumentFields & {
  blogId: Types.ObjectId;
  visitorHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
};

export const blogViewReceiptSchema = createBaseSchema<BlogViewReceiptRecord>(
  {
    blogId: { type: Schema.Types.ObjectId, ref: "Blog", required: true, immutable: true },
    visitorHash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
      match: /^[a-f\d]{64}$/u,
    },
    windowStartedAt: { type: Date, required: true, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
  },
  { collection: "blog_view_receipts", schemaVersion: 1 },
);

blogViewReceiptSchema.index(
  { blogId: 1, visitorHash: 1, windowStartedAt: 1 },
  { unique: true, name: "blog_view_receipt_unique_window" },
);
blogViewReceiptSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "blog_view_receipt_expiry_ttl" },
);

export function getBlogViewReceiptModel(connection: Connection): Model<BlogViewReceiptRecord> {
  return (
    (connection.models.BlogViewReceipt as Model<BlogViewReceiptRecord> | undefined) ??
    connection.model<BlogViewReceiptRecord>("BlogViewReceipt", blogViewReceiptSchema)
  );
}
