import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactManager } from "@/app/[locale]/(dashboard)/dashboard/contact/contact-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/contact",
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const maliciousMessage = '<img src="x" onerror="alert(1)">Please call me.';
const contact = {
  id: "507f1f77bcf86cd799439012",
  fullName: "Joao Silva",
  mobile: "+351912345678",
  email: "joao@example.com",
  message: maliciousMessage,
  locale: "en",
  status: "spam",
  assigneeAdminId: null,
  internalNotes: [],
  source: {
    channel: "website",
    pagePath: "/contact",
    referrerHost: "example.test",
    campaign: null,
    requestId: "req_contact_test",
  },
  spam: { disposition: "suspected", score: 60, signals: ["duplicate"] },
  retentionExpiresAt: "2027-01-06T12:00:00.000Z",
  createdAt: "2026-10-08T12:00:00.000Z",
  updatedAt: "2026-10-08T12:00:00.000Z",
} as const;

function listResponse() {
  return new Response(
    JSON.stringify({
      data: [contact],
      meta: { pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
    }),
    { status: 200 },
  );
}

function renderManager(capabilities = { update: true, delete: true }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <ContactManager capabilities={capabilities} />
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
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/assignees"))
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (path.endsWith(contact.id))
        return new Response(JSON.stringify({ data: contact }), { status: 200 });
      return listResponse();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("contact-submission manager", () => {
  it("persists inbox filters in the URL", async () => {
    const user = userEvent.setup();
    renderManager({ update: false, delete: false });
    await screen.findAllByText("Joao Silva");
    await user.click(screen.getByRole("button", { name: "Resolved" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/contact?status=resolved&page=1", {
      scroll: false,
    });
  });

  it("renders untrusted message markup only as inert text", async () => {
    navigation.query = `submission=${contact.id}`;
    renderManager({ update: false, delete: false });

    await screen.findAllByText(maliciousMessage);
    const drawer = screen.getByRole("dialog", { name: "Message details" });
    expect(within(drawer).getByText(maliciousMessage)).toBeInTheDocument();
    expect(within(drawer).queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("requires confirmation before safe deletion", async () => {
    navigation.query = `submission=${contact.id}`;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 });
      }
      if (String(input).includes("/assignees"))
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      if (String(input).endsWith(contact.id))
        return new Response(JSON.stringify({ data: contact }), { status: 200 });
      return listResponse();
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager({ update: false, delete: true });

    const drawer = screen.getByRole("dialog", { name: "Message details" });
    await within(drawer).findByText(maliciousMessage);
    await user.click(within(drawer).getByRole("button", { name: "Delete permanently" }));
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "Permanently delete this submission?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );
  });
});
