"use client";

import { useContext } from "react";

import { CustomerAuthContext } from "./customer-auth-context";

export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
