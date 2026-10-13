"use client";

import { createContext } from "react";

import type { CartClientError, CartClientSnapshot } from "@/lib/cart-client";

export type CartStateStatus = "error" | "loading" | "ready";

export type CartContextValue = Readonly<{
  addItem(dishId: string, quantity?: number): Promise<void>;
  cart: CartClientSnapshot | null;
  clearError(): void;
  error: CartClientError | null;
  itemCount: number;
  pendingDishIds: ReadonlySet<string>;
  refresh(): Promise<void>;
  removeItem(dishId: string): Promise<void>;
  status: CartStateStatus;
  updateQuantity(dishId: string, quantity: number): Promise<void>;
}>;

const unavailable = async () => {
  throw new Error("CartProvider is missing.");
};

export const CartContext = createContext<CartContextValue>({
  addItem: unavailable,
  cart: null,
  clearError: () => undefined,
  error: null,
  itemCount: 0,
  pendingDishIds: new Set(),
  refresh: unavailable,
  removeItem: unavailable,
  status: "loading",
  updateQuantity: unavailable,
});
