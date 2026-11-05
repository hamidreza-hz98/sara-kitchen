"use client";

import { PasswordField } from "@/components/ui/password-field";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";
import { useMemo, useState, type FormEvent } from "react";

import { Link as LocalizedLink, useRouter } from "@/locales/navigation";
import { storeCustomerMobileVerification } from "@/lib/customer-mobile-verification";
import { parseCustomerMobile } from "@/validations/customer-identity";

type Result = "accepted" | "validationError" | "rateLimited" | "networkError" | null;

export function CustomerSignupForm() {
  const t = useTranslations("storefront.signup");
  const router = useRouter();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [country, setCountry] = useState<CountryCode>("PT");
  const [mobile, setMobile] = useState("");
  const [mobileInvalid, setMobileInvalid] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const countryOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return getCountries()
      .map((countryCode) => ({
        code: countryCode,
        name: displayNames.of(countryCode) ?? countryCode,
        callingCode: getCountryCallingCode(countryCode),
      }))
      .sort((first, second) => first.name.localeCompare(second.name, locale));
  }, [locale]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setPasswordMismatch(true);
      return;
    }
    const normalizedMobile = parseCustomerMobile(mobile, country);
    if (!normalizedMobile) {
      setMobileInvalid(true);
      return;
    }

    setPending(true);
    setResult(null);
    setMobileInvalid(false);
    try {
      const response = await fetch("/api/auth/customer/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          mobile: normalizedMobile,
          email: form.get("email"),
          password: form.get("password"),
          termsAccepted: form.has("termsAccepted"),
          marketingConsent: form.has("marketingConsent"),
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: {
            mobileVerification?: {
              challengeToken?: unknown;
              developmentCode?: unknown;
            };
          };
        };
        const verification = payload.data?.mobileVerification;
        if (
          typeof verification?.challengeToken === "string" &&
          /^[A-Za-z0-9_-]{43}$/u.test(verification.challengeToken)
        ) {
          const developmentCode =
            process.env.NODE_ENV === "development" &&
            typeof verification.developmentCode === "string" &&
            /^\d{6}$/u.test(verification.developmentCode)
              ? verification.developmentCode
              : undefined;
          storeCustomerMobileVerification({
            challengeToken: verification.challengeToken,
            ...(developmentCode ? { developmentCode } : {}),
          });
          router.push("/verify-mobile");
          return;
        }
      }
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
      <Stack direction="row" spacing={2}>
        <FormControl sx={{ flex: "0 0 42%", minWidth: 0 }}>
          <InputLabel id="signup-country-label">{t("country")}</InputLabel>
          <Select<CountryCode>
            labelId="signup-country-label"
            id="signup-country"
            label={t("country")}
            onChange={(event) => {
              setCountry(event.target.value as CountryCode);
              setMobileInvalid(false);
            }}
            renderValue={(selected) => `${selected} (+${getCountryCallingCode(selected)})`}
            value={country}
          >
            {countryOptions.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {option.name} (+{option.callingCode})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          autoComplete="tel-national"
          error={mobileInvalid}
          fullWidth
          helperText={mobileInvalid ? t("invalidMobile") : undefined}
          label={t("mobile")}
          name="mobile"
          onChange={(event) => {
            setMobile(event.target.value);
            setMobileInvalid(false);
          }}
          required
          sx={{ flex: "1 1 auto", minWidth: 0 }}
          type="tel"
          value={mobile}
        />
      </Stack>
      <TextField autoComplete="email" label={t("email")} name="email" type="email" />
      <PasswordField
        autoComplete="new-password"
        helperText={t("passwordHint")}
        label={t("password")}
        name="password"
        onChange={() => setPasswordMismatch(false)}
        slotProps={{ htmlInput: { minLength: 8 } }}
        required
      />
      <PasswordField
        autoComplete="new-password"
        error={passwordMismatch}
        helperText={passwordMismatch ? t("passwordMismatch") : undefined}
        label={t("confirmPassword")}
        name="confirmPassword"
        onChange={() => setPasswordMismatch(false)}
        slotProps={{ htmlInput: { minLength: 8 } }}
        required
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
      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center" }}>
        <Typography color="text.secondary" variant="body2">
          {t("existingCustomer")}
        </Typography>
        <Link component={LocalizedLink} href="/login" variant="body2">
          {t("loginLink")}
        </Link>
      </Stack>
    </Stack>
  );
}
