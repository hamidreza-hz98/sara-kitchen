import { ThemeProvider } from "@mui/material/styles";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityLogManager } from "@/app/[locale]/(dashboard)/dashboard/activity/activity-log-manager";
import { PROJECT_TIME_ZONE } from "@/constants";
import messages from "@/locales/messages/en";
import { appTheme } from "@/theme";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("@/locales/navigation", () => ({
  usePathname: () => "/dashboard/activity",
  useRouter: () => ({ replace: navigation.replace }),
}));

const maliciousContext = '<script>alert("audit")</script>';
const event = {
  id: "507f1f77bcf86cd799439013",
  actionCode: "crud.resource.update",
  message: "Resource was updated successfully.",
  actor: {
    kind: "admin",
    ref: "507f1f77bcf86cd799439011",
    snapshot: { displayName: "Hamidreza Hassanzadeh", role: "owner" },
  },
  resource: {
    kind: "dish",
    ref: "dish-1",
    snapshot: { code: "SK-DISH-1", label: "Fesenjan", status: "published" },
  },
  outcome: "success",
  severity: "info",
  type: "data",
  requestId: "request.activity-test",
  context: { changedField: maliciousContext },
  networkPolicy: "hashed",
  userAgent: "Test browser",
  occurredAt: "2026-10-08T12:00:00.000Z",
  createdAt: "2026-10-08T12:00:00.000Z",
} as const;

function response() {
  return new Response(
    JSON.stringify({
      data: [event],
      meta: { pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } },
    }),
    { status: 200 },
  );
}

function renderManager() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone={PROJECT_TIME_ZONE}>
      <ThemeProvider theme={appTheme} defaultMode="light">
        <ActivityLogManager />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  navigation.query = "";
  navigation.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("activity-log manager", () => {
  it("persists the complete filter state in the URL", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findAllByText(event.message);
    await user.type(screen.getByLabelText("Request ID"), "request-42");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/dashboard/activity?requestId=request-42&page=1",
      { scroll: false },
    );
  });

  it("renders sanitized projection values as inert text in the details drawer", async () => {
    navigation.query = `event=${event.id}`;
    renderManager();
    const drawer = await screen.findByRole("dialog", { name: event.message });
    expect(within(drawer).getByText(maliciousContext)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(within(drawer).getByText("Hashed")).toBeInTheDocument();
    expect(within(drawer).queryByText(/ipHash|ipAddress/u)).not.toBeInTheDocument();
  });
});
