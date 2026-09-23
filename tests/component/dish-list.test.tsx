import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DishList } from "@/app/[locale]/(dashboard)/dashboard/dishes/dish-list";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/dishes",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));

const categoryId = "b".repeat(24);
const dish = {
  id: "a".repeat(24),
  translations: [
    { locale: "en", name: "Fesenjan", excerpt: "Walnut and pomegranate stew" },
    { locale: "fa", name: "فسنجان" },
  ],
  slug: "fesenjan",
  mediaIds: [],
  categoryIds: [categoryId],
  basePriceCents: 1_200,
  discount: {
    type: "percentage",
    amountCents: null,
    basisPoints: 1_000,
    startsAt: null,
    endsAt: null,
  },
  availability: { mode: "available", availableFrom: null, availableUntil: null },
  leadTimeMinutes: 60,
  isFeatured: true,
  featuredOrder: 1,
  soldCount: 25,
  viewCount: 150,
  status: "published",
};

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
    canCreate: true,
    canReadCategories: true,
    canRestore: true,
    canUpdate: true,
  },
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <DishList {...capabilities} />
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
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith("/api/categories")
        ? envelope([
            {
              id: categoryId,
              slug: "main-courses",
              translations: [{ locale: "en", name: "Main courses" }],
            },
          ])
        : envelope([dish]),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("dish list", () => {
  it("renders prices, translations, categories, availability, metrics, and permitted actions", async () => {
    renderList();
    expect(screen.getByLabelText("Loading dishes")).toBeVisible();
    expect((await screen.findAllByText("Fesenjan")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("€10.80").length).toBeGreaterThan(0);
    expect(screen.getAllByText("€12.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main courses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getAllByText("25 sold").length).toBeGreaterThan(0);
    expect(screen.getAllByText("150 views").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add dish" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Edit Fesenjan" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Archive Fesenjan" }).length).toBeGreaterThan(0);
  });

  it("hides mutation controls when permissions are absent", async () => {
    renderList({
      canCreate: false,
      canReadCategories: false,
      canRestore: false,
      canUpdate: false,
    });
    await screen.findAllByText("Fesenjan");
    expect(screen.queryByRole("button", { name: "Add dish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Fesenjan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Fesenjan" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  });

  it("keeps search and filters in the URL", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText("Fesenjan");
    await user.type(screen.getByRole("textbox", { name: "Search dishes" }), "rice");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard/dishes?search=rice&page=1", {
        scroll: false,
      }),
    );
  });

  it("renders empty and recoverable error states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelope([])),
    );
    const view = renderList({
      canCreate: true,
      canReadCategories: false,
      canRestore: true,
      canUpdate: true,
    });
    expect(await screen.findByText("No dishes found")).toBeVisible();
    view.unmount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    renderList({
      canCreate: true,
      canReadCategories: false,
      canRestore: true,
      canUpdate: true,
    });
    expect(await screen.findByText("Dishes could not be loaded")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
