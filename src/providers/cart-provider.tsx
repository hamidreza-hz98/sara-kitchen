"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CartContext, type CartContextValue, type CartStateStatus } from "@/hooks/cart-context";
import {
  CART_SYNC_STORAGE_KEY,
  CartClientError,
  broadcastCartInvalidation,
  cartClientTransport,
  type CartClientSnapshot,
  type CartClientTransport,
} from "@/lib/cart-client";
import { CUSTOMER_AUTH_SYNC_KEY } from "@/lib/customer-auth-sync";

type CartIntent = {
  dishId: string;
  id: number;
  quantity?: number;
  reject(error: CartClientError): void;
  resolve(): void;
  type: "add" | "remove" | "update";
};

type CartView = Readonly<{
  cart: CartClientSnapshot | null;
  error: CartClientError | null;
  pendingDishIds: ReadonlySet<string>;
  status: CartStateStatus;
}>;

const EMPTY_PRICING = Object.freeze({
  adjustmentsCents: 0,
  calculatedAt: null,
  deliveryFeeCents: 0,
  discountCents: 0,
  subtotalCents: 0,
  taxCents: 0,
  totalCents: 0,
});

function emptyCart(): CartClientSnapshot {
  return {
    currency: "EUR",
    id: null,
    lines: [],
    pricing: EMPTY_PRICING,
    selectedAddressId: null,
    version: null,
  };
}

function project(
  authoritative: CartClientSnapshot | null,
  intents: readonly CartIntent[],
): CartClientSnapshot | null {
  if (!authoritative && intents.length === 0) return null;
  const source = authoritative ?? emptyCart();
  const lines = source.lines.map((line) => ({ ...line }));
  for (const intent of intents) {
    const index = lines.findIndex(({ dishId }) => dishId === intent.dishId);
    if (intent.type === "remove") {
      if (index >= 0) lines.splice(index, 1);
      continue;
    }
    if (intent.type === "update") {
      if (index >= 0 && intent.quantity !== undefined) lines[index]!.quantity = intent.quantity;
      continue;
    }
    if (index >= 0) lines[index]!.quantity += intent.quantity ?? 1;
    else lines.push({ dishId: intent.dishId, quantity: intent.quantity ?? 1 });
  }
  return { ...source, lines };
}

function normalizeError(error: unknown): CartClientError {
  return error instanceof CartClientError ? error : new CartClientError("unknown");
}

function validDishId(value: string): boolean {
  return /^[a-f\d]{24}$/iu.test(value);
}

export type CartProviderProps = Readonly<{
  autoLoad?: boolean;
  children: ReactNode;
  initialCart?: CartClientSnapshot | null;
  transport?: CartClientTransport;
}>;

