import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyActions } from "@/app/[locale]/(storefront)/profile/sessions/privacy-actions";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  broadcast: vi.fn(),
  csrf: vi.fn(),
}));
vi.mock("@/locales/navigation", () => ({
  useRouter: () => ({ replace: state.replace, refresh: state.refresh }),
}));
vi.mock("@/lib/customer-auth-sync", () => ({ broadcastCustomerAuthChange: state.broadcast }));
vi.mock("@/lib/csrf-client", () => ({ csrfJsonHeaders: state.csrf }));

function renderActions() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <PrivacyActions />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.csrf.mockResolvedValue({ "content-type": "application/json", "x-csrf-token": "test" });
});
afterEach(() => vi.unstubAllGlobals());

describe("customer privacy entry points", () => {
  it("sends export password only in a protected POST and reports rejection", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderActions();
    await user.type(screen.getByLabelText(/Current password/u), "wrong");
    await user.click(screen.getByRole("button", { name: "Download data" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledWith(
      "/api/profile/export",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentPassword: "wrong" }),
      }),
    );
    expect(await screen.findByText("The current password is incorrect.")).toBeInTheDocument();
  });

  it("requires confirmation and signs out after successful account anonymization", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderActions();
    await user.click(screen.getByRole("button", { name: "Delete account…" }));
    const dialog = screen.getByRole("dialog", { name: "Permanently delete your account?" });
    expect(dialog).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Permanently delete account" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Current password"), "correct-password");
    await user.click(confirm);
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ currentPassword: "correct-password" }),
        }),
      ),
    );
    await waitFor(() => expect(state.broadcast).toHaveBeenCalled());
    expect(state.replace).toHaveBeenCalledWith("/");
  });
});
