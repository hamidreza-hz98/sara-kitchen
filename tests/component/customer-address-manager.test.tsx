import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerAddressManager } from "@/app/[locale]/(storefront)/profile/addresses/customer-address-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const refreshCart = vi.fn(async () => undefined);
const cartState = vi.hoisted(() => ({ selectedAddressId: null as string | null }));
vi.mock("@/hooks", () => ({
  useCart: () => ({
    cart: { selectedAddressId: cartState.selectedAddressId },
    refresh: refreshCart,
    status: "ready",
  }),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfJsonHeaders: async () => ({ "content-type": "application/json", "x-csrf-token": "test" }),
}));
vi.mock("@/lib/cart-client", () => ({ broadcastCartInvalidation: vi.fn() }));
vi.mock("@/components/address", () => ({
  AddressEditor: ({
    onChange,
    value,
  }: {
    onChange(value: unknown): void;
    value: Record<string, unknown>;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          ...value,
          name: "New",
          recipientName: "Sara Kazemi",
          recipientMobile: "+351912345678",
          formattedAddress: "Rua Nova 1, Porto",
          postalCode: "4000-008",
        })
      }
    >
      Fill address
    </button>
  ),
}));

const home = {
  id: "a".repeat(24),
  version: 1,
  name: "Home",
  recipientName: "Sara Kazemi",
  recipientMobile: "+351912345678",
  formattedAddress: "Rua das Flores 1, Porto",
  location: { type: "Point", coordinates: [-8.606, 41.1496] },
  postalCode: "4000-008",
  deliveryNotes: null,
  isDefault: true,
};
const work = { ...home, id: "b".repeat(24), name: "Work", isDefault: false };

function renderManager() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <CustomerAddressManager />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  cartState.selectedAddressId = null;
  refreshCart.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("customer address management", () => {
  it("lists addresses with a default marker and delivery eligibility, then changes the default", async () => {
    let changed = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/eligibility"))
        return new Response(
          JSON.stringify({
            data: [
              { id: home.id, eligible: true, distanceMeters: 1200 },
              { id: work.id, eligible: false, distanceMeters: 24000 },
            ],
          }),
        );
      if (url.endsWith("/default") && init?.method === "POST") {
        changed = true;
        return new Response(JSON.stringify({ data: {} }));
      }
      return new Response(
        JSON.stringify({
          data: changed
            ? [
                { ...home, isDefault: false },
                { ...work, isDefault: true },
              ]
            : [home, work],
        }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(await screen.findByText("Within Porto delivery area")).toBeInTheDocument();
    expect(screen.getByText("Outside delivery area")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make Work the default address" }));
    expect(await screen.findByText("Default address updated.")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      `/api/profile/addresses/${work.id}/default`,
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Make Work the default address" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("warns before deleting an address selected in the current cart", async () => {
    cartState.selectedAddressId = home.id;
    let deleted = false;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/eligibility")) return new Response(JSON.stringify({ data: [] }));
      if (url.endsWith(home.id) && init?.method === "DELETE") {
        deleted = true;
        return new Response(JSON.stringify({ data: {} }));
      }
      return new Response(JSON.stringify({ data: deleted ? [] : [home] }));
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("Home");
    await user.click(screen.getByRole("button", { name: "Delete Home" }));
    expect(screen.getByText(/selected in your current cart/)).toBeInTheDocument();
    expect(deleted).toBe(false);
    await user.click(screen.getByRole("button", { name: "Delete address" }));
    expect(
      await screen.findByText(/choose a new delivery address or pickup before checkout/),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      `/api/profile/addresses/${home.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(refreshCart).toHaveBeenCalled();
  });

  it("requires an explicit map-pin confirmation before creating an address", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/eligibility")) return new Response(JSON.stringify({ data: [] }));
      if (init?.method === "POST")
        return new Response(JSON.stringify({ data: { ...home, name: "New" } }), { status: 201 });
      return new Response(JSON.stringify({ data: [] }));
    });
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("No saved addresses yet");
    await user.click(screen.getAllByRole("button", { name: "Add address" })[0]!);
    await user.click(screen.getByRole("button", { name: "Fill address" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByText(/place the map pin/)).toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Confirm this map pin" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
      expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
  });
});
