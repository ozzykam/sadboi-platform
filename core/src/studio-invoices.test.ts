import { describe, expect, it } from "vitest";
import {
  applyStudioInvoice,
  defaultInvoiceDefaults,
  invoiceIssueProblems,
  newStudioInvoice,
  studioInvoiceInputSchema,
  studioInvoiceTotals,
  studioInvoicePaid,
  studioInvoiceStatus,
  type StudioInvoiceCommand,
} from "./studio-invoices";

const invoiceId = "b80d4efa-8f9f-41c2-925b-a61768e79964",
  operationId = "1c81b0cf-f462-4be4-95fe-743f2e11a74f",
  now = "2026-11-05T14:00:00.000Z";
const input = () => ({
  ...newStudioInvoice(defaultInvoiceDefaults),
  title: "Flight of the Conchords",
  issuer: { name: "Sadboi", email: "studio@example.test", address: "" },
  billTo: {
    name: "Jermaine",
    email: "",
    address: "",
    confirmed: true,
    contactId: "",
  },
  lines: [
    { description: "Poster artwork", quantity: 1, unitMinor: 180000 },
    { description: "Tea towel artwork", quantity: 1, unitMinor: 50000 },
  ],
  taxStatus: "not_applicable" as const,
  taxNote: "Fictional test tax treatment",
  stripePaymentUrl: "https://buy.stripe.com/test_example",
});
const command = (
  action: "issue" | "void",
  expectedRevision: number,
): StudioInvoiceCommand => ({
  action,
  invoiceId,
  operationId,
  expectedRevision,
  note: "Test action",
});
const draft = () =>
  applyStudioInvoice(
    null,
    { ...command("issue", 0), action: "save", input: input() },
    now,
  );
const issued = () =>
  applyStudioInvoice(draft(), command("issue", 1), now, "INV-000001");
describe("standalone invoices", () => {
  it("keeps incomplete drafts but blocks unresolved tax, recipient and Stripe details on issue", () => {
    const initial = newStudioInvoice(defaultInvoiceDefaults);
    initial.billTo.name = "Provisional recipient";
    const saved = applyStudioInvoice(
      null,
      { ...command("issue", 0), action: "save", input: initial },
      now,
    );
    expect(saved.state).toBe("draft");
    expect(invoiceIssueProblems(initial)).toEqual(
      expect.arrayContaining([
        "Confirm the billing recipient.",
        "Resolve the tax treatment.",
        "Add the Stripe payment link.",
      ]),
    );
    expect(() =>
      applyStudioInvoice(saved, command("issue", 1), now, "INV-1"),
    ).toThrow("tax");
  });
  it("calculates cents, discounts and tax without turning unresolved tax into zero-tax approval", () => {
    expect(studioInvoiceTotals(input()).totalMinor).toBe(230000);
    expect(
      studioInvoiceTotals({
        ...input(),
        discountMinor: 10000,
        taxMinor: 22000,
        taxStatus: "calculated",
      }).totalMinor,
    ).toBe(242000);
    expect(
      studioInvoiceInputSchema.safeParse({ ...input(), discountMinor: 230001 })
        .success,
    ).toBe(false);
    expect(
      studioInvoiceInputSchema.safeParse({ ...input(), taxMinor: 1 }).success,
    ).toBe(false);
    expect(
      studioInvoiceInputSchema.safeParse({
        ...input(),
        lines: [
          { description: "Large", quantity: 10000, unitMinor: 100_000_000 },
        ],
      }).success,
    ).toBe(false);
  });
  it("issues a frozen snapshot with a UTC net-30 date across month boundaries", () => {
    const invoice = issued();
    expect(invoice.number).toBe("INV-000001");
    expect(invoice.dueDate).toBe("2026-12-05");
    expect(() =>
      applyStudioInvoice(
        invoice,
        { ...command("issue", 2), action: "save", input: input() },
        now,
      ),
    ).toThrow("draft");
    expect(() =>
      applyStudioInvoice(invoice, command("issue", 2), now, "INV-2"),
    ).toThrow("draft");
    expect(() => applyStudioInvoice(invoice, command("void", 1), now)).toThrow(
      "changed",
    );
    expect(
      applyStudioInvoice(
        draft(),
        command("issue", 1),
        "2028-02-01T00:00:00.000Z",
        "INV-2",
      ).dueDate,
    ).toBe("2028-03-02");
  });
  it("does not turn a reused usage template into accepted terms", () => {
    const start = newStudioInvoice({
      ...defaultInvoiceDefaults,
      usageTemplate: "Posters and tea towels only.",
    });
    expect(start.usage.status).toBe("proposed");
    expect(start.usage.acceptanceReference).toBe("");
    expect(
      studioInvoiceInputSchema.safeParse({
        ...input(),
        usage: { ...start.usage, status: "agreed" },
      }).success,
    ).toBe(false);
    expect(
      studioInvoiceInputSchema.safeParse({
        ...input(),
        usage: {
          status: "none",
          text: "Hidden restrictions",
          acceptanceReference: "",
        },
      }).success,
    ).toBe(false);
  });
  it("rejects unsafe and deceptive payment links", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://buy.stripe.com.evil.test/pay",
      "https://buy.stripe.com@evil.test/pay",
      "http://buy.stripe.com/pay",
      "https://user@buy.stripe.com/pay",
    ])
      expect(
        studioInvoiceInputSchema.safeParse({
          ...input(),
          stripePaymentUrl: url,
        }).success,
      ).toBe(false);
    expect(
      studioInvoiceInputSchema.safeParse({
        ...input(),
        stripePaymentUrl: "https://invoice.stripe.com/i/test",
      }).success,
    ).toBe(true);
  });
  it("tracks partial payments, rejects duplicates and overpayments, and preserves reversed evidence", () => {
    const original = issued();
    const pay: StudioInvoiceCommand = {
      ...command("issue", 2),
      action: "recordPayment",
      payment: {
        amountMinor: 50000,
        receivedDate: "2026-11-05",
        method: "stripe",
        reference: "pi_test",
      },
    };
    const partial = applyStudioInvoice(original, pay, now);
    expect(studioInvoicePaid(partial)).toBe(50000);
    expect(studioInvoiceStatus(partial, "2026-11-05")).toBe("partially paid");
    expect(studioInvoiceStatus(partial, "2026-12-06")).toBe("overdue");
    expect(() =>
      applyStudioInvoice(partial, { ...pay, expectedRevision: 3 }, now),
    ).toThrow("already recorded");
    expect(() =>
      applyStudioInvoice(
        original,
        { ...pay, payment: { ...pay.payment, amountMinor: 230001 } },
        now,
      ),
    ).toThrow("exceeds");
    expect(() =>
      applyStudioInvoice(
        original,
        { ...pay, payment: { ...pay.payment, receivedDate: "2099-01-01" } },
        now,
      ),
    ).toThrow("future");
    expect(() => applyStudioInvoice(partial, command("void", 3), now)).toThrow(
      "unpaid",
    );
    const reversed = applyStudioInvoice(
      partial,
      {
        ...command("issue", 3),
        action: "reversePayment",
        paymentId: operationId,
      },
      now,
    );
    expect(studioInvoicePaid(reversed)).toBe(0);
    expect(partial.payments[0].reversedAt).toBeNull();
    expect(applyStudioInvoice(reversed, command("void", 4), now).number).toBe(
      "INV-000001",
    );
    const paid = applyStudioInvoice(
      original,
      { ...pay, payment: { ...pay.payment, amountMinor: 230000 } },
      now,
    );
    expect(studioInvoiceStatus(paid, "2099-01-01")).toBe("paid");
  });
});
