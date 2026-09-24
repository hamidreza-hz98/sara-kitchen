import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoteRelationSelector, type RemoteRelationOption } from "@/components/relations";
import { appTheme } from "@/theme";

const selfId = "a".repeat(24);
const availableId = "b".repeat(24);
const archivedId = "c".repeat(24);
const unavailableId = "d".repeat(24);

const labels = {
  add: "Browse catalog",
  close: "Done",
  empty: "No relations",
  error: "Load failed",
  loading: "Loading catalog",
  remove: "Remove relation",
  retry: "Try again",
  search: "Search by name",
  selectedCount: "No selections",
  self: "Current item",
  statuses: {
    draft: "Draft",
    scheduled: "Scheduled",
    published: "Published",
    archived: "Archived",
  },
  availability: {
    available: "Available",
    unavailable: "Unavailable",
    scheduled: "Scheduled",
  },
} as const;

function mapOption(value: unknown): RemoteRelationOption | null {
  if (!value || typeof value !== "object") return null;
  const option = value as RemoteRelationOption;
  return typeof option.id === "string" && typeof option.label === "string" ? option : null;
}

function envelope(data: readonly RemoteRelationOption[], page = 1) {
  return new Response(
    JSON.stringify({
      data,
      meta: { pagination: { page, pageSize: 2, totalItems: 4, totalPages: 2 } },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("page=2")) {
        return envelope(
          [
            {
              id: archivedId,
              label: "Archived stew",
              status: "archived",
              availability: "available",
            },
            {
              id: unavailableId,
              label: "Seasonal rice",
              status: "published",
              availability: "unavailable",
            },
          ],
          2,
        );
      }
      return envelope([
        {
          id: selfId,
          label: "Current dish",
          status: "published",
          availability: "available",
        },
        {
          id: availableId,
          label: "Fesenjan",
          status: "published",
          availability: "available",
        },
      ]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("remote relation selector", () => {
  it("loads bounded pages, prevents self/archived selection, and exposes availability", async () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={appTheme} defaultMode="light">
        <RemoteRelationSelector
          endpoint="/api/dishes/manage"
          excludedIds={[selfId]}
          labels={labels}
          mapOption={mapOption}
          pageSize={2}
          title="Related dishes"
          value={[]}
          onChange={onChange}
        />
      </ThemeProvider>,
    );

    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Browse catalog" }));
    expect(await screen.findByText("Fesenjan")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("pageSize=2"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(screen.getByText("Current item").closest('[role="button"]')).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(screen.getByText("Fesenjan"));
    expect(onChange).toHaveBeenCalledWith([availableId]);

    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    expect(await screen.findByText("Archived stew")).toBeVisible();
    expect(screen.getByText("Archived stew").closest('[role="button"]')).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Unavailable")).toBeVisible();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("page=2"), expect.any(Object)),
    );
  });

  it("sends a bounded server-side search instead of filtering an eager catalog", async () => {
    render(
      <ThemeProvider theme={appTheme} defaultMode="light">
        <RemoteRelationSelector
          endpoint="/api/dishes/manage"
          labels={labels}
          mapOption={mapOption}
          pageSize={12}
          title="Related dishes"
          value={[]}
          onChange={vi.fn()}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Browse catalog" }));
    await screen.findByText("Fesenjan");
    fireEvent.change(screen.getByRole("textbox", { name: "Search by name" }), {
      target: { value: "rice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search by name" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("search=rice"),
        expect.any(Object),
      ),
    );
  });
});
