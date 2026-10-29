import { requireAdminPage } from "@/server/auth/page-guards";
import { TransactionList } from "./transaction-list";

export default async function DashboardTransactionsPage() {
  await requireAdminPage("transactions:read");
  return <TransactionList />;
}
