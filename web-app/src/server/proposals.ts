import "server-only";
import { createHash } from "node:crypto";
import {
  commissionInquirySchema,
  commissionProjectSchema,
  inventoryId,
  proposalCommandSchema,
  proposalInputSchema,
  proposalSourceSchema,
  proposalStates,
  proposalTotals,
  proposalTransition,
  type ProposalInput,
  type ProposalState,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
const c = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "proposal", message);
}
type Source = { kind: "inquiry" | "project"; id: string };
type Client = { id: string; name: string; email: string };
export type ProposalRecord = {
  revision: number;
  version: number;
  number: string | null;
  state: ProposalState;
  input: ProposalInput;
  client: Client;
  issuedAt: string | null;
  updatedAt: string;
  responseReference: string;
  sourceRevision: number;
};
function stored(
  data: FirebaseFirestore.DocumentData | undefined,
): ProposalRecord | null {
  if (!data) return null;
  if (
    data.businessId !== businessId ||
    !Number.isInteger(data.revision) ||
    data.revision < 1 ||
    data.revision > 100 ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    data.version > 20 ||
    !proposalStates.includes(data.state)
  )
    fail("Proposal history needs administrator review.");
  if (
    !data.client ||
    !inventoryId.safeParse(data.client.id).success ||
    typeof data.client.name !== "string" ||
    typeof data.client.email !== "string"
  )
    fail("Proposal client history needs administrator review.");
  return {
    revision: data.revision,
    version: data.version,
    number: data.number ?? null,
    state: data.state,
    input: proposalInputSchema.parse(data.input),
    client: {
      id: data.client.id,
      name: data.client.name,
      email: data.client.email,
    },
    issuedAt: data.issuedAt ?? null,
    updatedAt: String(data.updatedAt),
    responseReference: String(data.responseReference ?? ""),
    sourceRevision: Number(data.sourceRevision),
  };
}
async function sourceRecord(
  tx: FirebaseFirestore.Transaction,
  source: Source,
): Promise<{
  inquiryId: string;
  input:
    | ReturnType<typeof commissionInquirySchema.parse>
    | ReturnType<typeof commissionProjectSchema.parse>;
  revision: number;
  client: Client;
}> {
  const ref = c(
      source.kind === "inquiry" ? "commissionInquiries" : "commissionProjects",
    ).doc(source.id),
    doc = await tx.get(ref),
    data = doc.data();
  if (!data || data.businessId !== businessId)
    fail("Commission record not found.", 404);
  const inquiryId =
    source.kind === "inquiry" ? source.id : inventoryId.parse(data.inquiryId);
  // Both sides of a converted inquiry share one proposal series, using its live project.
  if (source.kind === "inquiry" && data.projectId) {
    const linked = await tx.get(
      c("commissionProjects").doc(inventoryId.parse(data.projectId)),
    );
    if (
      linked.data()?.businessId !== businessId ||
      linked.data()?.inquiryId !== source.id
    )
      fail("Commission links need administrator review.");
    return sourceRecord(tx, { kind: "project", id: linked.id });
  }
  if (source.kind === "project") {
    const inquiry = await tx.get(c("commissionInquiries").doc(inquiryId));
    if (
      inquiry.data()?.businessId !== businessId ||
      inquiry.data()?.projectId !== source.id
    )
      fail("Commission links need administrator review.");
  }
  const input =
    source.kind === "inquiry"
      ? commissionInquirySchema.parse(data.input)
      : commissionProjectSchema.parse(data.input);
  if (
    !data.contact ||
    !inventoryId.safeParse(data.contact.id).success ||
    typeof data.contact.name !== "string" ||
    typeof data.contact.email !== "string"
  )
    fail("Commission contact needs administrator review.");
  return {
    inquiryId,
    input,
    revision: Number(data.revision),
    client: {
      id: String(data.contact.id),
      name: String(data.contact.name),
      email: String(data.contact.email),
    },
  };
}
function readAccess(staff: Staff) {
  if (!["super_admin", "accounting"].includes(staff.role))
    fail("Proposal access is restricted.", 403);
}
export async function proposalDetail(raw: unknown, staff: Staff) {
  readAccess(staff);
  const parsed = proposalSourceSchema.safeParse(raw);
  if (!parsed.success) fail("Invalid commission reference.", 400);
  return adminServices().db.runTransaction(async (tx) => {
    const source = await sourceRecord(tx, parsed.data),
      ref = c("commissionProposals").doc(source.inquiryId);
    const [doc, history] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(100)),
    ]);
    return {
      source: parsed.data,
      seriesId: source.inquiryId,
      seed: {
        title: source.input.title,
        scope: source.input.brief,
        deliverables: source.input.deliverables,
      },
      client: source.client,
      record: stored(doc.data()),
      history: history.docs.map((row) => ({
        record: stored(row.data())!,
        note: String(row.data().note),
        action: String(row.data().action),
      })),
    };
  });
}
export async function saveProposal(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    fail("Only super admins can manage proposals.", 403);
  const parsed = proposalCommandSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const command = parsed.data,
    operation = c("proposalOperations").doc(
      hash(staff.uid + ":" + command.operationId),
    ),
    fingerprint = hash(JSON.stringify(command));
  return adminServices().db.runTransaction(async (tx) => {
    const prior = await tx.get(operation);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail(
          "This request ID was already used for different proposal details.",
        );
      return prior.data()!.result as { revision: number };
    }
    const source = await sourceRecord(tx, command.source),
      ref = c("commissionProposals").doc(source.inquiryId),
      doc = await tx.get(ref),
      old = stored(doc.data());
    if ((old?.revision ?? 0) !== command.expectedRevision)
      fail("This proposal changed. Reload proposal before editing again.");
    if ((old?.revision ?? 0) >= 100)
      fail(
        "This proposal reached its 100-change limit. Administrator review is required.",
      );
    if (!old && command.action !== "save") fail("Save a draft proposal first.");
    const input = command.action === "save" ? command.input : old!.input;
    const now = new Date().toISOString();
    let state: ProposalState;
    try {
      state = proposalTransition(
        old?.state ?? null,
        command.action,
        input,
        now.slice(0, 10),
      );
    } catch (error) {
      fail(error instanceof Error ? error.message : "Invalid proposal action.");
    }
    if (["save", "revise", "issue"].includes(command.action)) {
      if (
        source.input.archived ||
        ("status" in source.input &&
          ["completed", "cancelled"].includes(source.input.status)) ||
        ("stage" in source.input && source.input.stage === "declined")
      )
        fail("Restore and reopen the commission before preparing a proposal.");
      const contact = await tx.get(c("contacts").doc(source.client.id));
      if (
        contact.data()?.businessId !== businessId ||
        contact.data()?.input?.status !== "active"
      )
        fail("Restore the linked contact before preparing a proposal.");
      if (command.action === "issue" && old!.client.id !== source.client.id)
        fail(
          "The inquiry's client changed. Save the draft again before issuing.",
        );
    }
    const version = (old?.version ?? 1) + (command.action === "revise" ? 1 : 0);
    if (version > 20) fail("This proposal reached its 20-version limit.");
    let number = old?.number ?? null;
    const counter = c("proposalState").doc("numbering"),
      count =
        command.action === "issue" && !number ? await tx.get(counter) : null;
    if (count) {
      const next = (count.data()?.lastNumber ?? 0) + 1;
      if (!Number.isSafeInteger(next) || next < 1 || next > 999999)
        fail("Proposal numbering needs administrator review.");
      number = `PR-${String(next).padStart(6, "0")}`;
      tx.set(counter, { lastNumber: next }, { merge: true });
    }
    const revision = (old?.revision ?? 0) + 1;
    const record: ProposalRecord = {
      revision,
      version,
      number,
      state,
      input,
      client:
        command.action === "save" || command.action === "revise"
          ? source.client
          : old!.client,
      sourceRevision:
        command.action === "save" || command.action === "revise"
          ? source.revision
          : old!.sourceRevision,
      issuedAt:
        command.action === "issue"
          ? now
          : state === "draft"
            ? null
            : old!.issuedAt,
      updatedAt: now,
      responseReference:
        "responseReference" in command
          ? command.responseReference
          : state === "draft"
            ? ""
            : (old?.responseReference ?? ""),
    };
    const data = { businessId, ...record, ...proposalTotals(input) };
    tx.set(ref, data);
    tx.create(
      ref.collection("history").doc(String(revision).padStart(3, "0")),
      {
        ...data,
        action: command.action,
        note: command.note,
        actorId: staff.uid,
      },
    );
    const result = { revision };
    tx.create(operation, {
      businessId,
      fingerprint,
      result,
      createdAt: now,
      actorId: staff.uid,
    });
    return result;
  });
}
