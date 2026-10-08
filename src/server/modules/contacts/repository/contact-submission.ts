import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata, escapeSearchPattern } from "@/server/database";

import {
  contactRetentionExpiresAt,
  getContactSubmissionModel,
  type ContactSubmissionRecord,
  type ContactSubmissionStatus,
  type ContactSpamMetadata,
} from "../model/contact-submission";

export type ContactSubmissionSnapshot = Readonly<{
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  message: string;
  locale: ContactSubmissionRecord["locale"];
  status: ContactSubmissionStatus;
  assigneeAdminId: string | null;
  internalNotes: readonly Readonly<{
    id: string;
    authorAdminId: string;
    body: string;
    createdAt: string;
  }>[];
  source: Readonly<ContactSubmissionRecord["source"]>;
  consent: Readonly<{
    privacyAccepted: boolean;
    privacyPolicyVersion: string;
    acceptedAt: string;
    marketingAccepted: boolean;
  }>;
  spam: Readonly<Omit<ContactSpamMetadata, "checkedAt"> & { checkedAt: string | null }>;
  retentionExpiresAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ContactSubmissionCreate = Readonly<{
  fullName: string;
  mobile: string | null;
  email: string | null;
  message: string;
  locale: ContactSubmissionRecord["locale"];
  source: ContactSubmissionRecord["source"];
  consent: ContactSubmissionRecord["consent"];
  spam: ContactSpamMetadata;
}>;

export type ContactListOptions = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: ContactSubmissionStatus;
  assigneeAdminId?: string;
  sortDirection: "asc" | "desc";
}>;

export type ContactWorkflowUpdate = Readonly<{
  status?: Exclude<ContactSubmissionStatus, "archived">;
  assigneeAdminId?: string | null;
  note?: string;
}>;

export class ContactRepositoryConflictError extends Error {
  constructor() {
    super("contact_conflict");
    this.name = "ContactRepositoryConflictError";
  }
}

export interface ContactSubmissionRepository {
  create(value: ContactSubmissionCreate): Promise<ContactSubmissionSnapshot>;
  countRecentByFingerprint(fingerprintHash: string, since: Date): Promise<number>;
  list(
    options: ContactListOptions,
  ): Promise<Readonly<{ items: readonly ContactSubmissionSnapshot[]; total: number }>>;
  findById(id: string, includeExpired?: boolean): Promise<ContactSubmissionSnapshot | null>;
  updateWorkflow(
    current: ContactSubmissionSnapshot,
    update: ContactWorkflowUpdate,
    actorId: string,
    now: Date,
  ): Promise<ContactSubmissionSnapshot>;
  archive(
    current: ContactSubmissionSnapshot,
    actorId: string,
    now: Date,
  ): Promise<ContactSubmissionSnapshot>;
  delete(current: ContactSubmissionSnapshot): Promise<boolean>;
}

