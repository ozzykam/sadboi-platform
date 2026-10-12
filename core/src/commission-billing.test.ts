import { describe, expect, it } from "vitest";
const randomUUID = () => crypto.randomUUID();
import {
  applyCommissionBilling,
  commissionBillingCommandSchema,
  commissionBillingTotals,
  commissionInvoiceInputSchema,
  commissionInvoicePaid,
  commissionInvoiceStatus,
  type CommissionInvoice,
  type CommissionInvoiceInput,
} from "./commission-billing";
const now = "2026-10-05T12:00:00.000Z";
const input: CommissionInvoiceInput = {
  title: "Album deposit",
  kind: "deposit",
  description: "First installment",
  amountMinor: 27500,
  dueDate: "2026-10-10",
  paymentInstructions: "Use the agreed payment method.",
};
const cmd = (action: string, invoiceId: string, extra = {}) =>
  commissionBillingCommandSchema.parse({
    action,
    invoiceId,
    proposalId: "a".repeat(64),
    operationId: randomUUID(),
    expectedRevision: 0,
    note: "Test action",
    ...extra,
  });
const draft = () =>
  applyCommissionBilling([], cmd("save", randomUUID(), { input }), 55000, now);
const issue = (invoices: CommissionInvoice[]) =>
  applyCommissionBilling(
    invoices,
    cmd("issue", invoices[0].id),
    55000,
    now,
    "CI-000001",
  );
const payment = (
  invoiceId: string,
  amountMinor = 10000,
  reference = "BANK-123",
) =>
  cmd("recordPayment", invoiceId, {
    payment: {
      amountMinor,
      receivedDate: "2026-10-05",
      method: "bank_transfer",
      reference,
    },
  });
