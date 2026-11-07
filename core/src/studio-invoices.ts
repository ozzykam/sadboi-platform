import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(100_000_000);
const email = z.union([z.literal(""), z.email().max(254)]);
export const invoiceIssuerSchema = z
  .object({ name: text(200).min(1), email, address: text(1000) })
  .strict();
export const invoiceUsageSchema = z
  .object({
    status: z.enum(["none", "proposed", "agreed"]),
    text: text(6000),
    acceptanceReference: text(2000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status !== "none" && value.text.length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Enter the usage terms.",
      });
    if (value.status === "agreed" && value.acceptanceReference.length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["acceptanceReference"],
        message: "Record where and when the client accepted these terms.",
      });
    if (value.status === "none" && (value.text || value.acceptanceReference))
      ctx.addIssue({
        code: "custom",
        message:
          "Clear the usage text and acceptance reference, or select a usage status.",
      });
    if (value.status !== "agreed" && value.acceptanceReference)
      ctx.addIssue({
        code: "custom",
        message: "Only agreed terms can have an acceptance reference.",
      });
  });
const paymentFields = {
  dueDays: z.number().int().min(0).max(365),
  paymentMethod: z.enum(["stripe", "other"]),
  paymentInstructions: text(2000),
};
export const invoiceDefaultsSchema = z
  .object({
    issuer: invoiceIssuerSchema,
    ...paymentFields,
    notes: text(3000),
    usageTemplate: text(6000),
  })
  .strict();
export type InvoiceDefaults = z.infer<typeof invoiceDefaultsSchema>;
export const defaultInvoiceDefaults: InvoiceDefaults = {
  issuer: { name: "Sadboi Studio", email: "", address: "" },
  dueDays: 30,
  paymentMethod: "stripe",
  paymentInstructions:
    "Please pay via the Stripe payment link on this invoice.",
  notes: "",
  usageTemplate: "",
};
const stripeLink = text(2000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["buy.stripe.com", "invoice.stripe.com", "checkout.stripe.com"].includes(
        url.hostname,
      ) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}, "Use an HTTPS Stripe payment, invoice, or checkout link.");
export const studioInvoiceInputSchema = z
  .object({
    title: text(200).min(3),
    issuer: invoiceIssuerSchema,
    billTo: z
      .object({
        name: text(200).min(1),
        email,
        address: text(1000),
        confirmed: z.boolean(),
        contactId: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{64}$/)]),
      })
      .strict(),
    currency: z.literal("USD"),
    lines: z
      .array(
        z
          .object({
            description: text(500).min(1),
            quantity: z.number().int().min(1).max(10000),
            unitMinor: money,
          })
          .strict(),
      )
      .min(1)
      .max(30),
    discountMinor: money,
    taxStatus: z.enum(["unresolved", "not_applicable", "calculated"]),
    taxMinor: money,
    taxNote: text(2000),
    ...paymentFields,
    stripePaymentUrl: stripeLink,
    usage: invoiceUsageSchema,
    agreementReference: text(500),
    notes: text(3000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const subtotal = value.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitMinor,
      0,
    );
    if (
      subtotal > 100_000_000 ||
      subtotal - value.discountMinor + value.taxMinor > 100_000_000
    )
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Invoice amounts cannot exceed $1,000,000.",
      });
    if (value.discountMinor > subtotal)
      ctx.addIssue({
        code: "custom",
        path: ["discountMinor"],
        message: "Discount cannot exceed the subtotal.",
      });
    if (value.taxStatus !== "calculated" && value.taxMinor !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["taxMinor"],
        message: "Only calculated tax can include a tax amount.",
      });
    if (value.paymentMethod !== "stripe" && value.stripePaymentUrl)
      ctx.addIssue({
        code: "custom",
        path: ["stripePaymentUrl"],
        message: "Choose Stripe to include a Stripe payment link.",
      });
  });
