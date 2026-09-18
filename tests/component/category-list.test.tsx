import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryList } from "@/app/[locale]/(dashboard)/dashboard/categories/category-list";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/categories",
  useRouter: () => ({ replace: navigation.replace }),
}));

function renderList() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CategoryList canCreate />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

const item = {
  id: "a".repeat(24),
  slug: "persian-starters",
  status: "published",
  imageMediaId: null,
  sortOrder: 1,
  translations: [{ locale: "en", name: "Persian starters", description: "Fresh starters" }],
};

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [item],
            meta: { pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } },
          }),
          { status: 200 },
        ),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("category list", () => {
  it("renders loading and populated states with honest unavailable dish count", async () => {
    renderList();
    expect(screen.getByLabelText("Loading categories")).toBeVisible();
    expect((await screen.findAllByText("Persian starters")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("persian-starters").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add category" })).toBeDisabled();
    expect(screen.getByRole("navigation", { name: "Category pages" })).toBeVisible();
  });

  it("renders empty and error states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [],
              meta: { pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
            }),
            { status: 200 },
          ),
      ),
    );
    const view = renderList();
    expect(await screen.findByText("No categories found")).toBeVisible();
    view.unmount();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    renderList();
    expect(await screen.findByText("Categories could not be loaded")).toBeVisible();
  });

  it("keeps search in the URL", async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText("Persian starters");
    await user.type(screen.getByRole("textbox", { name: "Search categories" }), "rice");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard/categories?search=rice&page=1", {
        scroll: false,
      }),
    );
  });
});
