import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaLibrary } from "@/app/[locale]/(dashboard)/dashboard/media/media-library";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({
  query: "view=grid&kind=image",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/dashboard/media",
  useRouter: () => ({ replace: navigation.replace }),
}));

const items = [
  {
    id: "a".repeat(24),
    originalName: "saffron-rice.webp",
    mimeType: "image/webp",
    kind: "image",
    bytes: 2048,
    dimensions: { width: 800, height: 600 },
    processingState: "ready",
    translations: [{ locale: "en", alt: "Saffron rice" }],
    uploaderId: "b".repeat(24),
    usageCount: 2,
    createdAt: "2026-09-18T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
    preview: { url: "https://objects.example/saffron.webp", expiresAt: null },
  },
  {
    id: "c".repeat(24),
    originalName: "kitchen.webp",
    mimeType: "image/webp",
    kind: "image",
    bytes: 4096,
    dimensions: { width: 1200, height: 800 },
    processingState: "ready",
    translations: [{ locale: "en", alt: "Sara Kitchen" }],
    uploaderId: "b".repeat(24),
    usageCount: 0,
    createdAt: "2026-09-17T10:00:00.000Z",
    updatedAt: "2026-09-17T10:00:00.000Z",
    preview: { url: "https://objects.example/kitchen.webp", expiresAt: null },
  },
] as const;

function renderLibrary() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <MediaLibrary capabilities={{ create: true, delete: true, update: true }} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "view=grid&kind=image";
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: items,
            meta: {
              pagination: {
                page: 1,
                pageSize: 12,
                totalItems: 2,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
              sort: { by: "createdAt", direction: "desc" },
            },
          }),
          { status: 200 },
        ),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("media library", () => {
  it("renders responsive grid controls, preview, selection, and safe delete states", async () => {
    const user = userEvent.setup();
    renderLibrary();

    expect(await screen.findByText("saffron-rice.webp")).toBeVisible();
    expect(screen.getByText("2 references")).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete saffron-rice.webp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete kitchen.webp" })).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Select kitchen.webp" }));
    expect(screen.getByText("1 item selected")).toBeVisible();

    const previewButtons = screen.getAllByRole("button", { name: "Preview kitchen.webp" });
    await user.click(previewButtons[0]!);
    const dialog = screen.getByRole("dialog", { name: "kitchen.webp" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByAltText("Sara Kitchen")).toBeVisible();
  });

  it("applies keyboard search while preserving grid and filter URL state", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("saffron-rice.webp");

    const search = screen.getByRole("textbox", { name: "Search assets" });
    await user.type(search, "saffron{Enter}");

    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
    const [destination] = navigation.replace.mock.calls.at(-1) as [string];
    expect(destination).toContain("view=grid");
    expect(destination).toContain("kind=image");
    expect(destination).toContain("search=saffron");
    expect(destination).toContain("page=1");
  });
});
