import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlogEditor } from "@/app/[locale]/(dashboard)/dashboard/blog/modify/blog-editor";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  useRouter: () => ({
    push: navigation.push,
    replace: navigation.replace,
    refresh: navigation.refresh,
  }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));
vi.mock("@/components/media", () => ({
  MediaPicker: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
vi.mock("@/components/relations", () => ({
  RemoteRelationSelector: ({ title }: { title: string }) => <button type="button">{title}</button>,
}));
vi.mock("@/app/[locale]/(dashboard)/dashboard/blog/modify/blog-rich-editor", () => ({
  BlogRichEditor: ({ labelledBy }: { labelledBy: string }) => (
    <div role="textbox" aria-labelledby={labelledBy} />
  ),
}));

const blogId = "a".repeat(24);
const emptyContent = { schemaVersion: 1, document: { type: "doc", content: [] } } as const;
const allTranslations = [
  {
    locale: "en",
    title: "Persian hospitality",
    excerpt: "A welcoming table.",
    content: emptyContent,
  },
  {
    locale: "pt-PT",
    title: "Hospitalidade persa",
    excerpt: "Uma mesa acolhedora.",
    content: emptyContent,
  },
  {
    locale: "fa",
    title: "مهمان‌نوازی ایرانی",
    excerpt: "سفره‌ای گرم و صمیمی.",
    content: emptyContent,
  },
] as const;

function blog(status: "draft" | "scheduled" | "published" = "draft") {
  return {
    id: blogId,
    translations: allTranslations,
    slug: "persian-hospitality",
    imageMediaId: null,
    bannerMediaId: null,
    readTimeMinutes: 4,
    authorSnapshot: { displayName: "Chef Sara Kazemi" },
    status,
    publishAt: status === "scheduled" ? "2099-10-01T11:00:00.000Z" : null,
    publishedAt: status === "published" ? "2026-09-20T11:00:00.000Z" : null,
    tags: ["culture"],
    relatedDishIds: [],
    relatedBlogIds: [],
    viewCount: 12,
  };
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderEditor(
  capabilities = { canCreate: true, canPublish: true, canUpdate: true, canUploadMedia: true },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <BlogEditor {...capabilities} />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.refresh.mockReset();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(blog())),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("blog editor", () => {
  it("creates a draft using the shared server-compatible schema and automatic read time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(blog(), 201)),
    );
    renderEditor();

    fireEvent.change(screen.getByRole("textbox", { name: "Article title" }), {
      target: { value: "Persian hospitality" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Excerpt" }), {
      target: { value: "A welcoming table." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(`/dashboard/blog/modify?id=${blogId}`, {
        scroll: false,
      }),
    );
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(request?.[0]).toBe("/api/blogs");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      translations: [
        {
          locale: "en",
          title: "Persian hospitality",
          excerpt: "A welcoming table.",
          content: emptyContent,
        },
      ],
      readTimeMinutes: 1,
      relatedDishIds: [],
      relatedBlogIds: [],
    });
  });

  it("loads and edits an existing article", async () => {
    navigation.query = `id=${blogId}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return response(blog());
        if (String(input) === `/api/blogs/manage/${blogId}`) return response(blog());
        return response([]);
      }),
    );
    renderEditor();

    expect(screen.getByLabelText("Loading article")).toBeVisible();
    const title = await screen.findByRole("textbox", { name: "Article title" });
    expect(title).toHaveValue("Persian hospitality");
    fireEvent.change(title, { target: { value: "Persian hospitality in Porto" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/blogs/manage/${blogId}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("publishes and unpublishes through explicit lifecycle endpoints", async () => {
    navigation.query = `id=${blogId}`;
    let current = blog();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/publish") && init?.method === "POST") {
          current = blog("published");
          return response(current);
        }
        if (url.endsWith("/unpublish") && init?.method === "POST") {
          current = blog("draft");
          return response(current);
        }
        return response(current);
      }),
    );
    renderEditor();
    await screen.findByRole("textbox", { name: "Article title" });

    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/blogs/manage/${blogId}/publish`,
        expect.objectContaining({ method: "POST", body: "{}" }),
      ),
    );
    const unpublish = await screen.findByRole("button", { name: "Unpublish" });
    fireEvent.click(unpublish);
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/blogs/manage/${blogId}/unpublish`,
        expect.objectContaining({ method: "POST", body: "{}" }),
      ),
    );
  });

  it("uses a version-bound token for secure draft preview", async () => {
    navigation.query = `id=${blogId}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/preview") && init?.method === "POST") {
          return response({ token: "preview.token", expiresAt: "2099-01-01T00:00:00.000Z" });
        }
        if (url.includes("/preview?token=")) return response(blog());
        return response(blog());
      }),
    );
    renderEditor();
    await screen.findByRole("textbox", { name: "Article title" });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    const dialog = await screen.findByRole("dialog", { name: "Persian hospitality" });
    expect(within(dialog).getByText("A welcoming table.")).toBeVisible();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/blogs/persian-hospitality/preview?token=preview.token",
      { credentials: "same-origin", cache: "no-store" },
    );
  });

  it("schedules publication and protects dirty navigation", async () => {
    navigation.query = `id=${blogId}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/schedule") && init?.method === "POST") {
          return response(blog("scheduled"));
        }
        if (init?.method === "PATCH") return response(blog());
        return response(blog());
      }),
    );
    renderEditor();
    await screen.findByRole("textbox", { name: "Article title" });
    fireEvent.change(screen.getByLabelText("Publication time"), {
      target: { value: "2099-10-01T12:00" },
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Schedule publication" }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/blogs/manage/${blogId}/schedule`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("enforces create permissions and rejects invalid identifiers", () => {
    const denied = renderEditor({
      canCreate: false,
      canPublish: false,
      canUpdate: false,
      canUploadMedia: false,
    });
    expect(screen.getByText("Access denied")).toBeVisible();
    denied.unmount();

    navigation.query = "id=invalid";
    renderEditor();
    expect(screen.getByText("Invalid article")).toBeVisible();
  });
});
