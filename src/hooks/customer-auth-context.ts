"use client";

import { createContext } from "react";

export type CustomerAuthState = {
  authenticated: boolean;
  displayName: string | null;
  ready: boolean;
};

export const CustomerAuthContext = createContext<CustomerAuthState>({
  authenticated: false,
  displayName: null,
  ready: false,
});
