import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryEditor } from "@/app/[locale]/(dashboard)/dashboard/categories/modify/category-editor";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  useRouter: () => ({ push: navigation.push, refresh: navigation.refresh }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json" }),
}));
vi.mock("@/components/media", () => ({
  MediaPicker: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@/app/[locale]/(dashboard)/dashboard/categories/modify/category-rich-editor", () => ({
  CategoryRichEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Description"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function renderEditor() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CategoryEditor canCreate canUpdate />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.push.mockReset();
  navigation.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("category editor", () => {
  it("requires canonical English text before submitting", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Save category" }));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps form values and reports an unavailable write service", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByRole("textbox", { name: "Category name" }), "Persian starters");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Fresh starters");
    await user.click(screen.getByRole("button", { name: "Save category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saving is temporarily unavailable");
    expect(screen.getByRole("textbox", { name: "Category name" })).toHaveValue("Persian starters");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("loads an edit record and redirects only after a successful response", async () => {
    const id = "a".repeat(24);
    navigation.query = `id=${id}`;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(id))
        return new Response(
          JSON.stringify({
            data: {
              id,
              slug: "persian-starters",
              status: "draft",
              sortOrder: 0,
              imageMediaId: null,
              bannerMediaId: null,
              translations: [
                { locale: "en", name: "Persian starters", description: "Fresh starters" },
              ],
            },
          }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ data: { id } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderEditor();
    expect(await screen.findByDisplayValue("Persian starters")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save category" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/categories"));
    expect(navigation.refresh).toHaveBeenCalled();
  });
});