function snapshot(
  document: InstanceType<ReturnType<typeof getContactSubmissionModel>>,
): ContactSubmissionSnapshot {
  return {
    id: document._id.toHexString(),
    fullName: document.fullName,
    mobile: document.mobile,
    email: document.email,
    message: document.message,
    locale: document.locale,
    status: document.status,
    assigneeAdminId: document.assigneeAdminId?.toHexString() ?? null,
    internalNotes: document.internalNotes.map((note) => ({
      id: note._id.toHexString(),
      authorAdminId: note.authorAdminId.toHexString(),
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
    source: {
      channel: document.source.channel,
      pagePath: document.source.pagePath,
      referrerHost: document.source.referrerHost,
      campaign: document.source.campaign,
      requestId: document.source.requestId,
      fingerprintHash: document.source.fingerprintHash,
    },
    consent: {
      privacyAccepted: document.consent.privacyAccepted,
      privacyPolicyVersion: document.consent.privacyPolicyVersion,
      acceptedAt: document.consent.acceptedAt.toISOString(),
      marketingAccepted: document.consent.marketingAccepted,
    },
    spam: {
      disposition: document.spam.disposition,
      score: document.spam.score,
      signals: [...document.spam.signals],
      provider: document.spam.provider,
      checkedAt: document.spam.checkedAt?.toISOString() ?? null,
      honeypotMatched: document.spam.honeypotMatched,
    },
    retentionExpiresAt: document.retentionExpiresAt.toISOString(),
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function persistenceConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

export function createContactSubmissionRepository(
  connection: Connection,
): ContactSubmissionRepository {
  const Contact = getContactSubmissionModel(connection);
  const load = async (current: ContactSubmissionSnapshot) => {
    const document = await Contact.findById(current.id);
    if (!document || Number(document.get("__v") ?? 0) !== current.version)
      throw new ContactRepositoryConflictError();
    return document;
  };
  const persist = async (document: InstanceType<typeof Contact>) => {
    try {
      await document.save();
      return snapshot(document);
    } catch (error) {
      if (persistenceConflict(error)) throw new ContactRepositoryConflictError();
      throw error;
    }
  };

  return {
    async create(value) {
      return persist(
        new Contact({ ...value, retentionExpiresAt: contactRetentionExpiresAt("new") }),
      );
    },
    countRecentByFingerprint(fingerprintHash, since) {
      return Contact.countDocuments({
        "source.fingerprintHash": fingerprintHash,
        createdAt: { $gte: since },
      });
    },
    async list(options) {
      const filter: Record<string, unknown> = { retentionExpiresAt: { $gt: new Date() } };
      if (options.status) filter.status = options.status;
      if (options.assigneeAdminId)
        filter.assigneeAdminId = new Types.ObjectId(options.assigneeAdminId);
      if (options.search) {
        const expression = new RegExp(escapeSearchPattern(options.search), "iu");
        filter.$or = [
          { fullName: expression },
          { mobile: expression },
          { email: expression },
          { message: expression },
        ];
      }
      const direction = options.sortDirection === "asc" ? 1 : -1;
      const [documents, total] = await Promise.all([
        Contact.find(filter)
          .sort({ createdAt: direction, _id: direction })
          .skip((options.page - 1) * options.pageSize)
          .limit(options.pageSize),
        Contact.countDocuments(filter),
      ]);
      return { items: documents.map(snapshot), total };
    },
    async findById(id, includeExpired = false) {
      if (!Types.ObjectId.isValid(id)) return null;
      const document = await Contact.findOne({
        _id: new Types.ObjectId(id),
        ...(!includeExpired ? { retentionExpiresAt: { $gt: new Date() } } : {}),
      });
      return document ? snapshot(document) : null;
    },
    async updateWorkflow(current, update, actorId, now) {
      const document = await load(current);
      if (update.status !== undefined && update.status !== document.status) {
        document.status = update.status;
        document.retentionExpiresAt = contactRetentionExpiresAt(update.status, now);
      }
      if (update.assigneeAdminId !== undefined)
        document.assigneeAdminId = update.assigneeAdminId
          ? new Types.ObjectId(update.assigneeAdminId)
          : null;
      if (update.note)
        document.internalNotes.push({
          _id: new Types.ObjectId(),
          authorAdminId: new Types.ObjectId(actorId),
          body: update.note,
          createdAt: now,
        });
      document.updatedBy = createActorMetadata("admin", actorId);
      return persist(document);
    },
    async archive(current, actorId, now) {
      const document = await load(current);
      document.status = "archived";
      document.retentionExpiresAt = contactRetentionExpiresAt("archived", now);
      document.updatedBy = createActorMetadata("admin", actorId);
      return persist(document);
    },
    async delete(current) {
      const result = await Contact.deleteOne({ _id: current.id, __v: current.version });
      if (result.deletedCount !== 1) throw new ContactRepositoryConflictError();
      return true;
    },
  };
}
