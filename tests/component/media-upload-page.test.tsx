import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaUploadPage } from "@/app/[locale]/(dashboard)/dashboard/media/upload/upload-page";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { appTheme } from "@/theme";

const upload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/media-bulk-upload", () => ({
  uploadMediaBatch: upload,
}));

vi.mock("@/locales/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <FeedbackProvider>
          <MediaUploadPage />
        </FeedbackProvider>
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

function image(name: string, size = 3): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

beforeEach(() => upload.mockReset());

describe("media upload page", () => {
  it("validates duplicates and oversized files before upload", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText("Choose media files");
    const first = image("rice.png");
    await user.upload(input, first);
    await user.upload(input, first);
    expect(screen.getByRole("alert")).toHaveTextContent("already in the list");
    fireEvent.drop(screen.getByLabelText("Media drop zone"), {
      dataTransfer: { files: [image("large.png", 3 * 1024 * 1024 + 1)] },
    });
    expect(screen.getByText("This file exceeds the current 3 MB upload limit.")).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows partial results, supports retry, and warns before navigation", async () => {
    const user = userEvent.setup();
    upload
      .mockImplementationOnce(async (items: Array<{ clientId: string; file: File }>) => ({
        items: items.map((item, index) => ({
          clientId: item.clientId,
          fileName: item.file.name,
          index,
          status: index === 0 ? "succeeded" : "failed",
          progress: 100,
          attempts: 1,
          media: index === 0 ? { id: "id", checksum: "hash", variantCount: 1 } : null,
          error: index === 0 ? null : { code: "NETWORK_ERROR", retryable: true },
        })),
        summary: { total: 2, succeeded: 1, failed: 1, retried: 0 },
      }))
      .mockImplementationOnce(async (items: Array<{ clientId: string; file: File }>) => ({
        items: [
          {
            clientId: items[0]!.clientId,
            fileName: items[0]!.file.name,
            index: 0,
            status: "succeeded",
            progress: 100,
            attempts: 1,
            media: { id: "id2", checksum: "hash2", variantCount: 1 },
            error: null,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0, retried: 0 },
      }));
    renderPage();
    await user.upload(screen.getByLabelText("Choose media files"), [
      image("a.png"),
      image("b.png"),
    ]);
    expect(screen.getByRole("button", { name: "Upload 2 files" })).toBeEnabled();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("link", { name: "Back to media" }));
    expect(confirm).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Upload 2 files" }));
    await waitFor(() =>
      expect(
        screen.getAllByText("1 succeeded, 1 failed, 0 retried out of 2 files.").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText("Network error. Check your connection and retry.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry b.png" }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getAllByText("1 succeeded, 0 failed, 0 retried out of 1 files.").length,
      ).toBeGreaterThan(0),
    );
    confirm.mockRestore();
  });
});
