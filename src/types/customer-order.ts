import type { OrderStatus } from "@/constants/order-status";

export type CustomerOrderTab = "all" | "active" | "completed" | "closed";

export type CustomerOrderListItem = Readonly<{
  code: string;
  status: OrderStatus;
  createdAt: string;
  totalCents: number;
  fulfillmentMethod: "pickup" | "delivery";
  itemCount: number;
  items: readonly Readonly<{ name: string; quantity: number }>[];
}>;

export type CustomerOrderListInput = Readonly<{
  customerId: string;
  tab: CustomerOrderTab;
  status?: OrderStatus;
  page: number;
  pageSize: number;
}>;

export type CustomerOrderListResult = Readonly<{
  items: readonly CustomerOrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: Readonly<Record<CustomerOrderTab, number>>;
}>;
