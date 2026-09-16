"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { useRouter } from "@/locales/navigation";

export function AdminLoginForm() {
  const auth = useTranslations("dashboard.auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"invalid" | "network" | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
        }),
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError(response.status === 401 ? "invalid" : "network");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  };

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(event) => {
        submit(event).catch(() => setError("network"));
      }}
    >
      <TextField autoComplete="username" label={auth("identifier")} name="identifier" required />
      <TextField
        autoComplete="current-password"
        label={auth("password")}
        name="password"
        required
        type="password"
      />
      {error && (
        <Alert severity="error" role="alert">
          {auth(error === "invalid" ? "invalid" : "network")}
        </Alert>
      )}
      <Button disabled={pending} type="submit" variant="contained">
        {pending ? auth("signingIn") : auth("signIn")}
      </Button>
    </Stack>
  );
}
