import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlogList } from "@/app/[locale]/(dashboard)/dashboard/blog/blog-list";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/blog",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const blogs = [
  {
    id: "a".repeat(24),
    translations: [
      { locale: "en", title: "Persian hospitality", excerpt: "A welcoming table." },
      { locale: "fa", title: "مهمان‌نوازی ایرانی" },
    ],
    slug: "persian-hospitality",
    imageMediaId: null,
    readTimeMinutes: 6,
    authorSnapshot: { displayName: "Chef Sara Kazemi" },
    status: "draft",
    publishAt: null,
    publishedAt: null,
    viewCount: 0,
    createdAt: "2026-09-20T10:00:00.000Z",
  },
  {
    id: "b".repeat(24),
    translations: [{ locale: "en", title: "Autumn menu" }],
    slug: "autumn-menu",
    imageMediaId: null,
    readTimeMinutes: 4,
    authorSnapshot: { displayName: "Hamidreza Hassanzadeh" },
    status: "scheduled",
    publishAt: "2026-10-01T11:00:00.000Z",
    publishedAt: null,
    viewCount: 5,
    createdAt: "2026-09-21T10:00:00.000Z",
  },
  {
    id: "c".repeat(24),
    translations: [{ locale: "en", title: "Saffron guide" }],
    slug: "saffron-guide",
    imageMediaId: null,
    readTimeMinutes: 8,
    authorSnapshot: { displayName: "Chef Sara Kazemi" },
    status: "published",
    publishAt: null,
    publishedAt: "2026-09-22T11:00:00.000Z",
    viewCount: 128,
    createdAt: "2026-09-22T10:00:00.000Z",
  },
  {
    id: "d".repeat(24),
    translations: [{ locale: "en", title: "Old menu notes" }],
    slug: "old-menu-notes",
    imageMediaId: null,
    readTimeMinutes: 3,
    authorSnapshot: { displayName: "Chef Sara Kazemi" },
    status: "archived",
    publishAt: null,
    publishedAt: "2026-08-01T11:00:00.000Z",
    viewCount: 32,
    createdAt: "2026-08-01T10:00:00.000Z",
  },
] as const;

function envelope(data: readonly unknown[]) {
  return new Response(
    JSON.stringify({
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: data.length,
          totalPages: data.length ? 1 : 0,
        },
      },
    }),
    { status: 200 },
  );
}

function renderList(
  capabilities = {
    canArchive: true,
    canCreate: true,
    canPublish: true,
    canUpdate: true,
  },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <BlogList {...capabilities} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.push.mockReset();
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST" ? new Response(JSON.stringify({ data: {} })) : envelope(blogs),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("blog list", () => {
  it("renders article data and visually named lifecycle states", async () => {
    renderList();

    expect(screen.getByLabelText("Loading articles")).toBeVisible();
    expect((await screen.findAllByText("Persian hospitality")).length).toBeGreaterThan(0);
    for (const status of ["Draft", "Scheduled", "Published", "Archived"]) {
      expect(screen.getAllByText(status).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Chef Sara Kazemi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6 minutes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("128 views").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add article" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Publish Persian hospitality" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Unpublish Saffron guide" }).length).toBe(2);
  });

  it("uses URL state for status, sorting, and search", async () => {
    navigation.query = "status=scheduled&sort=publishAt%3Aasc";
    const fetchMock = vi.mocked(fetch);
    const user = userEvent.setup();
    renderList();

    await screen.findAllByText("Autumn menu");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("status=scheduled"),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("sortBy=publishAt"),
      expect.any(Object),
    );

    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "saffron");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/dashboard/blog?status=scheduled&sort=publishAt%3Aasc&search=saffron&page=1",
        { scroll: false },
      ),
    );
  });

  it("hides every mutation control when permissions are absent", async () => {
    renderList({ canArchive: false, canCreate: false, canPublish: false, canUpdate: false });
    await screen.findAllByText("Persian hospitality");

    expect(screen.queryByRole("button", { name: "Add article" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Persian hospitality" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish Persian hospitality" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive Persian hospitality" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "View Persian hospitality" }).length).toBe(2);
  });

  it("confirms and runs lifecycle actions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    renderList();
    await screen.findAllByText("Persian hospitality");

    await user.click(screen.getAllByRole("button", { name: "Publish Persian hospitality" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Publish article?" });
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/blogs/manage/${"a".repeat(24)}/publish`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(await screen.findByText("The article was published.")).toBeVisible();
  });

  it("renders empty and recoverable error states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope([])),
    );
    const view = renderList();
    expect(await screen.findByText("No articles found")).toBeVisible();
    view.unmount();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    renderList();
    expect(await screen.findByText("Articles could not be loaded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
