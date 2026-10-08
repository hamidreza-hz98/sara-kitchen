import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata, escapeSearchPattern } from "@/server/database";

import { getCustomerModel, type CustomerStatus } from "../model/customer";

export type CustomerSnapshot = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  mobileVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  passwordVersion: number;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  termsAcceptedAt: string | null;
  status: CustomerStatus;
  deletionRequestedAt: string | null;
  anonymizedAt: string | null;
  privacyRetentionReason: "historical_orders" | "privacy_request" | null;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;
export type CustomerProfileWrite = Readonly<{
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  marketingConsent: boolean;
}>;
export type CustomerListOptions = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: CustomerStatus;
  sortBy?: "createdAt" | "firstName" | "lastName" | "updatedAt";
  sortDirection?: "asc" | "desc";
}>;
export type CustomerListResult = Readonly<{
  items: readonly CustomerSnapshot[];
  total: number;
}>;
export type CustomerWriteActor = Readonly<{ kind: "admin" | "customer"; id: string }>;

export class CustomerRepositoryConflictError extends Error {
  constructor() {
    super("customer_conflict");
    this.name = "CustomerRepositoryConflictError";
  }
}

export interface CustomerRepository {
  findById(id: string, includeAnonymized?: boolean): Promise<CustomerSnapshot | null>;
  list(options: CustomerListOptions): Promise<CustomerListResult>;
  saveProfile(
    current: CustomerSnapshot,
    value: CustomerProfileWrite,
    actor: CustomerWriteActor,
  ): Promise<CustomerSnapshot>;
  setStatus(
    current: CustomerSnapshot,
    status: "active" | "disabled",
    actor: CustomerWriteActor,
  ): Promise<CustomerSnapshot>;
  anonymize(
    current: CustomerSnapshot,
    actor: CustomerWriteActor,
    retentionReason: "historical_orders" | "privacy_request",
    now: Date,
  ): Promise<CustomerSnapshot>;
}

function snapshot(document: InstanceType<ReturnType<typeof getCustomerModel>>): CustomerSnapshot {
  return {
    id: document._id.toHexString(),
    firstName: document.firstName,
    lastName: document.lastName,
    mobile: document.mobile,
    email: document.email,
    mobileVerifiedAt: document.mobileVerifiedAt?.toISOString() ?? null,
    emailVerifiedAt: document.emailVerifiedAt?.toISOString() ?? null,
    passwordVersion: document.passwordVersion,
    marketingConsent: document.marketingConsent,
    marketingConsentAt: document.marketingConsentAt?.toISOString() ?? null,
    termsAcceptedAt: document.termsAcceptedAt?.toISOString() ?? null,
    status: document.status,
    deletionRequestedAt: document.deletionRequestedAt?.toISOString() ?? null,
    anonymizedAt: document.anonymizedAt?.toISOString() ?? null,
    privacyRetentionReason: document.privacyRetentionReason,
    deletedAt: document.deletedAt?.toISOString() ?? null,
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function actorMetadata(actor: CustomerWriteActor) {
  return createActorMetadata(actor.kind, actor.id);
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

export function createCustomerRepository(connection: Connection): CustomerRepository {
  const Customer = getCustomerModel(connection);
  const load = async (current: CustomerSnapshot) => {
    const document = await Customer.findById(current.id);
    if (!document || document.get("__v") !== current.version)
      throw new CustomerRepositoryConflictError();
    return document;
  };
  const persist = async (document: InstanceType<typeof Customer>) => {
    try {
      await document.save();
    } catch (error) {
      if (isConflict(error)) throw new CustomerRepositoryConflictError();
      throw error;
    }
    return snapshot(document);
  };

  return {
    async findById(id, includeAnonymized = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Customer.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeAnonymized ? { deletedAt: null, status: { $ne: "anonymized" } } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async list(options) {
      const filter: Record<string, unknown> =
        options.status === "anonymized"
          ? { status: "anonymized", deletedAt: { $ne: null } }
          : { deletedAt: null, ...(options.status ? { status: options.status } : {}) };
      if (options.search) {
        const expression = new RegExp(escapeSearchPattern(options.search), "iu");
        filter.$or = [
          { firstName: expression },
          { lastName: expression },
          { mobile: expression },
          { email: expression },
        ];
      }
      const direction = options.sortDirection === "asc" ? 1 : -1;
      const sortBy = options.sortBy ?? "createdAt";
      const [documents, total] = await Promise.all([
        Customer.find(filter)
          .sort({ [sortBy]: direction, _id: direction })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Customer.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async saveProfile(current, value, actor) {
      const document = await load(current);
      const mobileChanged = document.mobile !== value.mobile;
      const emailChanged = document.email !== value.email;
      document.firstName = value.firstName;
      document.lastName = value.lastName;
      document.mobile = value.mobile;
      document.email = value.email;
      document.marketingConsent = value.marketingConsent;
      document.marketingConsentAt = value.marketingConsent
        ? (document.marketingConsentAt ?? new Date())
        : null;
      if (mobileChanged) document.mobileVerifiedAt = null;
      if (emailChanged) document.emailVerifiedAt = null;
      document.updatedBy = actorMetadata(actor);
      return persist(document);
    },
    async setStatus(current, status, actor) {
      const document = await load(current);
      document.status = status;
      document.updatedBy = actorMetadata(actor);
      return persist(document);
    },
    async anonymize(current, actor, retentionReason, now) {
      const document = await load(current);
      document.firstName = "Deleted";
      document.lastName = "Customer";
      document.mobile = `anon_${current.id}`;
      document.email = null;
      document.mobileVerifiedAt = null;
      document.emailVerifiedAt = null;
      document.marketingConsent = false;
      document.marketingConsentAt = null;
      document.status = "anonymized";
      document.deletionRequestedAt = now;
      document.anonymizedAt = now;
      document.privacyRetentionReason = retentionReason;
      document.passwordVersion += 1;
      document.deletedAt = now;
      document.deletedBy = actorMetadata(actor);
      document.updatedBy = actorMetadata(actor);
      return persist(document);
    },
  };
}
