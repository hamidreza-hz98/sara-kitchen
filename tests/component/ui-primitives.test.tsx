import MailRounded from "@mui/icons-material/MailRounded";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ActionButton,
  AppDialog,
  AppDrawer,
  AppImage,
  AppLink,
  AppPagination,
  AppTooltip,
  ContentSkeleton,
  EmptyState,
  ErrorState,
  FormField,
  NotificationBadge,
  RichContent,
  SelectField,
  StatusChip,
  type RichTextDocument,
} from "@/components/ui";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

function renderUi(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

function OverlayHarness() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <ActionButton onClick={() => setDialogOpen(true)}>Open dialog</ActionButton>
      <ActionButton onClick={() => setDrawerOpen(true)}>Open drawer</ActionButton>
      <AppDialog
        actions={<ActionButton onClick={() => setDialogOpen(false)}>Done</ActionButton>}
        closeLabel="Close dialog"
        description="Review the order before continuing."
        open={dialogOpen}
        title="Order review"
        onClose={() => setDialogOpen(false)}
      >
        Dialog body
      </AppDialog>
      <AppDrawer
        closeLabel="Close drawer"
        description="Order details"
        open={drawerOpen}
        title="Order summary"
        onClose={() => setDrawerOpen(false)}
      >
        Drawer body
      </AppDrawer>
    </>
  );
}

describe("shared UI controls", () => {
  it("keeps actions safe in forms and exposes labelled field controls", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();

    renderUi(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ActionButton>Safe action</ActionButton>
        <FormField label="Dish name" name="dishName" />
        <SelectField
          defaultValue="main"
          label="Category"
          name="category"
          options={[{ label: "Main course", value: "main" }]}
        />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Safe action" }));

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Dish name" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeVisible();
  });

  it("provides keyboard-operable dialog and drawer dismissal", async () => {
    const user = userEvent.setup();
    renderUi(<OverlayHarness />);

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    const dialog = screen.getByRole("dialog", { name: "Order review" });
    expect(dialog).toHaveAccessibleDescription("Review the order before continuing.");
    await user.keyboard("{Escape}");
    await waitForElementToBeRemoved(dialog);

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(screen.getByRole("dialog", { name: "Order summary" })).toHaveAccessibleDescription(
      "Order details",
    );
    const drawerHeading = screen.getByRole("heading", { name: "Order summary" });
    await user.keyboard("{Escape}");
    await waitForElementToBeRemoved(drawerHeading);
  });

  it("exposes tooltip, badge, chip, loading, and state semantics", async () => {
    const user = userEvent.setup();
    renderUi(
      <>
        <AppTooltip title="Open messages">
          <ActionButton>
            <NotificationBadge badgeContent={2} badgeLabel="2 unread messages">
              <MailRounded />
            </NotificationBadge>
            Messages
          </ActionButton>
        </AppTooltip>
        <StatusChip color="success" label="Ready" />
        <ContentSkeleton height={40} label="Loading dishes" />
        <EmptyState description="Add your first address." title="No addresses" />
        <ErrorState description="Try again later." title="Could not load orders" />
      </>,
    );

    const messageButton = screen.getByRole("button", { name: "Open messages" });
    await user.tab();

    expect(messageButton).toHaveFocus();
    expect(messageButton).toHaveAccessibleName("Open messages");
    expect(screen.getByLabelText("2 unread messages")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.getByRole("status", { name: "Loading dishes" })).toBeVisible();
    expect(screen.getByRole("status", { name: /No addresses/ })).toBeVisible();
    expect(screen.getByRole("alert", { name: /Could not load orders/ })).toBeVisible();
  });

  it("renders navigable links, pagination, and accessible images", () => {
    renderUi(
      <>
        <AppLink href="/menu">Browse menu</AppLink>
        <AppPagination count={4} label="Menu pages" page={1} />
        <AppImage alt="Dish photograph" height={80} src="/window.svg" width={120} />
        <AppImage alt="" decorative height={20} src="/window.svg" width={20} />
      </>,
    );

    expect(screen.getByRole("link", { name: "Browse menu" })).toHaveAttribute("href", "/menu");
    expect(screen.getByRole("navigation", { name: "Menu pages" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Dish photograph" })).toBeVisible();
    expect(screen.getByAltText("")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("RichContent", () => {
  it("renders semantic structured content without activating unsafe links", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "About Fesenjan" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Read the recipe",
              marks: [{ type: "link", attrs: { href: "/blog/fesenjan" } }],
            },
            { type: "text", text: " and blocked", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: " unsafe content",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
            {
              type: "text",
              text: " or protocol-relative content <img src=x onerror=alert(1)>",
              marks: [{ type: "link", attrs: { href: "//untrusted.example" } }],
            },
          ],
        },
      ],
    } as const satisfies RichTextDocument;

    renderUi(<RichContent content={content} />);

    expect(screen.getByRole("heading", { level: 2, name: "About Fesenjan" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Read the recipe" })).toHaveAttribute(
      "href",
      "/blog/fesenjan",
    );
    expect(screen.queryByRole("link", { name: /unsafe content/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /protocol-relative content/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/u)).toBeVisible();
    expect(screen.getByText("and blocked").tagName).toBe("STRONG");
  });

  it("renders a valid versioned storage envelope", () => {
    renderUi(
      <RichContent
        content={{
          schemaVersion: 1,
          document: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Stored safely" }] }],
          },
        }}
      />,
    );

    expect(screen.getByText("Stored safely")).toBeVisible();
  });
});
