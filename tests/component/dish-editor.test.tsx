import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DishEditor } from "@/app/[locale]/(dashboard)/dashboard/dishes/modify/dish-editor";
import { PROJECT_TIME_ZONE, type SupportedLocale } from "@/constants";
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
  MediaPicker: ({ label, onChange }: { label: string; onChange: (value: string[]) => void }) => (
    <button type="button" onClick={() => onChange(["b".repeat(24)])}>
      {label}
    </button>
  ),
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

function renderEditor(
  capabilities = { canCreate: true, canUpdate: true, canUploadMedia: true },
  locale: SupportedLocale = "en",
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={PROJECT_TIME_ZONE}>
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
    expect(screen.getAllByRole("button", { name: "Browse catalog" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button", { name: "Browse catalog" })) {
      expect(button).toBeEnabled();
    }
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the English dish name.");
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
  });

  it("publishes without optional translations, media, category or ingredients", async () => {
    renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Dish name" }), {
      target: { value: "Rice" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Published" }));
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/dishes"));
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      status: "published",
      mediaIds: [],
      categoryIds: [],
      ingredients: [],
    });
  });

  it("identifies incomplete specification fields and ignores untouched empty rows", async () => {
    renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Dish name" }), {
      target: { value: "Rice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add specification" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), {
      target: { value: "Spice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Complete both the label and value of each English specification",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/dishes"));
  }, 30_000);

  it("identifies unavailable references returned by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "POST"
          ? new Response(
              JSON.stringify({
                error: {
                  details: { issues: [{ code: "archived_reference", path: ["ingredients"] }] },
                },
              }),
              { status: 400 },
            )
          : response([]),
      ),
    );
    renderEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Dish name" }), {
      target: { value: "Rice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A selected ingredient is missing or unavailable.",
    );
  }, 30_000);

  it("shows category and ingredient names in the dashboard locale with an English fallback", async () => {
    const categoryId = "c".repeat(24);
    const ingredientId = "d".repeat(24);
    navigation.query = `id=${dishId}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input) === `/api/dishes/manage/${dishId}`)
          return response({
            ...detail,
            categoryIds: [categoryId],
            ingredients: [{ ingredientId, quantityAmount: null, quantityUnit: null, notes: [] }],
          });
        if (String(input).startsWith("/api/categories"))
          return response([
            {
              id: categoryId,
              translations: [
                { locale: "en", name: "Meals" },
                { locale: "fa", name: "غذاها" },
              ],
            },
          ]);
        if (String(input).startsWith("/api/ingredients"))
          return response([
            {
              id: ingredientId,
              translations: [
                { locale: "en", name: "Rice" },
                { locale: "fa", name: "برنج" },
              ],
            },
            { id: "e".repeat(24), translations: [{ locale: "en", name: "Salt" }] },
          ]);
        return response([]);
      }),
    );
    renderEditor(undefined, "fa");
    expect(await screen.findByText("برنج")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Categories" })).toHaveTextContent("غذاها");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Categories" }));
    expect(screen.getByRole("option", { name: "غذاها" })).toBeVisible();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Choose an ingredient" }));
    expect(screen.getByRole("option", { name: "Salt" })).toBeVisible();
  });

  it("adds the chosen ingredient and publishes when all required fields are supplied", async () => {
    const categoryId = "c".repeat(24);
    const ingredientId = "d".repeat(24);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") return response({ id: dishId }, 201);
        if (String(input).startsWith("/api/categories"))
          return response([{ id: categoryId, translations: [{ locale: "en", name: "Meals" }] }]);
        if (String(input).startsWith("/api/ingredients"))
          return response([{ id: ingredientId, translations: [{ locale: "en", name: "Rice" }] }]);
        return response([]);
      }),
    );
    renderEditor();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(2));
    for (const [language, name] of [
      ["English", "Rice"],
      ["Português", "Arroz"],
      ["فارسی", "برنج"],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name: language }));
      fireEvent.change(screen.getByRole("textbox", { name: /Dish name/ }), {
        target: { value: name },
      });
    }
    fireEvent.change(screen.getByRole("spinbutton", { name: "Base price (€)" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dish images and videos" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Categories" }));
    fireEvent.click(await screen.findByRole("option", { name: "Meals" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Choose an ingredient" }));
    fireEvent.click(await screen.findByRole("option", { name: "Rice" }));
    expect(screen.getByRole("button", { name: "Remove ingredient" })).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Published" }));
    fireEvent.click(screen.getByRole("button", { name: "Save dish" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/dashboard/dishes"));
    const request = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      status: "published",
      categoryIds: [categoryId],
      mediaIds: ["b".repeat(24)],
      ingredients: [{ ingredientId }],
    });
  }, 15_000);
});
