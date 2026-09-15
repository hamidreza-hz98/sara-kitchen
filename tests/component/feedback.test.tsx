import { ThemeProvider } from "@mui/material/styles";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog, RouteLoading } from "@/components/feedback";
import { ActionButton } from "@/components/ui";
import { PROJECT_TIME_ZONE } from "@/constants";
import { useFeedback } from "@/hooks";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

function renderFeedback(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>{children}</FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

function QueueHarness() {
  const { notify } = useFeedback();

  return (
    <ActionButton
      onClick={() => {
        notify({ message: "First message", severity: "success", title: "First" });
        notify({ message: "Second message", severity: "warning", title: "Second" });
      }}
    >
      Queue feedback
    </ActionButton>
  );
}

function ConfirmationHarness({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(true);

  return (
    <ConfirmationDialog
      cancelLabel="Keep draft"
      closeLabel="Close confirmation"
      confirmLabel="Delete draft"
      danger
      description="This cannot be undone."
      open={open}
      title="Delete this draft?"
      onCancel={() => setOpen(false)}
      onConfirm={onConfirm}
    />
  );
}

describe("feedback infrastructure", () => {
  it("queues localized notifications instead of replacing active feedback", async () => {
    const user = userEvent.setup();
    renderFeedback(<QueueHarness />);

    await user.click(screen.getByRole("button", { name: "Queue feedback" }));
    expect(screen.getByRole("alert")).toHaveTextContent("First message");

    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Second message"));
  });

  it("uses the non-destructive action as the confirmation default", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderFeedback(<ConfirmationHarness onConfirm={onConfirm} />);

    expect(screen.getByRole("button", { name: "Keep draft" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps an offline warning visible and reports reconnection", async () => {
    let online = true;
    const onlineSpy = vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
    renderFeedback(<span>Application</span>);

    online = false;
    await act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("You're offline");

    online = true;
    await act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Back online"));
    onlineSpy.mockRestore();
  });

  it("announces route loading state", () => {
    renderFeedback(<RouteLoading />);
    expect(screen.getAllByRole("status", { name: "Loading page" })).toHaveLength(5);
  });
});
