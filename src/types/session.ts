/** Sanitized public shape; never includes a bearer, raw user-agent, or IP address. */
export type BrowserKind = "chrome" | "edge" | "firefox" | "safari" | "other";
export type PlatformKind = "android" | "ios" | "linux" | "macos" | "windows" | "other";

export type ActiveSessionSummary = {
  id: string;
  current: boolean;
  browser: BrowserKind;
  platform: PlatformKind;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  persistent: boolean;
};

export type ActiveSessionPage = {
  sessions: ActiveSessionSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};