export function CartProvider({
  autoLoad = true,
  children,
  initialCart = null,
  transport = cartClientTransport,
}: CartProviderProps) {
  const authoritative = useRef<CartClientSnapshot | null>(initialCart);
  const intents = useRef<CartIntent[]>([]);
  const intentSequence = useRef(0);
  const identityEpoch = useRef(0);
  const mutationController = useRef<AbortController | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const processing = useRef(false);
  const refreshAfterMutations = useRef(false);
  const mounted = useRef(true);
  const [view, setView] = useState<CartView>({
    cart: initialCart,
    error: null,
    pendingDishIds: new Set(),
    status: autoLoad ? "loading" : "ready",
  });

  const publish = useCallback((error: CartClientError | null = null, status?: CartStateStatus) => {
    if (!mounted.current) return;
    setView({
      cart: project(authoritative.current, intents.current),
      error,
      pendingDishIds: new Set(intents.current.map(({ dishId }) => dishId)),
      status: status ?? (error ? "error" : "ready"),
    });
  }, []);

  const refresh = useCallback(async () => {
    if (processing.current || intents.current.length > 0) {
      refreshAfterMutations.current = true;
      return;
    }
    const epoch = identityEpoch.current;
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    if (!authoritative.current) publish(null, "loading");
    try {
      const result = await transport.get(controller.signal);
      if (identityEpoch.current !== epoch || controller.signal.aborted) return;
      authoritative.current = result;
      publish();
    } catch (error) {
      if (controller.signal.aborted || identityEpoch.current !== epoch) return;
      publish(normalizeError(error));
    } finally {
      if (refreshController.current === controller) refreshController.current = null;
    }
  }, [publish, transport]);

  const drain = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    try {
      while (intents.current.length > 0) {
        const intent = intents.current[0]!;
        const epoch = identityEpoch.current;
        const controller = new AbortController();
        mutationController.current = controller;
        const input = {
          dishId: intent.dishId,
          expectedVersion: authoritative.current?.version ?? null,
          ...(intent.quantity === undefined ? {} : { quantity: intent.quantity }),
        };
        try {
          const result = await transport[intent.type](input, controller.signal);
          if (epoch !== identityEpoch.current || controller.signal.aborted) continue;
          authoritative.current = result;
          intents.current = intents.current.filter(({ id }) => id !== intent.id);
          intent.resolve();
          publish();
          broadcastCartInvalidation();
        } catch (error) {
          if (epoch !== identityEpoch.current || controller.signal.aborted) continue;
          const normalized = normalizeError(error);
          if (normalized.code === "conflict" && normalized.current) {
            authoritative.current = normalized.current;
          }
          intents.current = intents.current.filter(({ id }) => id !== intent.id);
          intent.reject(normalized);
          publish(normalized);
        } finally {
          if (mutationController.current === controller) mutationController.current = null;
        }
      }
    } finally {
      processing.current = false;
      if (refreshAfterMutations.current) {
        refreshAfterMutations.current = false;
        await refresh();
      }
    }
  }, [publish, refresh, transport]);

  const enqueue = useCallback(
    (type: CartIntent["type"], dishId: string, quantity?: number): Promise<void> => {
      if (
        !validDishId(dishId) ||
        (type !== "remove" && (!Number.isSafeInteger(quantity) || (quantity ?? 0) < 1))
      ) {
        return Promise.reject(new CartClientError("rejected"));
      }
      return new Promise<void>((resolve, reject) => {
        intents.current.push({
          dishId: dishId.toLowerCase(),
          id: ++intentSequence.current,
          ...(quantity === undefined ? {} : { quantity }),
          reject,
          resolve,
          type,
        });
        publish();
        drain().catch(() => undefined);
      });
    },
    [drain, publish],
  );

  const resetForAuthentication = useCallback(() => {
    identityEpoch.current += 1;
    mutationController.current?.abort();
    refreshController.current?.abort();
    const error = new CartClientError("identity_changed");
    for (const intent of intents.current) intent.reject(error);
    intents.current = [];
    authoritative.current = null;
    refreshAfterMutations.current = false;
    publish(null, "loading");
    refresh().catch(() => undefined);
  }, [publish, refresh]);

  useEffect(() => {
    mounted.current = true;
    if (autoLoad)
      queueMicrotask(() => {
        refresh().catch(() => undefined);
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_SYNC_STORAGE_KEY) refresh().catch(() => undefined);
      if (event.key === CUSTOMER_AUTH_SYNC_KEY) resetForAuthentication();
    };
    const onAuthentication = () => resetForAuthentication();
    const onFocus = () => {
      refresh().catch(() => undefined);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CUSTOMER_AUTH_SYNC_KEY, onAuthentication);
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      identityEpoch.current += 1;
      mutationController.current?.abort();
      refreshController.current?.abort();
      const error = new CartClientError("aborted");
      for (const intent of intents.current) intent.reject(error);
      intents.current = [];
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CUSTOMER_AUTH_SYNC_KEY, onAuthentication);
      window.removeEventListener("focus", onFocus);
    };
  }, [autoLoad, refresh, resetForAuthentication]);

  const value = useMemo<CartContextValue>(
    () => ({
      addItem: (dishId, quantity = 1) => enqueue("add", dishId, quantity),
      cart: view.cart,
      clearError: () => publish(),
      error: view.error,
      itemCount: view.cart?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0,
      pendingDishIds: view.pendingDishIds,
      refresh,
      removeItem: (dishId) => enqueue("remove", dishId),
      status: view.status,
      updateQuantity: (dishId, quantity) => enqueue("update", dishId, quantity),
    }),
    [enqueue, publish, refresh, view],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
