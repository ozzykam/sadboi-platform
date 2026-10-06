import { describe, expect, it } from "vitest";
import {
  agreementInputSchema,
  agreementTransition,
  agreementAccessSchema,
  assertSigningDate,
} from "./agreements";

const input = {
  title: "Commission agreement",
  body: "The studio will create the approved artwork described in the accepted proposal.",
  effectiveDate: "2026-10-05",
  expiresDate: "",
  currency: "USD" as const,
  totalMinor: 125000,
};

describe("agreements", () => {
  it("validates dated agreement terms and rejects an inverted expiry", () => {
    expect(agreementInputSchema.safeParse(input).success).toBe(true);
    expect(
      agreementInputSchema.safeParse({ ...input, expiresDate: "2026-10-04" })
        .success,
    ).toBe(false);
    expect(
      agreementInputSchema.safeParse({ ...input, body: "too short" }).success,
    ).toBe(false);
  });

  it("keeps signing behind an explicit invitation and prevents edits after signing", () => {
    expect(agreementTransition(null, "save")).toBe("draft");
    expect(agreementTransition("draft", "invite")).toBe("invited");
    expect(agreementTransition("invited", "recordSignature")).toBe("signed");
    expect(agreementTransition("signed", "void")).toBe("voided");
    expect(() => agreementTransition("signed", "save")).toThrow();
    expect(() => agreementTransition("draft", "recordSignature")).toThrow();
    expect(agreementTransition("invited", "invite")).toBe("invited");
    expect(agreementTransition("invited", "reopen")).toBe("draft");
    expect(() => agreementTransition("signed", "reopen")).toThrow();
    expect(() => agreementTransition("voided", "invite")).toThrow();
  });
  it("requires document identity, explicit consent and a real signature date", () => {
    const command = {
      action: "sign",
      proposalId: "a".repeat(64),
      token: "b".repeat(64),
      operationId: "123e4567-e89b-42d3-a456-426614174000",
      expectedRevision: 2,
      documentHash: "c".repeat(64),
      signerName: "Test Client",
      signedDate: "2026-10-05",
      consent: true,
    };
    expect(agreementAccessSchema.safeParse(command).success).toBe(true);
    for (const patch of [
      { consent: false },
      { consent: undefined },
      { documentHash: "" },
      { signedDate: "2026-02-30" },
      { token: "guess" },
      { input: {} },
    ])
      expect(
        agreementAccessSchema.safeParse({ ...command, ...patch }).success,
      ).toBe(false);
    expect(() => assertSigningDate("2099-01-01", "2026-10-05")).toThrow();
    expect(() => assertSigningDate("2026-10-05", "2026-10-05")).not.toThrow();
  });
});
