"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

type Result = "accepted" | "validationError" | "rateLimited" | "networkError" | null;

export function CustomerSignupForm() {
  const t = useTranslations("storefront.signup");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/auth/customer/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          mobile: form.get("mobile"),
          email: form.get("email"),
          password: form.get("password"),
          termsAccepted: form.has("termsAccepted"),
          marketingConsent: form.has("marketingConsent"),
        }),
      });
      setResult(
        response.ok
          ? "accepted"
          : response.status === 400
            ? "validationError"
            : response.status === 429
              ? "rateLimited"
              : "networkError",
      );
    } catch {
      setResult("networkError");
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack
      component="form"
      spacing={3}
      onSubmit={(event) => {
        submit(event).catch(() => setResult("networkError"));
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          autoComplete="given-name"
          fullWidth
          label={t("firstName")}
          name="firstName"
          required
        />
        <TextField
          autoComplete="family-name"
          fullWidth
          label={t("lastName")}
          name="lastName"
          required
        />
      </Stack>
      <TextField autoComplete="tel" label={t("mobile")} name="mobile" required type="tel" />
      <TextField autoComplete="email" label={t("email")} name="email" type="email" />
      <TextField
        autoComplete="new-password"
        helperText={t("passwordHint")}
        slotProps={{ htmlInput: { minLength: 15 } }}
        label={t("password")}
        name="password"
        required
        type="password"
      />
      <FormControlLabel control={<Checkbox name="termsAccepted" required />} label={t("terms")} />
      <FormControlLabel control={<Checkbox name="marketingConsent" />} label={t("marketing")} />
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
