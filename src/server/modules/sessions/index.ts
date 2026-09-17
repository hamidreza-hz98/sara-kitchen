/** Public entry point for admin and customer session management. */
export const MODULE_NAME = "sessions" as const;
export { issueSession, type IssueSessionInput, type IssuedSession } from "./service/issue-session";
export { hashSessionToken } from "./service/session-token";
export {
  resolveSession,
  revokeSession,
  revokeActorSessions,
  advanceOtherActorSessionPasswordVersions,
  SESSION_IDLE_TIMEOUT_MS,
  PERSISTENT_SESSION_IDLE_TIMEOUT_MS,
  type ResolvedSession,
} from "./service/session-lifecycle";
