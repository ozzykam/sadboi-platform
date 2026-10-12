import "server-only";
import { createHash } from "node:crypto";
import {
  applyCommissionBilling,
  commissionBillingCommandSchema,
  commissionBillingTotals,
  commissionInvoiceSchema,
  inventoryId,
  commissionBillingSourceSchema as sourceSchema,
  commissionBillingRecordSchema as recordSchema,
  type CommissionBillingRecord,
  proposalTotals,
  type CommissionInvoice,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { agreementDocumentHash, readAgreement } from "./agreements";

const c = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type { CommissionBillingRecord } from "@sadboi/core";
function fail(message: string, status = 409): never {
  throw new AccessError(status, "commission_billing", message);
}
function access(staff: Staff, write = false) {
  if (
    write
      ? staff.role !== "super_admin"
      : !["super_admin", "accounting"].includes(staff.role)
  )
    fail(
      write
        ? "Only super admins manage commission invoices."
        : "Commission billing access is restricted.",
      403,
    );
}
function readRecord(
  data: FirebaseFirestore.DocumentData | undefined,
): CommissionBillingRecord | null {
  if (!data) return null;
  if (data.businessId !== businessId)
    fail("Billing access is restricted.", 404);
  const parsed = recordSchema.safeParse(data);
  if (!parsed.success) fail("Billing history needs administrator review.");
  const record = parsed.data,
    totals = commissionBillingTotals(record.invoices, record.source.totalMinor);
  if (
    proposalTotals(record.source.proposal).totalMinor !==
      record.source.totalMinor ||
    totals.unallocatedMinor < 0 ||
    record.invoices.some(
      (invoice) =>
        invoice.payments.reduce(
          (sum, payment) =>
            sum + (payment.reversedAt ? 0 : payment.amountMinor),
          0,
        ) > invoice.input.amountMinor,
    )
  )
    fail("Billing balances need administrator review.");
  return record;
}
function agreementSource(data: FirebaseFirestore.DocumentData | undefined) {
  const agreement = readAgreement(data);
  if (
    !agreement ||
    !agreement.signedAt ||
    !["signed", "voided"].includes(agreement.state)
  )
    fail("A signed agreement is required before commission billing.");
  if (
    !agreement.proposalSnapshot ||
    !agreement.proposalNumber ||
    agreement.signedDocumentHash !== agreementDocumentHash(agreement) ||
    agreement.input.totalMinor !== agreement.proposalTotalMinor ||
    proposalTotals(agreement.proposalSnapshot).totalMinor !==
      agreement.proposalTotalMinor
  )
    fail("Review the signed agreement snapshot before billing.");
  return {
    agreement,
    source: sourceSchema.parse({
      title: agreement.input.title,
      client: agreement.client,
      proposalNumber: agreement.proposalNumber,
      proposalVersion: agreement.proposalVersion,
      proposal: agreement.proposalSnapshot,
      agreementHash: agreement.signedDocumentHash,
      signedAt: agreement.signedAt,
      totalMinor: agreement.proposalTotalMinor,
    }),
  };
}
export async function commissionBillingDetail(
  proposalId: unknown,
  staff: Staff,
) {
  access(staff);
  const id = inventoryId.safeParse(proposalId);
  if (!id.success) fail("Invalid proposal reference.", 400);
  return adminServices().db.runTransaction(async (tx) => {
    const ref = c("commissionBilling").doc(id.data);
    const [agreementDoc, doc, history] = await Promise.all([
      tx.get(c("commissionAgreements").doc(id.data)),
      tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(200)),
    ]);
    const { agreement, source } = agreementSource(agreementDoc.data());
    const record = readRecord(doc.data());
    if (record && record.source.agreementHash !== source.agreementHash)
      fail("The billing and agreement snapshots do not match.");
    return {
      proposalId: id.data,
      source: record?.source ?? source,
      agreementState: agreement.state,
      revision: record?.revision ?? 0,
      invoices: record?.invoices ?? [],
      history: history.docs.map((row) => ({
        revision: Number(row.data().revision),
        action: String(row.data().action),
        note: String(row.data().note),
        createdAt: String(row.data().createdAt),
        invoice: commissionInvoiceSchema.parse(row.data().invoice),
      })),
    };
  });
}
export async function commissionBillingDirectory(staff: Staff) {
  access(staff);
  const [agreements, billings] = await Promise.all([
    c("commissionAgreements").limit(501).get(),
    c("commissionBilling").limit(501).get(),
  ]);
  if (agreements.size > 500 || billings.size > 500)
    fail("Billing needs pagination before loading more records.", 503);
  const records = new Map(
    billings.docs.map((doc) => [doc.id, readRecord(doc.data())!]),
  );
  return agreements.docs
    .filter(
      (doc) =>
        doc.data().businessId === businessId &&
        (doc.data().state === "signed" || records.has(doc.id)),
    )
    .map((doc) => {
      const { source, agreement } = agreementSource(doc.data()),
        record = records.get(doc.id);
      return {
        id: doc.id,
        title: source.title,
        clientName: source.client.name,
        proposalNumber: source.proposalNumber,
        agreementState: agreement.state,
        totalMinor: source.totalMinor,
        ...commissionBillingTotals(record?.invoices ?? [], source.totalMinor),
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName));
}
export async function saveCommissionBilling(raw: unknown, staff: Staff) {
  access(staff, true);
  const parsed = commissionBillingCommandSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const command = parsed.data,
    operation = c("commissionBillingOperations").doc(
      hash(staff.uid + ":" + command.operationId),
    ),
    fingerprint = hash(JSON.stringify(command));
  return adminServices().db.runTransaction(async (tx) => {
    const previous = await tx.get(operation);
    if (previous.exists) {
      if (previous.data()!.fingerprint !== fingerprint)
        fail("This request ID was used for different billing details.");
      return previous.data()!.result as { revision: number };
    }
    const ref = c("commissionBilling").doc(command.proposalId);
    const [agreementDoc, doc] = await Promise.all([
      tx.get(c("commissionAgreements").doc(command.proposalId)),
      tx.get(ref),
    ]);
    const { agreement, source } = agreementSource(agreementDoc.data()),
      old = readRecord(doc.data());
    if ((old?.revision ?? 0) !== command.expectedRevision)
      fail("Billing changed. Reload before editing again.");
    if ((old?.revision ?? 0) >= 200)
      fail("The 200-change billing history limit has been reached.");
    if (old && old.source.agreementHash !== source.agreementHash)
      fail("The billing and agreement snapshots do not match.");
    if (["save", "issue"].includes(command.action)) {
      if (agreement.state !== "signed")
        fail("New or changed invoices require an active signed agreement.");
      const contact = await tx.get(c("contacts").doc(source.client.id));
      if (
        contact.data()?.businessId !== businessId ||
        contact.data()?.input?.status !== "active"
      )
        fail("Restore the contact before preparing or issuing invoices.");
    }
    const counterRef = c("counters").doc("commissionInvoice");
    const counter =
      command.action === "issue" ? await tx.get(counterRef) : null;
    const sequence = (counter?.data()?.value ?? 0) + 1;
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      fail("Invoice numbering needs administrator review.");
    const now = new Date().toISOString(),
      revision = (old?.revision ?? 0) + 1;
    let invoices: CommissionInvoice[];
    try {
      invoices = applyCommissionBilling(
        old?.invoices ?? [],
        command,
        source.totalMinor,
        now,
        `CI-${String(sequence).padStart(6, "0")}`,
      );
    } catch (error) {
      fail(error instanceof Error ? error.message : "Invalid invoice action.");
    }
    const record: CommissionBillingRecord = {
      businessId,
      revision,
      source: old?.source ?? source,
      invoices,
      updatedAt: now,
    };
    tx.set(ref, record);
    if (command.action === "issue") tx.set(counterRef, { value: sequence });
    tx.create(
      ref.collection("history").doc(String(revision).padStart(6, "0")),
      {
        businessId,
        revision,
        invoice: invoices.find((invoice) => invoice.id === command.invoiceId)!,
        action: command.action,
        note: command.note,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    tx.create(operation, {
      businessId,
      fingerprint,
      result: { revision },
      createdAt: now,
    });
    return { revision };
  });
}
