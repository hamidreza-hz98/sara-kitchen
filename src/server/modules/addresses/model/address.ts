import "server-only";

import { isValidObjectId, Schema } from "mongoose";
import type { Connection, Model, Types } from "mongoose";

import {
  createBaseSchema,
  type BaseDocumentFields,
  type SoftDeleteFields,
} from "@/server/database/schema";
import {
  isValidCustomerMobile,
  isValidCustomerName,
  normalizeCustomerMobile,
  normalizeCustomerName,
} from "@/server/modules/customers";

import { isPortuguesePostalCode, normalizePortuguesePostalCode } from "../validation/address";

export const ADDRESS_VALIDATION_STATUSES = ["unverified", "verified", "failed"] as const;
export const ADDRESS_VALIDATION_PROVIDERS = ["manual", "nominatim", "google_maps"] as const;
export type AddressValidationStatus = (typeof ADDRESS_VALIDATION_STATUSES)[number];
export type AddressValidationProvider = (typeof ADDRESS_VALIDATION_PROVIDERS)[number];

export type AddressPoint = {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
};

export type AddressValidationMetadata = {
  status: AddressValidationStatus;
  provider: AddressValidationProvider | null;
  providerReference: string | null;
  checkedAt: Date | null;
};

export type AddressRecord = BaseDocumentFields &
  SoftDeleteFields & {
    customerId: Types.ObjectId;
    name: string;
    recipientName: string;
    recipientMobile: string;
    formattedAddress: string;
    location: AddressPoint;
    postalCode: string;
    deliveryNotes: string | null;
    isDefault: boolean;
    validation: AddressValidationMetadata;
  };

const locationSchema = new Schema<AddressPoint>(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value: number[]) {
          return (
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1]) &&
            value[0]! >= -180 &&
            value[0]! <= 180 &&
            value[1]! >= -90 &&
            value[1]! <= 90
          );
        },
        message: "Address coordinates must be [longitude, latitude] within GeoJSON bounds.",
      },
    },
  },
  { _id: false, id: false },
);

const validationMetadataSchema = new Schema<AddressValidationMetadata>(
  {
    status: {
      type: String,
      enum: ADDRESS_VALIDATION_STATUSES,
      required: true,
      default: "unverified",
    },
    provider: { type: String, enum: ADDRESS_VALIDATION_PROVIDERS, default: null },
    providerReference: { type: String, trim: true, maxlength: 200, default: null },
    checkedAt: { type: Date, default: null },
  },
  { _id: false, id: false },
);

export const addressSchema = createBaseSchema<AddressRecord>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      immutable: true,
      validate: { validator: isValidObjectId, message: "Address owner must be a valid Customer." },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
      set: normalizeCustomerName,
      validate: { validator: isValidCustomerName, message: "Enter a valid address name." },
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
      set: normalizeCustomerName,
      validate: { validator: isValidCustomerName, message: "Enter a valid recipient name." },
    },
    recipientMobile: {
      type: String,
      required: true,
      set: normalizeCustomerMobile,
      validate: {
        validator: isValidCustomerMobile,
        message: "Recipient mobile must be a normalized international number.",
      },
    },
    formattedAddress: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    location: { type: locationSchema, required: true },
    postalCode: {
      type: String,
      required: true,
      set: normalizePortuguesePostalCode,
      validate: {
        validator: isPortuguesePostalCode,
        message: "Postal code must use the Portuguese NNNN-NNN format.",
      },
    },
    deliveryNotes: { type: String, trim: true, maxlength: 500, default: null },
    isDefault: { type: Boolean, required: true, default: false },
    validation: { type: validationMetadataSchema, required: true, default: () => ({}) },
  },
  {
    collection: "addresses",
    schemaVersion: 1,
    softDelete: true,
    searchSourcePaths: [
      "name",
      "recipientName",
      "recipientMobile",
      "formattedAddress",
      "postalCode",
    ],
  },
);

addressSchema.pre("validate", function validateProviderMetadata() {
  const metadata = this.validation;
  if (!metadata) return;
  const checked = metadata.checkedAt instanceof Date;
  const hasProvider = metadata.provider !== null && metadata.provider !== undefined;
  if (metadata.status === "unverified" && (checked || hasProvider || metadata.providerReference)) {
    this.invalidate("validation", "Unverified addresses cannot contain provider validation data.");
  }
  if (metadata.status !== "unverified" && (!checked || !hasProvider)) {
    this.invalidate("validation", "Checked addresses require a provider and checkedAt timestamp.");
  }
  if (metadata.providerReference && metadata.provider === "manual") {
    this.invalidate("validation.providerReference", "Manual validation has no provider reference.");
  }
});

addressSchema.index(
  { customerId: 1, deletedAt: 1, createdAt: -1, _id: -1 },
  { name: "address_owner_active_created" },
);
addressSchema.index({ location: "2dsphere" }, { name: "address_location_2dsphere" });
addressSchema.index(
  { customerId: 1, isDefault: 1 },
  {
    unique: true,
    name: "address_one_active_default_per_customer",
    partialFilterExpression: { isDefault: true, deletedAt: null },
  },
);

export function getAddressModel(connection: Connection): Model<AddressRecord> {
  return (
    (connection.models.Address as Model<AddressRecord> | undefined) ??
    connection.model<AddressRecord>("Address", addressSchema)
  );
}
