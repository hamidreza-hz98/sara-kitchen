import { describe, expect, it } from "vitest";

import { customerInformationSchema } from "@/validations/customer-information";

const valid = {
  firstName: " Sara ",
  lastName: " Kazemi ",
  mobile: "۹۲۳۴۵۶۷۸۹",
  email: " SARA@EXAMPLE.COM ",
  language: "fa",
  marketingConsent: false,
} as const;

describe("customer information validation", () => {
  it("normalizes multilingual identity input without persisting language as account data", () => {
    expect(customerInformationSchema.parse(valid)).toEqual({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "+351923456789",
      email: "sara@example.com",
      language: "fa",
      marketingConsent: false,
    });
    expect(customerInformationSchema.parse({ ...valid, email: "" }).email).toBeNull();
  });

  it("rejects malformed contact values and unsupported locales", () => {
    expect(
      customerInformationSchema.safeParse({ ...valid, mobile: "123", language: "de" }).success,
    ).toBe(false);
    expect(customerInformationSchema.safeParse({ ...valid, email: "bad@" }).success).toBe(false);
  });
});
