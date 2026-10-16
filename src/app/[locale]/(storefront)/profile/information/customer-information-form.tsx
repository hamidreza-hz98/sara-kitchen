"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import type { SupportedLocale } from "@/constants";
import { broadcastCustomerAuthChange } from "@/lib/customer-auth-sync";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { saveBrowserLocalePreference } from "@/locales/client-preference";
import { useRouter } from "@/locales/navigation";
import { customerInformationSchema } from "@/validations/customer-information";

export type CustomerInformation = Readonly<{
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  mobileVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  marketingConsent: boolean;
}>;

type Draft = {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  language: SupportedLocale;
  marketingConsent: boolean;
};
type Field = "firstName" | "lastName" | "mobile" | "email" | "language";
type Result = "saved" | "identitySaved" | "conflict" | "expired" | "validation" | "error";
const invalidKeys = {
  firstName: "firstNameInvalid",
  lastName: "lastNameInvalid",
  mobile: "mobileInvalid",
  email: "emailInvalid",
  language: "languageInvalid",
} as const;

function toDraft(customer: CustomerInformation, language: SupportedLocale): Draft {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    mobile: customer.mobile,
    email: customer.email ?? "",
    language,
    marketingConsent: customer.marketingConsent,
  };
}

export function CustomerInformationForm({
  initial,
  locale,
}: Readonly<{ initial: CustomerInformation; locale: SupportedLocale }>) {
  const t = useTranslations("profile.informationForm");
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [savedLocale, setSavedLocale] = useState(locale);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, locale));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved, savedLocale));

  function change<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !dirty) return;
    const parsed = customerInformationSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in invalidKeys) {
          next[field as Field] = t(invalidKeys[field as Field]);
        }
      }
      setErrors(next);
      setResult("validation");
      return;
    }
    const value = parsed.data;
    const identityChanged = value.mobile !== saved.mobile || value.email !== saved.email;
    const profileChanged =
      value.firstName !== saved.firstName ||
      value.lastName !== saved.lastName ||
      identityChanged ||
      value.marketingConsent !== saved.marketingConsent;
    setPending(true);
    setResult(null);
    try {
      let next = saved;
      if (profileChanged) {
        const response = await fetch("/api/profile", {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: await csrfJsonHeaders("customer"),
          body: JSON.stringify({
            firstName: value.firstName,
            lastName: value.lastName,
            mobile: value.mobile,
            email: value.email,
            marketingConsent: value.marketingConsent,
          }),
        });
        if (!response.ok) {
          setResult(
            response.status === 409
              ? "conflict"
              : response.status === 401
                ? "expired"
                : response.status === 400
                  ? "validation"
                  : "error",
          );
          return;
        }
        const body = (await response.json()) as { data?: CustomerInformation };
        if (!body.data || typeof body.data.firstName !== "string")
          throw new Error("Invalid profile response");
        next = body.data;
        setSaved(next);
        broadcastCustomerAuthChange();
      }
      setDraft(toDraft(next, value.language as SupportedLocale));
      setSavedLocale(value.language as SupportedLocale);
      setErrors({});
      setResult(identityChanged ? "identitySaved" : "saved");
      if (value.language !== locale) {
        saveBrowserLocalePreference(value.language as SupportedLocale);
        window.location.reload();
      } else if (profileChanged) {
        router.refresh();
      }
    } catch {
      setResult("error");
    } finally {
      setPending(false);
    }
  }

  const cardSx = {
    p: { xs: 3, sm: 5 },
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 4,
  } as const;
  return (
    <Stack spacing={3} sx={{ maxWidth: 850 }}>
      <Box>
        <Typography component="h1" variant="h2">
          {t("title")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("intro")}
        </Typography>
      </Box>
      <Paper
        component="form"
        elevation={0}
        noValidate
        onSubmit={(event) => {
          submit(event).catch(() => setResult("error"));
        }}
        sx={cardSx}
      >
        <Stack spacing={3}>
          <Typography component="h2" variant="h5">
            {t("personalDetails")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <TextField
              autoComplete="given-name"
              error={Boolean(errors.firstName)}
              helperText={errors.firstName}
              label={t("firstName")}
              required
              value={draft.firstName}
              onChange={(event) => change("firstName", event.target.value)}
            />
            <TextField
              autoComplete="family-name"
              error={Boolean(errors.lastName)}
              helperText={errors.lastName}
              label={t("lastName")}
              required
              value={draft.lastName}
              onChange={(event) => change("lastName", event.target.value)}
            />
            <TextField
              autoComplete="tel"
              error={Boolean(errors.mobile)}
              helperText={errors.mobile ?? t("mobileHint")}
              label={t("mobile")}
              required
              type="tel"
              value={draft.mobile}
              onChange={(event) => change("mobile", event.target.value)}
            />
            <TextField
              autoComplete="email"
              error={Boolean(errors.email)}
              helperText={errors.email ?? t("emailHint")}
              label={t("email")}
              type="email"
              value={draft.email}
              onChange={(event) => change("email", event.target.value)}
            />
          </Box>
          <Alert severity="info" variant="outlined">
            {t("verificationNotice")}
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>
            <Typography color="text.secondary">
              {t("mobileStatus")}: {saved.mobileVerifiedAt ? t("verified") : t("unverified")}
            </Typography>
            {saved.email && (
              <Typography color="text.secondary">
                {t("emailStatus")}: {saved.emailVerifiedAt ? t("verified") : t("unverified")}
              </Typography>
            )}
          </Stack>
          <TextField
            select
            error={Boolean(errors.language)}
            helperText={errors.language ?? t("languageHint")}
            label={t("language")}
            value={draft.language}
            onChange={(event) => change("language", event.target.value as SupportedLocale)}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="pt-PT">Português</MenuItem>
            <MenuItem value="fa">فارسی</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.marketingConsent}
                onChange={(event) => change("marketingConsent", event.target.checked)}
              />
            }
            label={t("marketingConsent")}
          />
          {result && (
            <Alert
              role="status"
              severity={result === "saved" || result === "identitySaved" ? "success" : "error"}
            >
              {t(result)}
            </Alert>
          )}
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button
              disabled={pending || !dirty}
              onClick={() => {
                setDraft(toDraft(saved, savedLocale));
                setErrors({});
                setResult(null);
              }}
            >
              {t("discard")}
            </Button>
            <Button disabled={pending || !dirty} type="submit" variant="contained">
              {pending ? t("saving") : t("save")}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
