import "server-only";

import { hasAdminPermission, type AdminRole } from "@/constants/admin-access";

import type {
  ContactListOptions,
  ContactSubmissionRepository,
  ContactSubmissionSnapshot,
  ContactWorkflowUpdate,
} from "../repository/contact-submission";
import type { ContactSubmissionInput } from "../validation/contact-submission";

export type ContactActor = Readonly<{ id: string; role: AdminRole }>;
export type ContactFlowAction = "create" | "list" | "read" | "update" | "archive" | "delete";
export type ContactAuditEvent = Readonly<{
  action: ContactFlowAction;
  actor: Readonly<{ kind: "admin" | "anonymous"; id: string | null }>;
  contactId: string | null;
  outcome: "success" | "failure" | "denied";
}>;
export type ContactNotification = Readonly<{
  contactId: string;
  locale: string;
  status: string;
  adminPath: string;
}>;
export type ContactFlowDependencies = Readonly<{
  repository: ContactSubmissionRepository;
  fingerprint(input: Pick<ContactSubmissionInput, "email" | "message" | "mobile">): string;
  assigneeExists(adminId: string): Promise<boolean>;
  notify(notification: ContactNotification): Promise<void>;
  notificationFailed(error: unknown, contactId: string): void;
  audit(event: ContactAuditEvent): Promise<void>;
  now(): Date;
}>;

export type ContactAdminView = Omit<
  ContactSubmissionSnapshot,
  "consent" | "email" | "internalNotes" | "message" | "mobile" | "source"
> &
  Readonly<{
    email: string | null;
    mobile: string | null;
    message: string | null;
    internalNotes: ContactSubmissionSnapshot["internalNotes"];
    consent: ContactSubmissionSnapshot["consent"] | null;
    source: Omit<ContactSubmissionSnapshot["source"], "fingerprintHash"> | null;
  }>;

export class ContactFlowError extends Error {
  constructor(
    readonly code: "conflict" | "forbidden" | "invalid_input" | "not_found" | "retention_locked",
  ) {
    super(code);
    this.name = "ContactFlowError";
  }
}

function can(
  actor: ContactActor,
  permission: "contacts:delete" | "contacts:read" | "contacts:read-sensitive" | "contacts:update",
) {
  return hasAdminPermission({ role: actor.role, active: true }, permission);
}

function adminView(actor: ContactActor, item: ContactSubmissionSnapshot): ContactAdminView {
  const sensitive = can(actor, "contacts:read-sensitive");
  const { fingerprintHash: _fingerprintHash, ...safeSource } = item.source;
  void _fingerprintHash;
  return {
    ...item,
    mobile: sensitive ? item.mobile : null,
    email: sensitive ? item.email : null,
    message: sensitive ? item.message : null,
    internalNotes: sensitive ? item.internalNotes : [],
    consent: sensitive ? item.consent : null,
    source: sensitive ? safeSource : null,
  };
}

function requirePermission(actor: ContactActor, action: Exclude<ContactFlowAction, "create">) {
  const permission =
    action === "list" || action === "read"
      ? "contacts:read"
      : action === "delete"
        ? "contacts:delete"
        : "contacts:update";
  if (!can(actor, permission)) throw new ContactFlowError("forbidden");
}

async function auditAdmin<T>(
  deps: ContactFlowDependencies,
  actor: ContactActor,
  action: Exclude<ContactFlowAction, "create">,
  contactId: string | null,
  work: () => Promise<T>,
) {
  try {
    requirePermission(actor, action);
    const result = await work();
    await deps.audit({
      action,
      actor: { kind: "admin", id: actor.id },
      contactId,
      outcome: "success",
    });
    return result;
  } catch (error) {
    await deps.audit({
      action,
      actor: { kind: "admin", id: actor.id },
      contactId,
      outcome:
        error instanceof ContactFlowError && error.code === "forbidden" ? "denied" : "failure",
    });
    throw error;
  }
}

