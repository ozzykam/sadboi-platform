import { z } from "zod";
import { inventoryId } from "./inventory";
import { proposalInputSchema } from "./proposals";

const text = (max: number) => z.string().trim().max(max);
const amount = z.number().int().min(1).max(100_000_000);
export const commissionInvoiceInputSchema = z
  .object({
    title: text(180).min(3),
    kind: z.enum(["deposit", "milestone", "final"]),
    description: text(2000).min(3),
    amountMinor: amount,
    dueDate: z.iso.date(),
    paymentInstructions: text(2000).min(3),
  })
  .strict();
export type CommissionInvoiceInput = z.infer<
  typeof commissionInvoiceInputSchema
>;
export const commissionReceiptInputSchema = z
  .object({
    amountMinor: amount,
    receivedDate: z.iso.date(),
    method: z.enum(["bank_transfer", "cash", "check", "other"]),
    reference: text(500).min(3),
  })
  .strict();
const fields = {
  proposalId: inventoryId,
  invoiceId: z.uuid(),
  operationId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(199),
  note: text(2000).min(3),
};
export const commissionBillingCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...fields,
      action: z.literal("save"),
      input: commissionInvoiceInputSchema,
    })
    .strict(),
  z.object({ ...fields, action: z.literal("issue") }).strict(),
  z.object({ ...fields, action: z.literal("void") }).strict(),
  z
    .object({
      ...fields,
      action: z.literal("recordPayment"),
      payment: commissionReceiptInputSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      action: z.literal("reversePayment"),
      paymentId: z.uuid(),
    })
    .strict(),
]);
export type CommissionBillingCommand = z.infer<
  typeof commissionBillingCommandSchema
