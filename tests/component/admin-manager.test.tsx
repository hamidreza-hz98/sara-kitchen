import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminManager } from "@/app/[locale]/(dashboard)/dashboard/admins/admin-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/dashboard/admins",
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const currentId = "a".repeat(24);
const current = {
  id: currentId,
  firstName: "Hamidreza",
  lastName: "Hassanzadeh",
  identifier: "hamid@example.com",
  role: "owner",
  active: true,
  lastLoginAt: "2026-10-08T10:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-08T10:00:00.000Z",
} as const;
const other = {
  ...current,
  id: "b".repeat(24),
  firstName: "Sara",
  lastName: "Kazemi",
  identifier: "sara@example.com",
  role: "manager",
} as const;
const capabilities = { create: true, update: true, assignRole: true, disable: true, delete: true };

function response(data: readonly unknown[] = [current, other]) {
  return new Response(
    JSON.stringify({
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: data.length,
          totalPages: data.length ? 1 : 0,
        },
      },
    }),
    { status: 200 },
  );
}

function renderManager(caps = capabilities) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <AdminManager currentAdminId={currentId} capabilities={caps} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("administrator manager", () => {
  it("shows permission-aware controls and protects the current account", async () => {
    renderManager();
    expect((await screen.findAllByText("Sara Kazemi")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add administrator" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Disable Sara" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Disable Hamidreza" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "My active sessions" }).length).toBeGreaterThan(0);
  });

  it("hides mutation controls when permissions are absent", async () => {
    renderManager({
      create: false,
      update: false,
      assignRole: false,
      disable: false,
      delete: false,
    });
    await screen.findAllByText("Sara Kazemi");
    expect(screen.queryByRole("button", { name: "Add administrator" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Sara Kazemi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disable Sara" })).not.toBeInTheDocument();
  });

  it("requires confirmation before disabling and revoking sessions", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/admins?")
        ? response()
        : new Response(JSON.stringify({ data: {} }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Sara Kazemi");
    await user.click(screen.getAllByRole("button", { name: "Disable Sara" })[0]!);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/disable"))).toBe(false);
    await user.click(
      within(screen.getByRole("dialog", { name: "Disable administrator?" })).getByRole("button", {
        name: "Disable administrator",
      }),
    );
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/disable"))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Revoke all sessions for Sara" })[0]!);
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/sessions"))).toBe(false);
    await user.click(
      within(screen.getByRole("dialog", { name: "Revoke all sessions?" })).getByRole("button", {
        name: "Revoke sessions",
      }),
    );
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([url]) => String(url).endsWith("/sessions"))).toBe(true),
    );
  }, 15_000);

  it("creates an administrator and stores search state in the URL", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ data: other }), { status: 201 })
        : response(),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Sara Kazemi");
    await user.click(screen.getByRole("button", { name: "Add administrator" }));
    const dialog = screen.getByRole("dialog", { name: "New administrator" });
    await user.type(within(dialog).getByRole("textbox", { name: "First name" }), "Leila");
    await user.type(within(dialog).getByRole("textbox", { name: "Last name" }), "Ahmadi");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Username or email" }),
      "leila@example.com",
    );
    const password = dialog.querySelector<HTMLInputElement>('input[type="password"]');
    expect(password).not.toBeNull();
    await user.type(password!, "Secure password 2026");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/admins",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const search = screen.getByRole("textbox", { name: "Search name or identifier" });
    await user.type(search, "sara");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard/admins?search=sara&page=1", {
        scroll: false,
      }),
    );
  }, 15_000);

  it("supports creating an administrator without a pointer and restores focus after Escape", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ data: other }), { status: 201 })
        : response(),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Sara Kazemi");

    const add = screen.getByRole("button", { name: "Add administrator" });
    for (let index = 0; index < 30 && document.activeElement !== add; index += 1) {
      await user.tab();
    }
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "New administrator" });
    expect(within(dialog).getByRole("textbox", { name: "First name" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(add).toHaveFocus());

    await user.keyboard("{Enter}");
    const reopened = screen.getByRole("dialog", { name: "New administrator" });
    await user.keyboard("Leila{Tab}Ahmadi{Tab}leila@example.com");
    const password = reopened.querySelector<HTMLInputElement>('input[type="password"]');
    expect(password).not.toBeNull();
    await user.tab();
    await user.tab();
    expect(password).toHaveFocus();
    await user.keyboard("Secure password 2026");
    const save = within(reopened).getByRole("button", { name: "Save" });
    await user.tab();
    expect(within(reopened).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(save).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/admins",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  }, 20_000);
});
