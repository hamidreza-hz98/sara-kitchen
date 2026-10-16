import "server-only";

import type { Connection, Model } from "mongoose";

import {
  createBaseSchema,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";
import { isPasswordHash } from "@/server/security/password";

import {
  isValidCustomerEmail,
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerEmail,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "../validation/customer-identity";

export const CUSTOMER_STATUSES = ["active", "disabled", "anonymized"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export type CustomerRecord = BaseDocumentFields &
  SoftDeleteFields & {
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
    termsAcceptedAt: Date | null;
    status: CustomerStatus;
    deletionRequestedAt: Date | null;
    anonymizedAt: Date | null;
    privacyRetentionReason: "historical_orders" | "privacy_request" | null;
  };

const ANONYMIZED_MOBILE_PATTERN = /^anon_[a-f\d]{24}$/u;

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
      validate: {
        validator: (value: string) =>
          isValidCustomerMobile(value) || ANONYMIZED_MOBILE_PATTERN.test(value),
        message: "Enter a valid mobile number.",
      },
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
      validate: { validator: isPasswordHash, message: "An Argon2id hash is required." },
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
    termsAcceptedAt: { type: Date, default: null },
    status: { type: String, enum: CUSTOMER_STATUSES, required: true, default: "active" },
    deletionRequestedAt: { type: Date, default: null },
    anonymizedAt: { type: Date, default: null },
    privacyRetentionReason: {
      type: String,
      enum: ["historical_orders", "privacy_request"],
      default: null,
    },
  },
  {
    collection: "customers",
    searchSourcePaths: ["firstName", "lastName", "mobile", "email"],
    softDelete: true,
  },
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
customerSchema.index({ createdAt: -1, _id: -1 }, { name: "customer_registration_timeline" });

customerSchema.pre("validate", function validateCustomerState() {
  if (!this.email && this.emailVerifiedAt) {
    this.invalidate("emailVerifiedAt", "An email is required before email verification.");
  }
  if (this.marketingConsent !== Boolean(this.marketingConsentAt)) {
    this.invalidate("marketingConsentAt", "Consent and its timestamp must agree.");
  }
  const anonymized = this.status === "anonymized";
  if (
    anonymized !==
    Boolean(this.anonymizedAt && this.deletionRequestedAt && this.privacyRetentionReason)
  ) {
    this.invalidate("anonymizedAt", "Anonymized accounts require complete privacy metadata.");
  }
  if (
    anonymized &&
    (this.email !== null ||
      !ANONYMIZED_MOBILE_PATTERN.test(this.mobile) ||
      this.marketingConsent ||
      this.emailVerifiedAt ||
      this.mobileVerifiedAt)
  ) {
    this.invalidate("status", "Anonymized accounts cannot retain direct identifiers.");
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
