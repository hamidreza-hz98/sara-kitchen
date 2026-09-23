import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IngredientManager } from "@/app/[locale]/(dashboard)/dashboard/ingredients/ingredient-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/ingredients",
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));
vi.mock("@/components/media", () => ({
  MediaPicker: ({ label, onChange }: { label: string; onChange: (id: string) => void }) => (
    <button onClick={() => onChange("b".repeat(24))}>{label}</button>
  ),
}));

const draft = {
  id: "a".repeat(24),
  translations: [{ locale: "en", name: "Saffron" }],
  imageMediaId: null,
  allergenTags: [],
  status: "draft",
  createdAt: "2026-09-18T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
};
const archived = {
  ...draft,
  id: "c".repeat(24),
  translations: [{ locale: "en", name: "Archived milk" }],
  allergenTags: ["milk"],
  status: "archived",
};

function listResponse(data: readonly unknown[] = [draft, archived]) {
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

function renderManager(
  capabilities = { create: true, update: true, delete: true, uploadMedia: true },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <IngredientManager capabilities={capabilities} />
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
    vi.fn(async () => listResponse()),
  );
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ingredient manager", () => {
  it("renders loading and populated responsive states with permission-aware actions", async () => {
    renderManager();
    expect(screen.getByLabelText("Loading ingredients")).toBeVisible();
    expect((await screen.findAllByText("Saffron")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add ingredient" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Edit Saffron" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Archive Saffron" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Delete Archived milk" }).length).toBeGreaterThan(
      0,
    );
  });

  it("hides mutation controls when permissions are absent", async () => {
    renderManager({ create: false, update: false, delete: false, uploadMedia: false });
    await screen.findAllByText("Saffron");
    expect(screen.queryByRole("button", { name: "Add ingredient" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Saffron" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Saffron" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Archived milk" })).not.toBeInTheDocument();
  });

  it("creates translated ingredients with image, allergens, and status", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ data: draft }), { status: 201 })
        : listResponse(),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Saffron");
    await user.click(screen.getByRole("button", { name: "Add ingredient" }));
    const dialog = screen.getByRole("dialog", { name: "New ingredient" });
    await user.type(within(dialog).getByRole("textbox", { name: "Ingredient name" }), "Barberry");
    await user.click(within(dialog).getByRole("checkbox", { name: "Milk" }));
    await user.click(within(dialog).getByRole("button", { name: "Ingredient image" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/ingredients",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const createCall = fetcher.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      translations: [{ locale: "en", name: "Barberry" }],
      imageMediaId: "b".repeat(24),
      allergenTags: ["milk"],
      status: "draft",
    });
  }, 15_000);

  it("edits and archives an ingredient, and surfaces reference-safe deletion conflicts", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH")
        return new Response(JSON.stringify({ data: draft }), { status: 200 });
      if (url.endsWith("/archive"))
        return new Response(JSON.stringify({ data: archived }), { status: 200 });
      if (init?.method === "DELETE")
        return new Response(JSON.stringify({ error: {} }), { status: 409 });
      return listResponse();
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Saffron");
    await user.click(screen.getAllByRole("button", { name: "Edit Saffron" })[0]!);
    const editDialog = screen.getByRole("dialog", { name: "Edit ingredient" });
    const name = within(editDialog).getByRole("textbox", { name: "Ingredient name" });
    await user.clear(name);
    await user.type(name, "Persian saffron");
    await user.click(within(editDialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        `/api/ingredients/${draft.id}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit ingredient" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));

    await user.click(screen.getAllByRole("button", { name: "Archive Saffron" })[0]!);
    await user.click(
      within(screen.getByRole("dialog", { name: "Archive ingredient?" })).getByRole("button", {
        name: "Archive",
      }),
    );
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        `/api/ingredients/${draft.id}/archive`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Archive ingredient?" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));

    await user.click(screen.getAllByRole("button", { name: "Delete Archived milk" })[0]!);
    await user.click(
      within(screen.getByRole("dialog", { name: "Delete ingredient?" })).getByRole("button", {
        name: "Delete",
      }),
    );
    expect(
      await screen.findByText("This ingredient must be archived and unused before deletion."),
    ).toBeVisible();
  }, 15_000);

  it("renders empty and recoverable error states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => listResponse([])),
    );
    const view = renderManager();
    expect(await screen.findByText("No ingredients found")).toBeVisible();
    view.unmount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    renderManager();
    expect(await screen.findByText("Ingredients could not be loaded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("preserves search in the URL", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText("Saffron");
    const search = screen.getByRole("textbox", { name: "Search ingredients" });
    await user.clear(search);
    await user.type(search, "rice");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard/ingredients?search=rice&page=1", {
        scroll: false,
      }),
    );
  });
});
