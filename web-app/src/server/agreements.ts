import "server-only";
import { createHash } from "node:crypto";
import {
  agreementCommandSchema,
  agreementInputSchema,
  agreementSourceSchema,
  agreementStates,
  agreementTransition,
  assertSigningDate,
  inventoryId,
  proposalInputSchema,
  proposalTotals,
  type AgreementInput,
  type AgreementState,
  type ProposalInput,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";

const c = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "agreement", message);
}
type Client = { id: string; name: string; email: string };
export type AgreementRecord = {
  revision: number;
  state: AgreementState;
  input: AgreementInput;
  client: Client;
  proposalNumber: string | null;
  proposalVersion: number;
  proposalTotalMinor: number;
  proposalSnapshot: ProposalInput | null;
  documentHash: string;
  signedDocumentHash: string;
  invitationExpiresAt: string | null;
  invitedAt: string | null;
  signedAt: string | null;
  signedDate: string | null;
  signerName: string;
  signatureMethod: "client_link" | "staff_recorded" | null;
  consentText: string;
  evidence: string;
  updatedAt: string;
};
function readAccess(staff: Staff) {
  if (!["super_admin", "legal", "accounting"].includes(staff.role))
    fail("Agreement access is restricted.", 403);
}
export function readAgreement(
  data: FirebaseFirestore.DocumentData | undefined,
): AgreementRecord | null {
  if (!data) return null;
  if (
    data.businessId !== businessId ||
    !Number.isInteger(data.revision) ||
    data.revision < 1 ||
    data.revision > 100 ||
    !agreementStates.includes(data.state)
  )
    fail("Agreement history needs administrator review.");
  if (
    !data.client ||
    !inventoryId.safeParse(data.client.id).success ||
    typeof data.client.name !== "string" ||
    typeof data.client.email !== "string"
  )
    fail("Agreement client history needs administrator review.");
  return {
    revision: data.revision,
    state: data.state,
    input: agreementInputSchema.parse(data.input),
    client: {
      id: data.client.id,
      name: data.client.name,
      email: data.client.email,
    },
    proposalNumber: data.proposalNumber ?? null,
    proposalVersion: Number(data.proposalVersion),
    proposalTotalMinor: Number(data.proposalTotalMinor),
    proposalSnapshot: data.proposalSnapshot
      ? proposalInputSchema.parse(data.proposalSnapshot)
      : null,
    documentHash: String(data.documentHash ?? ""),
    signedDocumentHash: String(data.signedDocumentHash ?? ""),
    invitationExpiresAt: data.invitationExpiresAt ?? null,
    invitedAt: data.invitedAt ?? null,
    signedAt: data.signedAt ?? null,
    signedDate: data.signedDate ?? null,
    signerName: String(data.signerName ?? ""),
    signatureMethod:
      data.signatureMethod ?? (data.signedAt ? "staff_recorded" : null),
    consentText: String(data.consentText ?? ""),
    evidence: String(data.evidence ?? ""),
    updatedAt: String(data.updatedAt),
  };
}
export function agreementDocumentHash(record: AgreementRecord) {
  return hash(
    JSON.stringify({
      input: record.input,
      client: record.client,
      proposalNumber: record.proposalNumber,
      proposalVersion: record.proposalVersion,
      proposalSnapshot: record.proposalSnapshot,
    }),
  );
}
// Explicit allowlist: never expose staff notes, response evidence, internal IDs or invitation hashes.
export function publicAgreement(record: AgreementRecord) {
  return {
    revision: record.revision,
    state: record.state,
    input: record.input,
    client: { name: record.client.name, email: record.client.email },
    proposalNumber: record.proposalNumber,
    proposalVersion: record.proposalVersion,
    proposalSnapshot: record.proposalSnapshot,
    documentHash: record.documentHash,
    invitationExpiresAt: record.invitationExpiresAt,
    signerName: record.signerName,
    signedDate: record.signedDate,
    signedAt: record.signedAt,
    signatureMethod: record.signatureMethod,
    consentText: record.consentText,
  };
}
async function acceptedProposal(
  tx: FirebaseFirestore.Transaction,
  proposalId: string,
) {
  const data = (await tx.get(c("commissionProposals").doc(proposalId))).data();
  if (!data || data.businessId !== businessId)
    fail("Accepted proposal not found.", 404);
  if (data.state !== "accepted")
    fail("An agreement can only start from an accepted proposal.");
  const input = proposalInputSchema.parse(data.input);
  if (
    !data.client ||
    !inventoryId.safeParse(data.client.id).success ||
    typeof data.client.name !== "string" ||
    typeof data.client.email !== "string" ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    typeof data.number !== "string"
  )
    fail("Proposal history needs administrator review.");
  return {
    input,
    proposalNumber: data.number,
    proposalVersion: data.version as number,
    proposalTotalMinor: proposalTotals(input).totalMinor,
    client: {
      id: String(data.client.id),
      name: data.client.name as string,
      email: data.client.email as string,
    },
  };
}
export async function agreementDirectory(staff: Staff) {
  readAccess(staff);
  const [proposals, agreements] = await Promise.all([
    c("commissionProposals").limit(501).get(),
    c("commissionAgreements").limit(501).get(),
  ]);
  if (proposals.size > 500 || agreements.size > 500)
    fail("Agreements need pagination before loading more records.", 503);
  const records = new Map(
    agreements.docs
      .filter((doc) => doc.data().businessId === businessId)
      .map((doc) => [doc.id, readAgreement(doc.data())!]),
  );
  return proposals.docs
    .filter(
      (doc) =>
        doc.data().businessId === businessId && doc.data().state === "accepted",
    )
    .map((doc) => {
      const data = doc.data(),
        record = records.get(doc.id);
      return {
        id: doc.id,
        title: record?.input.title ?? String(data.input.title),
        clientName: record?.client.name ?? String(data.client.name),
        number: String(data.number),
        state: record?.state ?? "not_started",
        updatedAt: record?.updatedAt ?? String(data.updatedAt),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function agreementDetail(raw: unknown, staff: Staff) {
  readAccess(staff);
  const parsed = agreementSourceSchema.safeParse(raw);
  if (!parsed.success) fail("Invalid proposal reference.", 400);
  return adminServices().db.runTransaction(async (tx) => {
    const source = await acceptedProposal(tx, parsed.data.proposalId),
      ref = c("commissionAgreements").doc(parsed.data.proposalId);
    const [doc, history] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(100)),
    ]);
    return {
      proposalId: parsed.data.proposalId,
      client: source.client,
      proposal: {
        number: source.proposalNumber,
        version: source.proposalVersion,
        totalMinor: source.proposalTotalMinor,
        input: source.input,
      },
      record: readAgreement(doc.data()),
      history: history.docs.map((row) => ({
        record: readAgreement(row.data())!,
        action: String(row.data().action),
        note: String(row.data().note),
        createdAt: String(row.data().createdAt),
      })),
    };
  });
}
export async function saveAgreement(raw: unknown, staff: Staff) {
  if (!["super_admin", "legal"].includes(staff.role))
    fail("Only super admins and legal staff can manage agreements.", 403);
  const parsed = agreementCommandSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const command = parsed.data,
    operation = c("agreementOperations").doc(
      hash(staff.uid + ":" + command.operationId),
    );
  const fingerprint = hash(JSON.stringify(command));
  return adminServices().db.runTransaction(async (tx) => {
    const prior = await tx.get(operation);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail("This request ID was used for different agreement details.");
      return prior.data()!.result as { revision: number };
    }
    const source = await acceptedProposal(tx, command.source.proposalId),
      ref = c("commissionAgreements").doc(command.source.proposalId);
    const doc = await tx.get(ref),
      old = readAgreement(doc.data());
    if ((old?.revision ?? 0) !== command.expectedRevision)
      fail("This agreement changed. Reload it before editing again.");
    if ((old?.revision ?? 0) >= 100)
      fail(
        "This agreement reached its 100-update limit. Administrator review is required.",
      );
    const input = command.action === "save" ? command.input : old?.input;
    if (!input) fail("Save an agreement draft first.");
    let state: AgreementState;
    try {
      state = agreementTransition(old?.state ?? null, command.action);
    } catch (error) {
      fail(
        error instanceof Error ? error.message : "Invalid agreement action.",
      );
    }
    const now = new Date().toISOString(),
      revision = (old?.revision ?? 0) + 1;
    if (
      ["save", "invite"].includes(command.action) &&
      input.totalMinor !== source.proposalTotalMinor
    )
      fail("The agreement total must match the accepted proposal.");
    if (command.action === "invite") {
      if (revision >= 100)
        fail("There must be room in the history to record the signature.");
      if (input.expiresDate && input.expiresDate < now.slice(0, 10))
        fail("Reopen the draft and review the expired agreement dates.");
      const contact = await tx.get(c("contacts").doc(source.client.id));
      if (
        contact.data()?.businessId !== businessId ||
        contact.data()?.input?.status !== "active"
      )
        fail("Restore the linked contact before inviting.");
      if (doc.data()?.invitationHash === hash(command.token))
        fail("Generate a new invitation code.");
    }
    if (command.action === "recordSignature") {
      try {
        assertSigningDate(command.signedDate, now.slice(0, 10));
      } catch (error) {
        fail((error as Error).message, 400);
      }
    }
    const record: AgreementRecord = {
      revision,
      state,
      input,
      client: old?.client ?? source.client,
      proposalNumber: old?.proposalNumber ?? source.proposalNumber,
      proposalVersion: old?.proposalVersion ?? source.proposalVersion,
      proposalTotalMinor: old?.proposalTotalMinor ?? source.proposalTotalMinor,
      proposalSnapshot: old?.proposalSnapshot ?? source.input,
      documentHash: "",
      signedDocumentHash: old?.signedDocumentHash ?? "",
      invitedAt: command.action === "invite" ? now : (old?.invitedAt ?? null),
      invitationExpiresAt:
        command.action === "invite"
          ? new Date(Date.now() + 7 * 86400000).toISOString()
          : ["reopen", "void", "recordSignature"].includes(command.action)
            ? null
            : (old?.invitationExpiresAt ?? null),
      signedAt:
        command.action === "recordSignature" ? now : (old?.signedAt ?? null),
      signedDate:
        command.action === "recordSignature"
          ? command.signedDate
          : (old?.signedDate ?? null),
      signerName:
        command.action === "recordSignature"
          ? command.signerName
          : (old?.signerName ?? ""),
      evidence:
        command.action === "recordSignature"
          ? command.evidence
          : (old?.evidence ?? ""),
      signatureMethod:
        command.action === "recordSignature"
          ? "staff_recorded"
          : (old?.signatureMethod ?? null),
      consentText: old?.consentText ?? "",
      updatedAt: now,
    };
    record.documentHash = agreementDocumentHash(record);
    if (command.action === "recordSignature")
      record.signedDocumentHash = record.documentHash;
    const invitationHash =
      command.action === "invite"
        ? hash(command.token)
        : ["reopen", "void", "recordSignature"].includes(command.action)
          ? null
          : (doc.data()?.invitationHash ?? null);
    tx.set(ref, {
      ...record,
      businessId,
      invitationHash,
      proposalId: command.source.proposalId,
      createdAt: doc.data()?.createdAt ?? now,
    });
    tx.create(
      ref.collection("history").doc(String(revision).padStart(6, "0")),
      {
        ...record,
        businessId,
        proposalId: command.source.proposalId,
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
