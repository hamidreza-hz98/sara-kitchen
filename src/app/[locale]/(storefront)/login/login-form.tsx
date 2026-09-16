"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import TextField from "@mui/material/TextField";

import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";
import { useRouter } from "@/locales/navigation";

export function CustomerLoginForm() {
  const t = useTranslations("storefront.login");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"invalid" | "network" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/customer/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          identifier: form.get("identifier"),
          password: form.get("password"),
          persistent: form.has("persistent"),
        }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "invalid" : "network");
        return;
      }
      broadcastCustomerAuthChange();
      router.replace("/profile");
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(event) => {
        submit(event).catch(() => setError("network"));
      }}
    >
      <TextField autoComplete="username" label={t("identifier")} name="identifier" required />
      <TextField
        autoComplete="current-password"
        label={t("password")}
        name="password"
        required
        type="password"
      />
      <FormControlLabel control={<Checkbox name="persistent" />} label={t("persistent")} />
      {error && (
        <Alert role="alert" severity="error">
          {t(error)}
        </Alert>
      )}
      <Button disabled={pending} type="submit" variant="contained">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </Stack>
  );
}
