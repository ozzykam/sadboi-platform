import "server-only";
import { createHash } from "node:crypto";
import {
  applyStudioInvoice,
  defaultInvoiceDefaults,
  invoiceDefaultsSaveSchema,
  invoiceDefaultsSchema,
  studioInvoiceCommandSchema,
  studioInvoiceSchema,
  studioInvoicePaid,
  studioInvoiceTotals,
  studioInvoiceNumber,
  type InvoiceDefaults,
  type StudioInvoice,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";

const c = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "studio-invoices", message);
}
function access(staff: Staff, write = false) {
  if (
    write
      ? staff.role !== "super_admin"
      : !["super_admin", "accounting"].includes(staff.role)
  )
    fail("Invoice access is restricted.", 403);
}
function read(
  data: FirebaseFirestore.DocumentData | undefined,
): StudioInvoice | null {
  if (!data) return null;
  if (data.businessId !== businessId) fail("Invoice not found.", 404);
  const { businessId: _businessId, ...record } = data;
  void _businessId;
  const parsed = studioInvoiceSchema.safeParse(record);
  if (!parsed.success) fail("This invoice needs administrator review.");
  const invoice = parsed.data;
  if (
    studioInvoicePaid(invoice) >
      studioInvoiceTotals(invoice.input).totalMinor ||
    (invoice.state === "issued" &&
      (!invoice.number || !invoice.issuedAt || !invoice.dueDate))
  )
    fail("Invoice balances or dates need administrator review.");
  return invoice;
}
export type InvoiceDefaultsRecord = {
  revision: number;
  input: InvoiceDefaults;
};
function readDefaults(
  data: FirebaseFirestore.DocumentData | undefined,
): InvoiceDefaultsRecord {
  if (!data) return { revision: 0, input: defaultInvoiceDefaults };
  const parsed = invoiceDefaultsSchema.safeParse(data.input);
  if (
    data.businessId !== businessId ||
    !parsed.success ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1
  )
    fail("Invoice defaults need administrator review.");
  return { revision: data.revision, input: parsed.data };
}
export async function invoiceDefaults(staff: Staff) {
  access(staff);
  return readDefaults(
    (await c("inventoryState").doc("invoiceDefaults").get()).data(),
  );
}
export async function saveInvoiceDefaults(raw: unknown, staff: Staff) {
  access(staff, true);
  const parsed = invoiceDefaultsSaveSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((i) => i.message).join(" "), 400);
  const command = parsed.data,
    fingerprint = hash(JSON.stringify(command));
  const operation = c("studioInvoiceOperations").doc(
    hash(staff.uid + ":" + command.operationId),
  );
  return adminServices().db.runTransaction(async (tx) => {
    const ref = c("inventoryState").doc("invoiceDefaults");
    const [op, doc] = await Promise.all([tx.get(operation), tx.get(ref)]);
    if (op.exists) {
      if (op.data()!.fingerprint !== fingerprint)
        fail("This request ID was already used for different details.");
      return op.data()!.result as InvoiceDefaultsRecord;
    }
    const before = readDefaults(doc.data());
    if (before.revision !== command.expectedRevision)
      fail("Defaults changed. Reload before saving.");
    const result = { revision: before.revision + 1, input: command.input },
      now = new Date().toISOString();
    tx.set(ref, {
      ...result,
      businessId,
      updatedAt: now,
      updatedBy: staff.uid,
    });
    tx.create(operation, {
      fingerprint,
      result,
      businessId,
      actorId: staff.uid,
      createdAt: now,
    });
    tx.create(c("inventoryAudit").doc(operation.id), {
      businessId,
      resource: "invoiceDefaults",
      before,
      after: result,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
export async function studioInvoiceDirectory(staff: Staff) {
  access(staff);
  const docs = await c("studioInvoices").limit(501).get();
  if (docs.size > 500)
    fail(
      "Invoice directory needs pagination before loading more records.",
      503,
    );
  return docs.docs
    .map((doc) => read(doc.data())!)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function invoiceContactOptions(staff: Staff) {
  access(staff);
  const docs = await c("contacts").limit(1001).get();
  if (docs.size > 1000) fail("Contact selection needs pagination.", 503);
  return docs.docs
    .filter(
      (doc) =>
        doc.data().businessId === businessId &&
        doc.data().input?.status === "active",
    )
    .map((doc) => ({
      id: doc.id,
      name: String(doc.data().input.name ?? ""),
      email: String(doc.data().input.email ?? ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function studioInvoiceDetail(id: unknown, staff: Staff) {
  access(staff);
  const parsed = studioInvoiceSchema.shape.id.safeParse(id);
  if (!parsed.success) fail("Invalid invoice reference.", 400);
  return adminServices().db.runTransaction(async (tx) => {
    const ref = c("studioInvoices").doc(parsed.data);
    const [doc, history] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(200)),
    ]);
    const invoice = read(doc.data());
    if (!invoice) fail("Invoice not found.", 404);
    return {
      invoice,
      history: history.docs.map((row) => ({
        revision: Number(row.data().revision),
        action: String(row.data().action),
        note: String(row.data().note),
        createdAt: String(row.data().createdAt),
      })),
    };
  });
}
export async function saveStudioInvoice(raw: unknown, staff: Staff) {
  access(staff, true);
  const parsed = studioInvoiceCommandSchema.safeParse(raw);
  if (!parsed.success)
    fail(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" "),
      400,
    );
  const command = parsed.data,
    fingerprint = hash(JSON.stringify(command));
  const operation = c("studioInvoiceOperations").doc(
    hash(staff.uid + ":" + command.operationId),
  );
  return adminServices().db.runTransaction(async (tx) => {
    const op = await tx.get(operation);
    if (op.exists) {
      if (op.data()!.fingerprint !== fingerprint)
        fail("This request ID was already used for different details.");
      return op.data()!.result as { id: string; revision: number };
    }
    const ref = c("studioInvoices").doc(command.invoiceId);
    const old = read((await tx.get(ref)).data());
    if (command.action === "save" || command.action === "issue") {
      const contactId =
        command.action === "save"
          ? command.input.billTo.contactId
          : old?.input.billTo.contactId;
      if (contactId) {
        const contact = (await tx.get(c("contacts").doc(contactId))).data();
        if (
          contact?.businessId !== businessId ||
          contact.input?.status !== "active"
        )
          fail(
            "Choose an active contact or enter the billing recipient directly.",
          );
      }
    }
    const counterRef = c("counters").doc("studioInvoice");
    const counter =
      command.action === "issue" ? await tx.get(counterRef) : null;
    const sequence = (counter?.data()?.value ?? 0) + 1;
    if (!Number.isSafeInteger(sequence) || sequence < 1)
      fail("Invoice numbering needs administrator review.");
    const now = new Date().toISOString();
    let invoice: StudioInvoice;
    try {
      invoice = applyStudioInvoice(
        old,
        command,
        now,
        command.action === "issue" && old
          ? studioInvoiceNumber(old.updatedAt, old.input.billTo.name, sequence)
          : undefined,
      );
    } catch (error) {
      fail(
        error instanceof Error ? error.message : "Unable to update invoice.",
      );
    }
    const result = { id: invoice.id, revision: invoice.revision };
    tx.set(ref, { ...invoice, businessId });
    tx.create(
      ref.collection("history").doc(String(invoice.revision).padStart(6, "0")),
      {
        businessId,
        revision: invoice.revision,
        action: command.action,
        note: command.note,
        invoice,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    if (command.action === "issue")
      tx.set(counterRef, { businessId, value: sequence });
    tx.create(operation, {
      businessId,
      fingerprint,
      result,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
