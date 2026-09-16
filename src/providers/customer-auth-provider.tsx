"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { CustomerAuthContext, type CustomerAuthState } from "@/hooks/customer-auth-context";
import { CUSTOMER_AUTH_SYNC_KEY } from "@/lib/customer-auth-sync";

const INITIAL: CustomerAuthState = { authenticated: false, displayName: null, ready: false };

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomerAuthState>(INITIAL);
  const requestVersion = useRef(0);
  const router = useRouter();
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const response = await fetch("/api/auth/customer/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const result = (await response.json()) as {
        data?: { authenticated?: boolean; displayName?: string };
      };
      if (version !== requestVersion.current) return;
      setState({
        authenticated: result.data?.authenticated === true,
        displayName: result.data?.authenticated ? (result.data.displayName ?? null) : null,
        ready: true,
      });
    } catch {
      // A network failure must not be interpreted as a successful logout.
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      refresh().catch(() => undefined);
    });
    const onLocalChange = () => {
      refresh().catch(() => undefined);
      router.refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CUSTOMER_AUTH_SYNC_KEY) onLocalChange();
    };
    const onFocus = () => {
      refresh().catch(() => undefined);
      router.refresh();
    };
    window.addEventListener(CUSTOMER_AUTH_SYNC_KEY, onLocalChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(CUSTOMER_AUTH_SYNC_KEY, onLocalChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, router]);

  return <CustomerAuthContext.Provider value={state}>{children}</CustomerAuthContext.Provider>;
}