export type StudioInvoiceInput = z.infer<typeof studioInvoiceInputSchema>;
export function newStudioInvoice(
  defaults: InvoiceDefaults,
): StudioInvoiceInput {
  return {
    title: "Custom artwork",
    issuer: { ...defaults.issuer },
    billTo: {
      name: "",
      email: "",
      address: "",
      contactId: "",
      confirmed: false,
    },
    currency: "USD",
    lines: [{ description: "Custom artwork", quantity: 1, unitMinor: 0 }],
    discountMinor: 0,
    taxStatus: "unresolved",
    taxMinor: 0,
    taxNote: "",
    dueDays: defaults.dueDays,
    paymentMethod: defaults.paymentMethod,
    paymentInstructions: defaults.paymentInstructions,
    stripePaymentUrl: "",
    usage: {
      status: defaults.usageTemplate ? "proposed" : "none",
      text: defaults.usageTemplate,
      acceptanceReference: "",
    },
    agreementReference: "",
    notes: defaults.notes,
  };
}
export const studioPaymentInputSchema = z
  .object({
    amountMinor: money.refine((n) => n > 0, "Enter a positive payment amount."),
    receivedDate: z.iso.date(),
    method: z.enum(["stripe", "bank_transfer", "cash", "check", "other"]),
    reference: text(500).min(3),
  })
  .strict();
export const studioInvoiceSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().min(1).max(200),
    input: studioInvoiceInputSchema,
    state: z.enum(["draft", "issued", "void"]),
    number: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    issuedAt: z.iso.datetime().nullable(),
    dueDate: z.iso.date().nullable(),
    payments: z
      .array(
        studioPaymentInputSchema
          .extend({
            id: z.uuid(),
            recordedAt: z.iso.datetime(),
            reversedAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export type StudioInvoice = z.infer<typeof studioInvoiceSchema>;
export const studioInvoiceTimeZone = "America/Chicago";
export function studioInvoiceNumber(
  lastDraftSavedAt: string,
  billToName: string,
  sequence: number,
) {
  if (
    !z.iso.datetime().safeParse(lastDraftSavedAt).success ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  )
    throw new Error("Invoice numbering needs a valid saved date and sequence.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: studioInvoiceTimeZone,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(lastDraftSavedAt));
  const date = ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("");
  const letters = billToName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}]/gu, "")
    .toUpperCase();
  const name = (Array.from(letters).slice(0, 3).join("") || "INV").padEnd(
    3,
    "X",
  );
  return `${date}-${name}-${String(sequence).padStart(3, "0")}`;
}
const commandFields = {
  invoiceId: z.uuid(),
  operationId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(199),
  note: text(2000).min(3),
};
export const studioInvoiceCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...commandFields,
      action: z.literal("save"),
      input: studioInvoiceInputSchema,
    })
    .strict(),
  z.object({ ...commandFields, action: z.literal("issue") }).strict(),
  z.object({ ...commandFields, action: z.literal("void") }).strict(),
  z
    .object({
      ...commandFields,
      action: z.literal("recordPayment"),
      payment: studioPaymentInputSchema,
    })
    .strict(),
  z
    .object({
      ...commandFields,
      action: z.literal("reversePayment"),
      paymentId: z.uuid(),
    })
    .strict(),
]);
export type StudioInvoiceCommand = z.infer<typeof studioInvoiceCommandSchema>;
export const invoiceDefaultsSaveSchema = z
  .object({
    operationId: z.uuid(),
    expectedRevision: z.number().int().min(0),
    input: invoiceDefaultsSchema,
  })
  .strict();
