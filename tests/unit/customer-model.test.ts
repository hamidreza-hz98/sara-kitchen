import argon2 from "argon2";
import { Mongoose } from "mongoose";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCustomerModel } from "@/server/modules/customers/model/customer";
import { hashCustomerPassword } from "@/server/modules/customers/service/password";
import {
  normalizeCustomerEmail,
  normalizeCustomerMobile,
} from "@/server/modules/customers/validation/customer-identity";

describe("customer model", () => {
  const client = new Mongoose();
  const Customer = getCustomerModel(client.connection);
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashCustomerPassword("A strong customer passphrase 2026");
  });

  it("normalizes Portuguese, international and localized-digit mobile inputs", () => {
    expect(normalizeCustomerMobile("912 345 678")).toBe("+351912345678");
    expect(normalizeCustomerMobile("00351 912-345-678")).toBe("+351912345678");
    expect(normalizeCustomerMobile("+351 (912) 345 678")).toBe("+351912345678");
    expect(normalizeCustomerMobile("۹۱۲ ۳۴۵ ۶۷۸")).toBe("+351912345678");
    expect(normalizeCustomerMobile("+44 7700 900123")).toBe("+447700900123");
    expect(normalizeCustomerEmail("  SARA@EXAMPLE.COM ")).toBe("sara@example.com");
    expect(normalizeCustomerEmail("  ")).toBeNull();
  });

  it("accepts Persian and Portuguese names and supplies safe defaults", async () => {
    const customer = new Customer({
      firstName: "  فاطمه  ",
      lastName: "  João   da Silva ",
      mobile: "912 345 678",
      passwordHash,
    });
    await expect(customer.validate()).resolves.toBeUndefined();
    expect(customer.firstName).toBe("فاطمه");
    expect(customer.lastName).toBe("João da Silva");
    expect(customer.mobile).toBe("+351912345678");
    expect(customer.email).toBeNull();
    expect(customer.status).toBe("active");
    expect(customer.mobileVerifiedAt).toBeNull();
    expect(customer.emailVerifiedAt).toBeNull();
    expect(customer.marketingConsent).toBe(false);
    expect(customer.marketingConsentAt).toBeNull();
    expect(customer.passwordVersion).toBe(1);
    expect(Customer.schema.options.timestamps).toBe(true);
  });

  it("rejects invalid names, contacts, hash, status and version", async () => {
    const customer = new Customer({
      firstName: "<script>",
      lastName: " ",
      mobile: "12345",
      email: "bad@@example.com",
      passwordHash: "plaintext",
      status: "unknown",
      passwordVersion: 0,
    });
    const error = (await customer.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining([
        "firstName",
        "lastName",
        "mobile",
        "email",
        "passwordHash",
        "status",
        "passwordVersion",
      ]),
    );
  });

  it("requires coherent verification and marketing-consent state", async () => {
    const customer = new Customer({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      passwordHash,
      emailVerifiedAt: new Date(),
      marketingConsent: true,
    });
    const error = (await customer.validate().catch((cause: unknown) => cause)) as Error & {
      errors?: Record<string, unknown>;
    };
    expect(Object.keys(error.errors ?? {})).toEqual(
      expect.arrayContaining(["emailVerifiedAt", "marketingConsentAt"]),
    );
    customer.email = "SARA@EXAMPLE.COM";
    customer.marketingConsentAt = new Date();
    await expect(customer.validate()).resolves.toBeUndefined();
    expect(customer.email).toBe("sara@example.com");
  });

  it("uses Argon2id and never serializes credential internals", async () => {
    expect(passwordHash).toMatch(/^\$argon2id\$/u);
    expect(await argon2.verify(passwordHash, "A strong customer passphrase 2026")).toBe(true);
    const customer = new Customer({
      firstName: "Sara",
      lastName: "Kazemi",
      mobile: "912345678",
      passwordHash,
    });
    await customer.validate();
    const json = customer.toJSON() as Record<string, unknown>;
    expect(json.passwordHash).toBeUndefined();
    expect(json.passwordVersion).toBeUndefined();
    expect(json.id).toBe(customer._id.toHexString());
    expect(Customer.schema.path("passwordHash").options.select).toBe(false);
  });

  it("defines mobile and optional-email unique indexes across statuses", () => {
    expect(Customer.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ mobile: 1 }, expect.objectContaining({ unique: true })],
        [
          { email: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { email: { $type: "string" } },
          }),
        ],
      ]),
    );
  });
});