>;
export const commissionInvoiceSchema = z
  .object({
    id: z.uuid(),
    input: commissionInvoiceInputSchema,
    number: z.string().nullable(),
    state: z.enum(["draft", "issued", "void"]),
    issuedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime(),
    payments: z
      .array(
        commissionReceiptInputSchema
          .extend({
            id: z.uuid(),
            recordedAt: z.iso.datetime(),
            reversedAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type CommissionInvoice = z.infer<typeof commissionInvoiceSchema>;
export const commissionBillingSourceSchema = z
  .object({
    title: z.string(),
    client: z
      .object({ id: inventoryId, name: z.string(), email: z.string() })
      .strict(),
    proposalNumber: z.string(),
    proposalVersion: z.number().int().positive(),
    proposal: proposalInputSchema,
    agreementHash: z.string().regex(/^[a-f0-9]{64}$/),
    signedAt: z.iso.datetime(),
    totalMinor: amount,
  })
  .strict();
export const commissionBillingRecordSchema = z
  .object({
    businessId: z.string(),
    revision: z.number().int().min(1).max(200),
    source: commissionBillingSourceSchema,
    invoices: z.array(commissionInvoiceSchema).min(1).max(20),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type CommissionBillingRecord = z.infer<
  typeof commissionBillingRecordSchema
>;
export function commissionInvoicePaid(invoice: CommissionInvoice) {
  return invoice.payments.reduce(
    (sum, payment) => sum + (payment.reversedAt ? 0 : payment.amountMinor),
    0,
  );
}
export function commissionInvoiceStatus(
  invoice: CommissionInvoice,
  today: string,
) {
  if (invoice.state !== "issued") return invoice.state;
  const paid = commissionInvoicePaid(invoice);
  if (paid === invoice.input.amountMinor) return "paid";
  if (invoice.input.dueDate < today) return "overdue";
  return paid > 0 ? "partially_paid" : "unpaid";
}
export function commissionBillingTotals(
  invoices: CommissionInvoice[],
  agreementTotalMinor: number,
) {
  const active = invoices.filter((invoice) => invoice.state !== "void");
  const allocatedMinor = active.reduce(
    (sum, invoice) => sum + invoice.input.amountMinor,
    0,
  );
  const invoicedMinor = active
    .filter((invoice) => invoice.state === "issued")
    .reduce((sum, invoice) => sum + invoice.input.amountMinor, 0);
  const paidMinor = active.reduce(
    (sum, invoice) => sum + commissionInvoicePaid(invoice),
    0,
  );
  return {
    allocatedMinor,
    invoicedMinor,
    paidMinor,
    unallocatedMinor: agreementTotalMinor - allocatedMinor,
    outstandingMinor: invoicedMinor - paidMinor,
    remainingMinor: agreementTotalMinor - paidMinor,
  };
}
export function applyCommissionBilling(
  invoices: CommissionInvoice[],
  command: CommissionBillingCommand,
  agreementTotalMinor: number,
  now: string,
  issueNumber?: string,
): CommissionInvoice[] {
  const old = invoices.find((invoice) => invoice.id === command.invoiceId);
  let next: CommissionInvoice;
  if (command.action === "save") {
    if (old && old.state !== "draft")
      throw new Error("Only draft invoices can be edited.");
    if (!old && invoices.length >= 20)
      throw new Error(
        "The 20-invoice limit has been reached, including void invoices.",
      );
    const others = invoices.filter(
      (invoice) => invoice.id !== command.invoiceId && invoice.state !== "void",
    );
    const available =
      agreementTotalMinor -
      others.reduce((sum, invoice) => sum + invoice.input.amountMinor, 0);
    if (command.input.amountMinor > available)
      throw new Error(
        "Invoices and reserved drafts cannot exceed the signed agreement total.",
      );
    if (
      command.input.kind === "final" &&
      (command.input.amountMinor !== available ||
        others.some((invoice) => invoice.input.kind === "final"))
    )
      throw new Error(
        "The final invoice must cover the unallocated agreement balance.",
      );
    next = {
      id: command.invoiceId,
      input: command.input,
      number: null,
      state: "draft",
      issuedAt: null,
      updatedAt: now,
      payments: [],
    };
  } else {
    if (!old) throw new Error("Save an invoice draft first.");
    next = {
      ...old,
      payments: old.payments.map((payment) => ({ ...payment })),
      updatedAt: now,
    };
    const paid = commissionInvoicePaid(old);
    if (command.action === "issue") {
      if (old.state !== "draft")
        throw new Error("Only a draft invoice can be issued.");
      if (old.input.dueDate < now.slice(0, 10))
        throw new Error("Choose a current or future due date before issuing.");
      if (!issueNumber) throw new Error("An invoice number is required.");
      if (
        old.input.kind === "final" &&
        commissionBillingTotals(invoices, agreementTotalMinor)
          .unallocatedMinor !== 0
      )
        throw new Error(
          "Update the final invoice to include the unallocated balance before issuing.",
        );
      next = { ...next, state: "issued", number: issueNumber, issuedAt: now };
    }
    if (command.action === "void") {
      if (old.state === "void" || paid !== 0)
        throw new Error(
          "Only an unpaid invoice or draft can be voided. Resolve recorded payments first.",
        );
      next.state = "void";
    }
    if (command.action === "recordPayment") {
      if (old.state !== "issued")
        throw new Error(
          "Payments can only be recorded against issued invoices.",
        );
      if (command.payment.receivedDate > now.slice(0, 10))
        throw new Error("A received payment cannot have a future date.");
      if (command.payment.amountMinor > old.input.amountMinor - paid)
        throw new Error(
          "The payment exceeds this invoice's outstanding balance.",
        );
      if (old.payments.length >= 20)
        throw new Error(
          "The 20-payment record limit has been reached for this invoice.",
        );
      if (
        invoices.some((invoice) =>
          invoice.payments.some(
            (payment) =>
              !payment.reversedAt &&
              payment.method === command.payment.method &&
              payment.reference.toLowerCase() ===
                command.payment.reference.toLowerCase(),
          ),
        )
      )
        throw new Error(
          "That payment reference is already recorded. Use a distinct allocation reference for a split payment.",
        );
      next.payments.push({
        ...command.payment,
        id: command.operationId,
        recordedAt: now,
        reversedAt: null,
      });
    }
    if (command.action === "reversePayment") {
      const payment = next.payments.find(
        (payment) => payment.id === command.paymentId,
      );
      if (old.state !== "issued" || !payment || payment.reversedAt)
        throw new Error("Choose an active payment record to reverse.");
      payment.reversedAt = now;
    }
  }
  return old
    ? invoices.map((invoice) => (invoice.id === old.id ? next : invoice))
    : [...invoices, next];
}
