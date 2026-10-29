import { describe, expect, it, vi } from "vitest";

const requireAdminPage = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@/server/auth/page-guards", () => ({ requireAdminPage }));
vi.mock("@/app/[locale]/(dashboard)/dashboard/transactions/transaction-list", () => ({
  TransactionList: () => null,
}));

import DashboardTransactionsPage from "@/app/[locale]/(dashboard)/dashboard/transactions/page";

describe("transactions dashboard route", () => {
  it("requires transaction read permission before rendering", async () => {
    const page = await DashboardTransactionsPage();
    expect(requireAdminPage).toHaveBeenCalledWith("transactions:read");
    expect(page).toBeTruthy();
  });
});
