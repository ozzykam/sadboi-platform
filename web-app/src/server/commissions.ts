import "server-only";
import { createHash } from "node:crypto";
import { commissionCommandSchema, commissionInquirySchema, commissionProjectSchema, initialCommissionProject, assertCommissionProjectUpdate,
  contactInputSchema, inventoryId, commissionKindSchema, type CommissionInquiry, type CommissionProject } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
const c = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Kind = "inquiry" | "project";
type Contact = { id: string; name: string; email: string; kind: "person" | "organization" };
export type CommissionRecord = { id: string; kind: Kind; revision: number; createdAt: string; updatedAt: string; contact: Contact;
  input: CommissionInquiry | CommissionProject; projectId: string | null; inquiryId: string | null; acceptedBrief: CommissionInquiry | null };
export type CommissionSummary = Omit<CommissionRecord, "input" | "acceptedBrief"> & {
  title: string; state: string; deadline: string; archived: boolean; budgetMinor: number | null; nextFollowUp: string };
const records = (kind: Kind) => c(kind === "inquiry" ? "commissionInquiries" : "commissionProjects");
function fail(message: string, status = 409): never { throw new AccessError(status, "commission", message); }
function record(id: string, kind: Kind, data: FirebaseFirestore.DocumentData | undefined): CommissionRecord {
  if (!data || data.businessId !== businessId) fail("Commission record not found.", 404);
  if (!Number.isSafeInteger(data.revision) || data.revision < 1 || data.revision > 200) fail("Record history needs administrator review.");
  const input = kind === "inquiry" ? commissionInquirySchema.parse(data.input) : commissionProjectSchema.parse(data.input);
  if (!data.contact || !inventoryId.safeParse(data.contact.id).success || typeof data.contact.name !== "string" || typeof data.contact.email !== "string" || !["person", "organization"].includes(data.contact.kind)) fail("Contact history needs administrator review.");
  return { id, kind, revision: data.revision, createdAt: String(data.createdAt), updatedAt: String(data.updatedAt), input,
    contact: { id: data.contact.id, name: data.contact.name, email: data.contact.email, kind: data.contact.kind },
    projectId: typeof data.projectId === "string" ? data.projectId : null, inquiryId: typeof data.inquiryId === "string" ? data.inquiryId : null,
    acceptedBrief: data.acceptedBrief ? commissionInquirySchema.parse(data.acceptedBrief) : null };
}
export async function commissionDirectory() {
  const [inquiries, projects, contacts] = await Promise.all([records("inquiry").limit(501).get(), records("project").limit(501).get(), c("contacts").limit(1001).get()]);
  if (inquiries.size > 500 || projects.size > 500 || contacts.size > 1000) fail("This workspace needs pagination before loading more records.", 503);
  const summarize = (kind: Kind, doc: FirebaseFirestore.QueryDocumentSnapshot): CommissionSummary => {
    const row = record(doc.id, kind, doc.data()), { input, acceptedBrief: _brief, ...rest } = row;
    void _brief;
    return { ...rest, title: input.title, state: "stage" in input ? input.stage : input.status, deadline: input.deadline,
      archived: input.archived, budgetMinor: input.budgetMinor, nextFollowUp: "nextFollowUp" in input ? input.nextFollowUp : "" };
  };
  return { rows: [...inquiries.docs.map(doc => summarize("inquiry", doc)), ...projects.docs.map(doc => summarize("project", doc))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    contacts: contacts.docs.filter(doc => doc.data().businessId === businessId).map(doc => {
      const input = contactInputSchema.parse(doc.data().input); return { id: doc.id, name: input.name, email: input.email, kind: input.kind, status: input.status };
    }).sort((a, b) => a.name.localeCompare(b.name)) };
}
export async function commissionDetail(rawKind: unknown, rawId: unknown) {
  const kind = commissionKindSchema.safeParse(rawKind), id = inventoryId.safeParse(rawId);
  if (!kind.success || !id.success) fail("Invalid commission reference.", 400);
  const ref = records(kind.data).doc(id.data);
  return adminServices().db.runTransaction(async tx => {
    const [saved, events] = await Promise.all([tx.get(ref), tx.get(ref.collection("history").orderBy("revision", "desc").limit(20))]);
    return { record: record(ref.id, kind.data, saved.data()), history: events.docs.map(doc => {
      const data = doc.data();
      return { revision: Number(data.revision), note: String(data.note), createdAt: String(data.createdAt),
        input: kind.data === "inquiry" ? commissionInquirySchema.parse(data.input) : commissionProjectSchema.parse(data.input) };
    }) };
  });
}
export async function saveCommission(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin") fail("Only super admins can manage commission inquiries and projects.", 403);
  const parsed = commissionCommandSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400);
  const command = parsed.data, operation = c("commissionOperations").doc(hash(staff.uid + ":" + command.operationId)), fingerprint = hash(JSON.stringify(command));
  const kind: Kind = command.action === "project" ? "project" : "inquiry", id = command.id ?? operation.id, ref = records(kind).doc(id);
  return adminServices().db.runTransaction(async tx => {
    const prior = await tx.get(operation);
    if (prior.exists) { if (prior.data()!.fingerprint !== fingerprint) fail("This request ID was used for different commission details."); return prior.data()!.result as { id: string; kind: Kind; revision: number }; }
    const saved = await tx.get(ref), old = saved.exists ? record(id, kind, saved.data()) : null;
    if (command.action !== "inquiry" || command.id) { if (!old) fail("Commission record not found.", 404); }
    else if (old) fail("This inquiry already exists.");
    if ((old?.revision ?? 0) !== command.expectedRevision) fail("This record changed. Reload saved record before editing again.");
    if (old && old.revision >= 200) fail("This record reached its 200-update limit. Administrator review is required.");
    const now = new Date().toISOString(), revision = (old?.revision ?? 0) + 1;
    const audit = (target: FirebaseFirestore.DocumentReference, input: CommissionInquiry | CommissionProject, version: number, contact: Contact) => {
      tx.create(target.collection("history").doc(String(version).padStart(4, "0")), { businessId, input, revision: version, contact, note: command.note, actorId: staff.uid, createdAt: now });
    };
    let result: { id: string; kind: Kind; revision: number };
    if (command.action === "convert") {
      const inquiry = commissionInquirySchema.parse(old!.input);
      if (old!.projectId) fail("This inquiry already has a project. Open its linked project.");
      if (inquiry.archived || inquiry.stage !== "accepted") fail("Accept and restore the inquiry before creating its project.");
      const projectId = hash("commission-project:" + id), projectRef = records("project").doc(projectId), counter = c("commissionState").doc("counts");
      const [existing, counts, contactDoc] = await Promise.all([tx.get(projectRef), tx.get(counter), tx.get(c("contacts").doc(inquiry.contactId))]);
      if (existing.exists) fail("This inquiry already has a project.");
      if (contactDoc.data()?.businessId !== businessId || contactDoc.data()?.input?.status !== "active") fail("Restore the linked contact before converting this inquiry.");
      const count = counts.data()?.projects ?? 0; if (!Number.isSafeInteger(count) || count >= 500) fail("The workspace supports up to 500 commission projects.");
      const input = initialCommissionProject(inquiry);
      tx.create(projectRef, { businessId, input, contact: old!.contact, inquiryId: id, acceptedBrief: inquiry, revision: 1, createdAt: now, updatedAt: now });
      tx.update(ref, { projectId, revision, updatedAt: now });
      tx.set(counter, { projects: count + 1 }, { merge: true });
      audit(ref, inquiry, revision, old!.contact); audit(projectRef, input, 1, old!.contact);
      result = { id: projectId, kind: "project", revision: 1 };
    } else if (command.action === "inquiry") {
      if (old?.projectId) fail("Converted inquiries keep their accepted brief. Edit the linked project instead.");
      const contactDoc = await tx.get(c("contacts").doc(command.input.contactId)), contactData = contactDoc.data();
      if (contactData?.businessId !== businessId) fail("Choose a contact from this workspace.", 400);
      const contactInput = contactInputSchema.parse(contactData.input);
      if (contactInput.status !== "active" && (!old || old.contact.id !== command.input.contactId)) fail("Choose an active contact.", 400);
      const contact = old?.contact.id === command.input.contactId ? old.contact : { id: contactDoc.id, name: contactInput.name, email: contactInput.email, kind: contactInput.kind };
      const counter = c("commissionState").doc("counts"), counts = !old ? await tx.get(counter) : null, count = counts?.data()?.inquiries ?? 0;
      if (!old && (!Number.isSafeInteger(count) || count >= 500)) fail("The workspace supports up to 500 inquiries.");
      tx.set(ref, { businessId, input: command.input, contact, revision, createdAt: old?.createdAt ?? now, updatedAt: now });
      if (!old) tx.set(counter, { inquiries: count + 1 }, { merge: true });
      audit(ref, command.input, revision, contact); result = { id, kind, revision };
    } else {
      try { assertCommissionProjectUpdate(commissionProjectSchema.parse(old!.input), command.input); }
      catch (error) { fail(error instanceof Error ? error.message : "Project change requires review."); }
      tx.update(ref, { input: command.input, revision, updatedAt: now });
      audit(ref, command.input, revision, old!.contact); result = { id, kind, revision };
    }
    tx.create(operation, { businessId, fingerprint, result, actorId: staff.uid, createdAt: now });
    tx.create(c("commissionAudit").doc(operation.id), { businessId, action: command.action, recordId: id, result, note: command.note, actorId: staff.uid, createdAt: now });
    return result;
  });
}
