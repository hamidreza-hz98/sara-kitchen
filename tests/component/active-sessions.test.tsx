import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActiveSessions } from "@/components/account/active-sessions";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import type { ActiveSessionPage } from "@/types/session";

const now = new Date().toISOString();
const page: ActiveSessionPage = {
  page: 1,
  pageSize: 20,
  total: 2,
  hasMore: false,
  sessions: [
    {
      id: "a".repeat(24),
      current: true,
      browser: "chrome",
      platform: "windows",
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now,
      persistent: false,
    },
    {
      id: "b".repeat(24),
      current: false,
      browser: "safari",
      platform: "ios",
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now,
      persistent: true,
    },
  ],
};

function renderSessions(principal: "admin" | "customer") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ActiveSessions principal={principal} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("active-session controls", () => {
  it("shows coarse devices and revokes one other customer session", async () => {
    const user = userEvent.setup();
    const calls: { url: string; body: string | undefined }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        calls.push({ url, body: options?.body?.toString() });
        if (url.startsWith("/api/auth/csrf"))
          return new Response(JSON.stringify({ data: { csrfToken: "a".repeat(64) } }));
        if (options?.method === "POST")
          return new Response(JSON.stringify({ ok: true, data: { revoked: 1 } }), { status: 200 });
        return new Response(
          JSON.stringify({
            ok: true,
            data: calls.some((call) => call.body)
              ? { ...page, total: 1, sessions: [page.sessions[0]!] }
              : page,
          }),
          { status: 200 },
        );
      }),
    );
    renderSessions("customer");
    expect(await screen.findByText(/Chrome · Windows/u)).toBeInTheDocument();
    expect(screen.getByText(/Safari · iOS/u)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out this device" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Sign out this device" }));
    await waitFor(() =>
      expect(calls.some((call) => call.body?.includes(`"sessionId":"${"b".repeat(24)}"`))).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.queryByText(/Safari · iOS/u)).not.toBeInTheDocument());
  });

  it("confirms bulk admin revocation without signing out the current device", async () => {
    const user = userEvent.setup();
    const calls: { url: string; body: string | undefined }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        calls.push({ url, body: options?.body?.toString() });
        if (url.startsWith("/api/auth/csrf"))
          return new Response(JSON.stringify({ data: { csrfToken: "a".repeat(64) } }));
        if (options?.method === "POST")
          return new Response(JSON.stringify({ ok: true, data: { revoked: 1 } }), { status: 200 });
        return new Response(JSON.stringify({ ok: true, data: page }), { status: 200 });
      }),
    );
    renderSessions("admin");
    await screen.findByText(/Safari · iOS/u);
    await user.click(screen.getByRole("button", { name: "Sign out all other devices" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(calls.some((call) => call.body)).toBe(false);
    await user.click(screen.getByRole("button", { name: "Sign out others" }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.url.startsWith("/api/auth/admin/sessions") && call.body === '{"action":"others"}',
        ),
      ).toBe(true),
    );
  });
});
