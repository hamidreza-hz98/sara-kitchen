import "server-only";

import type { Connection, Model } from "mongoose";

import { createBaseSchema, type BaseDocumentFields } from "@/server/database/schema";

import { isCustomerPasswordHash } from "../service/password";
import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "../validation/customer-identity";

export const CUSTOMER_STATUSES = ["active", "disabled"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export type CustomerRecord = BaseDocumentFields & {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  passwordHash: string;
  mobileVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  passwordVersion: number;
  marketingConsent: boolean;
  marketingConsentAt: Date | null;
  status: CustomerStatus;
};

const customerSchema = createBaseSchema<CustomerRecord>(
  {
    firstName: {
      type: String,
      required: true,
      set: normalizeCustomerName,
      validate: { validator: isValidCustomerName, message: "Enter a valid first name." },
    },
    lastName: {
      type: String,
      required: true,
      set: normalizeCustomerName,
      validate: { validator: isValidCustomerName, message: "Enter a valid last name." },
    },
    mobile: {
      type: String,
      required: true,
      set: normalizeCustomerMobile,
      validate: { validator: isValidCustomerMobile, message: "Enter a valid mobile number." },
    },
    email: {
      type: String,
      default: null,
      set: normalizeCustomerEmail,
      validate: { validator: isValidCustomerEmail, message: "Enter a valid email address." },
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
      validate: { validator: isCustomerPasswordHash, message: "An Argon2id hash is required." },
    },
    mobileVerifiedAt: { type: Date, default: null },
    emailVerifiedAt: { type: Date, default: null },
    passwordVersion: {
      type: Number,
      required: true,
      default: 1,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value) && value >= 1,
        message: "Password version must be a positive integer.",
      },
    },
    marketingConsent: { type: Boolean, required: true, default: false },
    marketingConsentAt: { type: Date, default: null },
    status: { type: String, enum: CUSTOMER_STATUSES, required: true, default: "active" },
  },
  { collection: "customers", searchSourcePaths: ["firstName", "lastName", "mobile", "email"] },
);

customerSchema.index({ mobile: 1 }, { unique: true, name: "customers_mobile_unique" });
customerSchema.index(
  { email: 1 },
  {
    unique: true,
    name: "customers_email_unique_when_present",
    partialFilterExpression: { email: { $type: "string" } },
  },
);
customerSchema.index({ status: 1, createdAt: -1 });

customerSchema.pre("validate", function validateCustomerState() {
  if (!this.email && this.emailVerifiedAt) {
    this.invalidate("emailVerifiedAt", "An email is required before email verification.");
  }
  if (this.marketingConsent !== Boolean(this.marketingConsentAt)) {
    this.invalidate("marketingConsentAt", "Consent and its timestamp must agree.");
  }
});

const baseJsonOptions = customerSchema.get("toJSON") as {
  transform?: (document: unknown, value: Record<string, unknown>) => Record<string, unknown>;
};
customerSchema.set("toJSON", {
  ...baseJsonOptions,
  transform(document: unknown, value: Record<string, unknown>) {
    const serialized = baseJsonOptions.transform?.(document, value) ?? value;
    delete serialized.passwordHash;
    delete serialized.passwordVersion;
    return serialized;
  },
});

export function getCustomerModel(connection: Connection): Model<CustomerRecord> {
  return (
    (connection.models.Customer as Model<CustomerRecord> | undefined) ??
    connection.model<CustomerRecord>("Customer", customerSchema)
  );
}