export function createContactFlow(deps: ContactFlowDependencies) {
  const find = async (id: string) => {
    const item = await deps.repository.findById(id);
    if (!item) throw new ContactFlowError("not_found");
    return item;
  };
  return {
    async createPublic(
      input: ContactSubmissionInput,
      source: Readonly<{
        pagePath: string | null;
        referrerHost: string | null;
        campaign: string | null;
        requestId: string;
      }>,
    ) {
      const now = deps.now();
      const fingerprintHash = deps.fingerprint(input);
      const duplicates = await deps.repository.countRecentByFingerprint(
        fingerprintHash,
        new Date(now.getTime() - 60 * 60 * 1_000),
      );
      const links = input.message.match(/https?:\/\//giu)?.length ?? 0;
      const signals = [
        ...(duplicates > 0 ? (["duplicate"] as const) : []),
        ...(links >= 4 ? (["link_density"] as const) : []),
      ];
      const score = Math.min(100, (duplicates > 0 ? 60 : 0) + (links >= 4 ? 50 : 0));
      const item = await deps.repository.create({
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        message: input.message,
        locale: input.locale,
        source: {
          channel: "website",
          pagePath: source.pagePath,
          referrerHost: source.referrerHost,
          campaign: source.campaign,
          requestId: source.requestId,
          fingerprintHash,
        },
        consent: {
          privacyAccepted: true,
          privacyPolicyVersion: input.privacyPolicyVersion,
          acceptedAt: now,
          marketingAccepted: input.marketingAccepted,
        },
        spam: {
          disposition: score >= 50 ? "suspected" : "clean",
          score,
          signals,
          provider: "local",
          checkedAt: now,
          honeypotMatched: false,
        },
      });
      await deps.audit({
        action: "create",
        actor: { kind: "anonymous", id: null },
        contactId: item.id,
        outcome: "success",
      });
      let notificationDelivered = false;
      if (item.spam.disposition === "clean") {
        try {
          await deps.notify({
            contactId: item.id,
            locale: item.locale,
            status: item.status,
            adminPath: `/dashboard/contact?submission=${item.id}`,
          });
          notificationDelivered = true;
        } catch (error) {
          deps.notificationFailed(error, item.id);
        }
      }
      return { id: item.id, accepted: true as const, notificationDelivered };
    },
    list(actor: ContactActor, options: ContactListOptions) {
      return auditAdmin(deps, actor, "list", null, async () => {
        const result = await deps.repository.list(options);
        return { ...result, items: result.items.map((item) => adminView(actor, item)) };
      });
    },
    get(actor: ContactActor, id: string) {
      return auditAdmin(deps, actor, "read", id, async () => adminView(actor, await find(id)));
    },
    update(actor: ContactActor, id: string, update: ContactWorkflowUpdate) {
      return auditAdmin(deps, actor, "update", id, async () => {
        if (update.assigneeAdminId && !(await deps.assigneeExists(update.assigneeAdminId)))
          throw new ContactFlowError("invalid_input");
        return adminView(
          actor,
          await deps.repository.updateWorkflow(await find(id), update, actor.id, deps.now()),
        );
      });
    },
    archive(actor: ContactActor, id: string) {
      return auditAdmin(deps, actor, "archive", id, async () =>
        adminView(actor, await deps.repository.archive(await find(id), actor.id, deps.now())),
      );
    },
    remove(actor: ContactActor, id: string) {
      return auditAdmin(deps, actor, "delete", id, async () => {
        const item = await deps.repository.findById(id, true);
        if (!item) throw new ContactFlowError("not_found");
        if (
          item.status !== "spam" &&
          item.status !== "archived" &&
          new Date(item.retentionExpiresAt).getTime() > deps.now().getTime()
        )
          throw new ContactFlowError("retention_locked");
        await deps.repository.delete(item);
        return { deleted: true as const };
      });
    },
  };
}
