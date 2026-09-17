"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const t = useTranslations("storefront.forgotPassword");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"accepted" | "rateLimited" | "error" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/auth/customer/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier: form.get("identifier") }),
      });
      setResult(response.ok ? "accepted" : response.status === 429 ? "rateLimited" : "error");
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
      <TextField autoComplete="username" label={t("identifier")} name="identifier" required />
      {result && (
        <Alert role="status" severity={result === "accepted" ? "success" : "error"}>
          {t(result)}
        </Alert>
      )}
      <Button disabled={pending || result === "accepted"} type="submit" variant="contained">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </Stack>
  );
}
