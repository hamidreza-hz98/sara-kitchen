import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DishEditor } from "@/app/[locale]/(dashboard)/dashboard/dishes/modify/dish-editor";
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
  MediaPicker: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));
vi.mock("@/app/[locale]/(dashboard)/dashboard/dishes/modify/dish-rich-editor", () => ({
  DishRichEditor: ({ labelledBy }: { labelledBy: string }) => (
    <div role="textbox" aria-labelledby={labelledBy} />
  ),
}));

const dishId = "a".repeat(24);
const detail = {
  id: dishId,
  translations: [
    {
      locale: "en",
      name: "Fesenjan",
      excerpt: "Walnut stew",
      description: null,
      specifications: [],
    },
  ],
  slug: "fesenjan",
  mediaIds: [],
  categoryIds: [],
  ingredients: [],
  basePriceCents: 1_200,
  discount: {
    type: "none",
    amountCents: null,
    basisPoints: null,
    startsAt: null,
    endsAt: null,
  },
  portionAmount: 1,
  portionUnit: "serving",
  availability: { mode: "available", availableFrom: null, availableUntil: null },
  leadTimeMinutes: 60,
  maxQuantityPerOrder: 10,
  mayContainAllergenTags: [],
  dietaryTags: ["halal"],
  isFeatured: false,
  featuredOrder: 0,
  relatedDishIds: [],
  relatedBlogIds: [],
  status: "draft",
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderEditor(capabilities = { canCreate: true, canUpdate: true, canUploadMedia: true }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <DishEditor {...capabilities} />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.push.mockReset();
  navigation.refresh.mockReset();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST" ? response({ id: dishId }, 201) : response([]),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("dish editor", () => {
  it("creates a draft with the same normalized payload accepted by the server schema", async () => {
    renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Dish name" }), {
      target: { value: "Saffron rice" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Base price (€)" }), {
      target: { value: "14.50" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/dishes"));
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(request?.[0]).toBe("/api/dishes");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      translations: [{ locale: "en", name: "Saffron rice" }],
      basePriceCents: 1450,
      status: "draft",
      availability: { mode: "available" },
      relatedBlogIds: [],
    });
    expect(navigation.refresh).toHaveBeenCalled();
  }, 15_000);

  it("loads and updates an existing dish", async () => {
    navigation.query = `id=${dishId}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return response(detail);
        if (String(input) === `/api/dishes/manage/${dishId}`) return response(detail);
        return response([]);
      }),
    );
    renderEditor();
    expect(screen.getByLabelText("Loading dish")).toBeVisible();
    const name = await screen.findByRole("textbox", { name: "Dish name" });
    expect(name).toHaveValue("Fesenjan");
    fireEvent.change(name, { target: { value: "Fesenjan special" } });
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        `/api/dishes/manage/${dishId}`,
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  }, 15_000);

  it("shows permission and invalid-id states without exposing the form", () => {
    const denied = renderEditor({ canCreate: false, canUpdate: false, canUploadMedia: false });
    expect(screen.getByText("Access denied")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save dish" })).not.toBeInTheDocument();
    denied.unmount();
    navigation.query = "id=invalid";
    renderEditor();
    expect(screen.getByText("Invalid dish")).toBeVisible();
  });

  it("fails fast on incomplete values and keeps the user in the editor", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the highlighted and incomplete fields before saving.",
    );
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });
});