describe("commission billing", () => {
  it("validates exact positive cents, dates, bounded fields and strict commands", () => {
    for (const patch of [
      { amountMinor: 0 },
      { amountMinor: 1.5 },
      { amountMinor: 100_000_001 },
      { dueDate: "2026-02-30" },
      { kind: "refund" },
      { paid: true },
    ])
      expect(
        commissionInvoiceInputSchema.safeParse({ ...input, ...patch }).success,
      ).toBe(false);
    expect(
      commissionBillingCommandSchema.safeParse({
        ...cmd("save", randomUUID(), { input }),
        providerVerified: true,
      }).success,
    ).toBe(false);
  });
  it("reserves drafts and caps the final invoice to the unallocated signed total", () => {
    let rows = draft();
    expect(commissionBillingTotals(rows, 55000)).toMatchObject({
      allocatedMinor: 27500,
      unallocatedMinor: 27500,
      outstandingMinor: 0,
      remainingMinor: 55000,
    });
    expect(() =>
      applyCommissionBilling(
        rows,
        cmd("save", randomUUID(), { input: { ...input, amountMinor: 27501 } }),
        55000,
        now,
      ),
    ).toThrow(/exceed/);
    expect(() =>
      applyCommissionBilling(
        rows,
        cmd("save", randomUUID(), {
          input: { ...input, kind: "final", amountMinor: 20000 },
        }),
        55000,
        now,
      ),
    ).toThrow(/final invoice/);
    rows = applyCommissionBilling(
      rows,
      cmd("save", randomUUID(), { input: { ...input, kind: "final" } }),
      55000,
      now,
    );
    expect(commissionBillingTotals(rows, 55000).unallocatedMinor).toBe(0);
    rows = applyCommissionBilling(rows, cmd("void", rows[0].id), 55000, now);
    expect(() =>
      applyCommissionBilling(
        rows,
        cmd("issue", rows[1].id),
        55000,
        now,
        "CI-000002",
      ),
    ).toThrow(/unallocated/);
  });
  it("freezes issued amounts, keeps number and blocks issuing a past due draft", () => {
    const rows = issue(draft());
    expect(rows[0].number).toBe("CI-000001");
    expect(() =>
      applyCommissionBilling(
        rows,
        cmd("save", rows[0].id, { input }),
        55000,
        now,
      ),
    ).toThrow(/draft/);
    expect(() =>
      applyCommissionBilling(
        rows,
        cmd("issue", rows[0].id),
        55000,
        now,
        "CI-000002",
      ),
    ).toThrow(/draft/);
    const overdueDraft = draft();
    overdueDraft[0].input.dueDate = "2026-10-04";
    expect(() => issue(overdueDraft)).toThrow(/due date/);
  });
  it("records partial payments, prevents duplicates and overpayment, and derives paid/overdue", () => {
    let rows = issue(draft());
    rows = applyCommissionBilling(rows, payment(rows[0].id), 55000, now);
    expect(commissionInvoiceStatus(rows[0], "2026-10-05")).toBe(
      "partially_paid",
    );
    expect(commissionInvoiceStatus(rows[0], "2026-10-11")).toBe("overdue");
    expect(commissionBillingTotals(rows, 55000)).toMatchObject({
      paidMinor: 10000,
      outstandingMinor: 17500,
      remainingMinor: 45000,
    });
    expect(() =>
      applyCommissionBilling(
        rows,
        payment(rows[0].id, 100, "bank-123"),
        55000,
        now,
      ),
    ).toThrow(/already recorded/);
    expect(() =>
      applyCommissionBilling(
        rows,
        payment(rows[0].id, 17501, "BANK-456"),
        55000,
        now,
      ),
    ).toThrow(/exceeds/);
    rows = applyCommissionBilling(
      rows,
      payment(rows[0].id, 17500, "BANK-456"),
      55000,
      now,
    );
    expect(commissionInvoiceStatus(rows[0], "2026-10-11")).toBe("paid");
  });
  it("retains reversed evidence without mutating previous snapshots and only voids unpaid invoices", () => {
    const issued = issue(draft());
    const previous = applyCommissionBilling(
      issued,
      payment(issued[0].id),
      55000,
      now,
    );
    expect(() =>
      applyCommissionBilling(previous, cmd("void", previous[0].id), 55000, now),
    ).toThrow(/unpaid/);
    const reverse = cmd("reversePayment", previous[0].id, {
      paymentId: previous[0].payments[0].id,
    });
    const reversed = applyCommissionBilling(previous, reverse, 55000, now);
    expect(commissionInvoicePaid(reversed[0])).toBe(0);
    expect(previous[0].payments[0].reversedAt).toBeNull();
    expect(reversed[0].payments[0]).toMatchObject({
      reference: "BANK-123",
      reversedAt: now,
    });
    expect(() => applyCommissionBilling(reversed, reverse, 55000, now)).toThrow(
      /active payment/,
    );
    const voided = applyCommissionBilling(
      reversed,
      cmd("void", reversed[0].id),
      55000,
      now,
    );
    expect(voided[0].number).toBe("CI-000001");
    expect(commissionBillingTotals(voided, 55000).unallocatedMinor).toBe(55000);
    expect(() =>
      applyCommissionBilling(voided, payment(voided[0].id), 55000, now),
    ).toThrow(/issued/);
  });
  it("rejects unissued payments, future receipts and payment record limits", () => {
    const rows = draft();
    expect(() =>
      applyCommissionBilling(rows, payment(rows[0].id), 55000, now),
    ).toThrow(/issued/);
    const issued = issue(rows),
      future = payment(rows[0].id);
    if (future.action === "recordPayment")
      future.payment.receivedDate = "2026-10-06";
    expect(() => applyCommissionBilling(issued, future, 55000, now)).toThrow(
      /future/,
    );
    issued[0].payments = Array.from({ length: 20 }, () => ({
      id: randomUUID(),
      amountMinor: 1,
      receivedDate: "2026-10-05",
      method: "cash",
      reference: "Prior record",
      recordedAt: now,
      reversedAt: now,
    }));
    expect(() =>
      applyCommissionBilling(issued, payment(issued[0].id), 55000, now),
    ).toThrow(/20-payment/);
  });
});
