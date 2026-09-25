import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsSectionEditor } from "@/app/[locale]/(dashboard)/dashboard/settings/[section]/settings-section-editor";
import { SETTINGS_PAGE_REGISTRY } from "@/app/[locale]/(dashboard)/dashboard/settings/settings-section-registry";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));
vi.mock("@/components/media", () => ({
  MediaPicker: ({ label }: { label: string }) => <div>{label}</div>,
}));

function renderEditor(section: keyof typeof SETTINGS_PAGE_REGISTRY, canEdit = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <SettingsSectionEditor canEdit={canEdit} definition={SETTINGS_PAGE_REGISTRY[section]} />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("settings section editor", () => {
  it("renders translated tabs, preview, and media control for a supported section", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: null }), { status: 200 })),
    );
    renderEditor("homepage");
    expect(await screen.findByRole("heading", { name: "Homepage", level: 1 })).toBeVisible();
    expect(screen.getByRole("tab", { name: "English" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Portuguese" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Persian" })).toBeVisible();
    expect(screen.getByText("Primary media")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Locale preview" })).toBeVisible();
  });

  it("saves a direct section and exposes the public revalidation result", async () => {
    let savedPayload: unknown;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        savedPayload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            data: { draft: null, published: { payload: savedPayload, revision: 1 } },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ data: null }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderEditor("contact");
    const email = await screen.findByRole("textbox", { name: "Public email" });
    await user.clear(email);
    await user.type(email, "orders@sarakitchen.pt");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/caches were refreshed/u)).toBeVisible();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/settings/contact",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("guards dirty navigation and keeps staged publication disabled until save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: null }), { status: 200 })),
    );
    const user = userEvent.setup();
    renderEditor("faq");
    await screen.findByRole("heading", { name: "FAQ" });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add question" }));
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("makes every field read-only when the actor lacks the section update permission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: null }), { status: 200 })),
    );
    renderEditor("languages", false);
    expect(await screen.findByText(/role cannot change it/u)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled(),
    );
  });
});
