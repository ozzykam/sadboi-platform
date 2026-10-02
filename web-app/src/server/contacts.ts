import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { contactInputSchema, type ContactRecord, type ContactsDirectory } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, cookieName, staffForCookie, type Staff } from "./staff";
import { ensureStaffMode } from "./auth-http";

const collection = () => adminServices().db.collection("businesses/" + businessId + "/contacts");
const audit = () => adminServices().db.collection("businesses/" + businessId + "/contactAudit");
const idFor = (staff: Staff, operationId: string) => createHash("sha256").update(staff.uid + ":" + operationId).digest("hex");
function fail(message: string, status = 409): never { throw new AccessError(status, "contacts", message); }
function operationId(value: unknown) { if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) fail("A valid request ID is required.", 400); return value; }
function parse(value: unknown) { const result = contactInputSchema.safeParse(value); if (!result.success) fail(result.error.issues.map(issue => issue.message).join(" "), 400); return result.data; }
function keys(body: Record<string, unknown>, editing: boolean) { const allowed = editing ? ["input", "id", "revision", "operationId"] : ["input", "operationId"]; if (Object.keys(body).some(key => !allowed.includes(key))) fail("Unexpected contact fields.", 400); }
function project(doc: FirebaseFirestore.QueryDocumentSnapshot): ContactRecord {
  const data = doc.data(), input = contactInputSchema.parse(data.input), lastContactDate = input.activities.reduce((latest, activity) => activity.date > latest ? activity.date : latest, "");
  return { ...input, id: doc.id, revision: data.revision, createdAt: data.createdAt, updatedAt: data.updatedAt, lastContactDate };
}
export async function contactsStaff(write = false): Promise<Staff> {
  ensureStaffMode(); const staff = await staffForCookie((await cookies()).get(cookieName("session"))?.value); if (!staff) throw new AccessError(401, "sign-in", "Your session has ended. Sign in again before continuing.");
  if (write && staff.role !== "super_admin") throw new AccessError(403, "forbidden", "Only super admins can edit contacts.");
  if (!write && !["super_admin", "legal", "accounting"].includes(staff.role)) throw new AccessError(403, "forbidden", "Your staff role does not allow this action.");
  return staff;
}
export async function contactsDirectory(): Promise<ContactsDirectory> { const result = await collection().limit(1001).get(); if (result.size > 1000) fail("Contacts need pagination before this directory can grow further.", 503); return { contacts: result.docs.map(project).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) }; }
export async function saveContact(body: Record<string, unknown>, staff: Staff, editing: boolean) {
  keys(body, editing); const input = parse(body.input), operation = operationId(body.operationId), id = editing ? body.id : idFor(staff, operation);
  if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) fail("Invalid contact ID.", 400);
  const ref = collection().doc(id), opRef = adminServices().db.collection("businesses/" + businessId + "/contactOperations").doc(operation), inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await adminServices().db.runTransaction(async tx => {
    const [record, prior] = await Promise.all([tx.get(ref), tx.get(opRef)]);
    if (prior.exists) { if (prior.data()!.inputHash !== inputHash || prior.data()!.recordId !== id) fail("That request ID was already used for different contact details."); return; }
    const data = record.data();
    if (editing && !record.exists) fail("Contact not found.", 404);
    if (editing && (!Number.isSafeInteger(body.revision) || data!.revision !== body.revision)) fail("This contact changed. Refresh before editing it.");
    if (!editing && record.exists) fail("This contact already exists.");
    if (input.organizationId) { const organization = await tx.get(collection().doc(input.organizationId)); if (!organization.exists || organization.data()!.input.kind !== "organization" || organization.data()!.input.status !== "active") fail("Choose an active organization for this contact.", 400); }
    const count = (await tx.get(adminServices().db.doc("businesses/" + businessId + "/contactState/counters"))).data()?.contacts ?? 0;
    if (!editing && count >= 1000) fail("This workspace supports up to 1,000 contacts and organizations.");
    const now = new Date().toISOString(), revision = editing ? data!.revision + 1 : 1;
    tx.set(ref, { input, businessId, revision, createdAt: data?.createdAt ?? now, updatedAt: now, updatedBy: staff.uid });
    if (!editing) tx.set(adminServices().db.doc("businesses/" + businessId + "/contactState/counters"), { contacts: count + 1 }, { merge: true });
    tx.create(opRef, { businessId, recordId: id, inputHash, actorId: staff.uid, createdAt: now, result: { id } });
    tx.create(audit().doc(operation), { businessId, recordId: id, kind: editing ? input.status === "archived" ? "archived" : "updated" : "created", before: data?.input ?? null, after: input, actorId: staff.uid, createdAt: now });
  });
  return { id };
}
export function contactsFailure(error: unknown) { if (error instanceof AccessError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } }); console.error("Contacts service failed", error); return Response.json({ error: "Contacts are temporarily unavailable.", code: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
