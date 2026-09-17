"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";

export function ResetPasswordForm() {
  const t = useTranslations("storefront.resetPassword");
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"success" | "invalid" | "mismatch" | "error" | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const captureToken = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => {
        setToken(value);
        setResult(value ? null : "invalid");
      });
    };
    if (!initialized.current) {
      initialized.current = true;
      captureToken();
    }
    window.addEventListener("hashchange", captureToken);
    return () => window.removeEventListener("hashchange", captureToken);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setResult("mismatch");
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/auth/customer/password-reset/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, newPassword }),
      });
      if (response.ok) {
        setToken(null);
        setResult("success");
        broadcastCustomerAuthChange();
      } else setResult(response.status === 400 ? "invalid" : "error");
    } catch {
      setResult("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(event) => {
        submit(event).catch(() => setResult("error"));
      }}
    >
      <TextField
        autoComplete="new-password"
        disabled={!token || result === "success"}
        helperText={t("passwordHint")}
        label={t("newPassword")}
        name="newPassword"
        required
        slotProps={{ htmlInput: { minLength: 15 } }}
        type="password"
      />
      <TextField
        autoComplete="new-password"
        disabled={!token || result === "success"}
        label={t("confirmPassword")}
        name="confirmPassword"
        required
        type="password"
      />
      {result && (
        <Alert role="status" severity={result === "success" ? "success" : "error"}>
          {t(result)}
        </Alert>
      )}
      <Button
        disabled={!token || pending || result === "success"}
        type="submit"
        variant="contained"
      >
        {pending ? t("submitting") : t("submit")}
      </Button>
      <Link component={NextLink} href={result === "success" ? "/login" : "/forgot-password"}>
        {t(result === "success" ? "signIn" : "requestNew")}
      </Link>
    </Stack>
  );
}
