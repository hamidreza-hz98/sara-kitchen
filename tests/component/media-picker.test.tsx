import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaPicker } from "@/components/media";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import persianMessages from "@/locales/messages/fa";
import { appTheme } from "@/theme";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media-bulk-upload", () => ({ uploadMediaBatch: upload }));

const image = {
  id: "a".repeat(24),
  originalName: "saffron-rice.webp",
  kind: "image",
  processingState: "ready",
  preview: { url: "https://example.test/rice.webp" },
  translations: [{ locale: "en", alt: "Saffron rice" }],
};
const pdf = {
  id: "b".repeat(24),
  originalName: "menu.pdf",
  kind: "pdf",
  processingState: "ready",
  preview: null,
  translations: [{ locale: "en", alt: "Menu" }],
};

function SingleForm({ label }: { label: string }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <MediaPicker allowedKinds={["image"]} label={label} onChange={setValue} value={value} />
      <output>{value ?? "none"}</output>
    </>
  );
}

function MultipleForm({ label }: { label: string }) {
  const [value, setValue] = useState<readonly string[]>([]);
  return (
    <>
      <MediaPicker
        allowedKinds={["image"]}
        canUpload
        label={label}
        multiple
        onChange={setValue}
        value={value}
      />
      <output>{value.join(",") || "none"}</output>
    </>
  );
}

function renderForm(content: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        {content}
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  upload.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/media/"))
        return new Response(JSON.stringify({ data: image }), { status: 200 });
      return new Response(
        JSON.stringify({ data: [image, pdf], meta: { pagination: { totalPages: 1 } } }),
        { status: 200 },
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("reusable media picker", () => {
  it.each(["Category banner", "Blog banner", "Homepage hero"])(
    "binds a single image reference for %s",
    async (label) => {
      const user = userEvent.setup();
      renderForm(<SingleForm label={label} />);
      await user.click(screen.getByRole("button", { name: "Browse media" }));
      const dialog = screen.getByRole("dialog", { name: `Choose media for ${label}` });
      expect(await within(dialog).findByText("saffron-rice.webp")).toBeVisible();
      expect(within(dialog).queryByText("menu.pdf")).not.toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("kind=image"), expect.anything());
      await user.click(within(dialog).getByRole("button", { name: /saffron-rice.webp/ }));
      await user.click(within(dialog).getByRole("button", { name: "Use selection" }));
      expect(screen.getByText(image.id)).toBeVisible();
    },
  );

  it("hides upload without permission", async () => {
    const user = userEvent.setup();
    renderForm(<SingleForm label="Category banner" />);
    await user.click(screen.getByRole("button", { name: "Browse media" }));
    expect(screen.queryByRole("button", { name: "Upload new image" })).not.toBeInTheDocument();
  });

  it("shows the upload action in Persian", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="fa" messages={persianMessages} timeZone={PROJECT_TIME_ZONE}>
        <ThemeProvider theme={appTheme}>
          <MediaPicker
            label="تصویر"
            value={null}
            onChange={() => {}}
            canUpload
            allowedKinds={["image"]}
          />
        </ThemeProvider>
      </NextIntlClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "مرور رسانه‌ها" }));
    expect(screen.getByRole("button", { name: "بارگذاری تصویر جدید" })).toBeVisible();
  });

  it("binds multiple dish images and supports inline image upload", async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({
      items: [{ status: "succeeded", media: { id: image.id } }],
      summary: { total: 1, succeeded: 1, failed: 0, retried: 0 },
    });
    renderForm(<MultipleForm label="Dish gallery" />);
    await user.click(screen.getByRole("button", { name: "Browse media" }));
    const dialog = screen.getByRole("dialog", { name: "Choose media for Dish gallery" });
    await within(dialog).findByText("saffron-rice.webp");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Search media" }),
      "saffron{Enter}",
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("search=saffron"),
        expect.anything(),
      ),
    );
    const notice = vi.fn();
    window.addEventListener("sara-media-uploaded", notice, { once: true });
    await user.upload(
      within(dialog).getByLabelText("Choose image to upload"),
      new File([new Uint8Array([1])], "new.png", { type: "image/png" }),
    );
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    await waitFor(() => expect(notice).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(within(dialog).getByRole("textbox", { name: "Search media" })).toHaveValue(""),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        expect.not.stringContaining("search=saffron"),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(within(dialog).getByText("1 item selected")).toBeVisible());
    await user.click(within(dialog).getByRole("button", { name: "Use selection" }));
    expect(screen.getByText(image.id)).toBeVisible();
  });
});