export function studioInvoiceTotals(input: StudioInvoiceInput) {
  const subtotalMinor = input.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitMinor,
    0,
  );
  return {
    subtotalMinor,
    totalMinor: subtotalMinor - input.discountMinor + input.taxMinor,
  };
}
export function studioInvoicePaid(invoice: StudioInvoice) {
  return invoice.payments.reduce(
    (sum, payment) => sum + (payment.reversedAt ? 0 : payment.amountMinor),
    0,
  );
}
export function studioInvoiceStatus(invoice: StudioInvoice, today: string) {
  if (invoice.state !== "issued") return invoice.state;
  const paid = studioInvoicePaid(invoice);
  if (paid === studioInvoiceTotals(invoice.input).totalMinor) return "paid";
  if (invoice.dueDate! < today) return "overdue";
  return paid ? "partially paid" : "unpaid";
}
export function invoiceIssueProblems(input: StudioInvoiceInput): string[] {
  const problems: string[] = [];
  if (!input.billTo.confirmed) problems.push("Confirm the billing recipient.");
  if (!input.issuer.email && !input.issuer.address)
    problems.push("Add a studio billing email or address.");
  if (input.taxStatus === "unresolved")
    problems.push("Resolve the tax treatment.");
  else if (input.taxNote.length < 3)
    problems.push("Explain the tax treatment.");
  if (studioInvoiceTotals(input).totalMinor <= 0)
    problems.push("The invoice total must be positive.");
  if (input.paymentInstructions.length < 3)
    problems.push("Add payment instructions.");
  if (input.paymentMethod === "stripe" && !input.stripePaymentUrl)
    problems.push("Add the Stripe payment link.");
  return problems;
}
export function applyStudioInvoice(
  old: StudioInvoice | null,
  command: StudioInvoiceCommand,
  now: string,
  issueNumber?: string,
): StudioInvoice {
  if ((old?.revision ?? 0) !== command.expectedRevision)
    throw new Error("Invoice changed. Reload before continuing.");
  if (old && old.id !== command.invoiceId)
    throw new Error("Invoice reference does not match.");
  if ((old?.revision ?? 0) >= 200)
    throw new Error("The invoice history limit has been reached.");
  if (command.action === "save") {
    if (old && old.state !== "draft")
      throw new Error("Only draft invoices can be edited.");
    return studioInvoiceSchema.parse({
      id: command.invoiceId,
      revision: (old?.revision ?? 0) + 1,
      input: command.input,
      state: "draft",
      number: null,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      issuedAt: null,
      dueDate: null,
      payments: [],
    });
  }
  if (!old) throw new Error("Save a draft first.");
  const next = structuredClone(old);
  next.revision++;
  next.updatedAt = now;
  const paid = studioInvoicePaid(old);
  if (command.action === "issue") {
    if (old.state !== "draft")
      throw new Error("Only draft invoices can be issued.");
    const problems = invoiceIssueProblems(old.input);
    if (problems.length) throw new Error(problems.join(" "));
    if (!issueNumber) throw new Error("Invoice numbering is required.");
    const due = new Date(now.slice(0, 10) + "T00:00:00.000Z");
    due.setUTCDate(due.getUTCDate() + old.input.dueDays);
    next.state = "issued";
    next.number = issueNumber;
    next.issuedAt = now;
    next.dueDate = due.toISOString().slice(0, 10);
  }
  if (command.action === "void") {
    if (old.state === "void" || paid !== 0)
      throw new Error(
        "Only an unpaid invoice or draft can be voided. Resolve payment records first.",
      );
    next.state = "void";
  }
  if (command.action === "recordPayment") {
    if (old.state !== "issued")
      throw new Error("Issue the invoice before recording payment.");
    if (command.payment.receivedDate > now.slice(0, 10))
      throw new Error("Payment cannot have a future date.");
    if (
      command.payment.amountMinor >
      studioInvoiceTotals(old.input).totalMinor - paid
    )
      throw new Error("Payment exceeds the outstanding balance.");
    if (old.payments.length >= 50)
      throw new Error("The 50-payment history limit has been reached.");
    if (
      old.payments.some(
        (p) =>
          !p.reversedAt &&
          p.method === command.payment.method &&
          p.reference.toLowerCase() === command.payment.reference.toLowerCase(),
      )
    )
      throw new Error("That payment reference is already recorded.");
    next.payments.push({
      ...command.payment,
      id: command.operationId,
      recordedAt: now,
      reversedAt: null,
    });
  }
  if (command.action === "reversePayment") {
    const payment = next.payments.find((p) => p.id === command.paymentId);
    if (old.state !== "issued" || !payment || payment.reversedAt)
      throw new Error("Choose an active payment record to reverse.");
    payment.reversedAt = now;
  }
  return studioInvoiceSchema.parse(next);
}
