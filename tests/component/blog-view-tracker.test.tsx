import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlogViewTracker } from "@/app/[locale]/(storefront)/blog/[blogSlug]/blog-interactions";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("blog view tracker", () => {
  it("submits one best-effort signal only after visible engagement", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", request);
    const { unmount } = render(<BlogViewTracker slug="saffron-rice" />);
    expect(request).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(2_999));
    expect(request).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/api/blogs/saffron-rice/view",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ engagementMs: 3_000, visibilityState: "visible" }),
      }),
    );
    unmount();
  });
});
