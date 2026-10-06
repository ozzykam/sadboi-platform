import "server-only";
import { createHash } from "node:crypto";
import {
  agreementAccessSchema,
  agreementConsent,
  assertSigningDate,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import {
  readAgreement,
  agreementDocumentHash,
  publicAgreement,
} from "./agreements";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const denied = (): never => {
  throw new AccessError(
    404,
    "agreement-access",
    "This invitation is unavailable or expired. Ask the studio for a new link.",
  );
};
export async function accessAgreement(raw: unknown) {
  const parsed = agreementAccessSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "agreement-access",
      "Check the invitation, full name, signing date and consent.",
    );
  const command = parsed.data;
  return adminServices().db.runTransaction(async (tx) => {
    const ref = collection("commissionAgreements").doc(command.proposalId);
    const doc = await tx.get(ref),
      data = doc.data();
    if (
      !data ||
      data.businessId !== businessId ||
      data.invitationHash !== hash(command.token) ||
      !data.invitationExpiresAt ||
      data.invitationExpiresAt <= new Date().toISOString() ||
      !["invited", "signed"].includes(data.state)
    )
      return denied();
    const record = readAgreement(data)!;
    if (
      !record.proposalSnapshot ||
      record.documentHash !== agreementDocumentHash(record)
    )
      denied();
    if (command.action === "read") return publicAgreement(record);
    const operation = collection("agreementSigningOperations").doc(
      hash(command.token + ":" + command.operationId),
    );
    const fingerprint = hash(JSON.stringify(command)),
      prior = await tx.get(operation);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        throw new AccessError(
          409,
          "agreement-signing",
          "This signing request was already used with different details.",
        );
      return publicAgreement(record);
    }
    if (
      record.state !== "invited" ||
      record.revision !== command.expectedRevision ||
      record.documentHash !== command.documentHash ||
      record.revision >= 100
    )
      throw new AccessError(
        409,
        "agreement-signing",
        "The agreement changed or was already signed. Load the agreement again.",
      );
    const now = new Date().toISOString();
    try {
      assertSigningDate(command.signedDate, now.slice(0, 10));
    } catch (error) {
      throw new AccessError(400, "agreement-signing", (error as Error).message);
    }
    if (record.input.expiresDate && record.input.expiresDate < now.slice(0, 10))
      denied();
    const next = {
      ...record,
      revision: record.revision + 1,
      state: "signed" as const,
      signerName: command.signerName,
      signedDate: command.signedDate,
      signedAt: now,
      updatedAt: now,
      signatureMethod: "client_link" as const,
      consentText: agreementConsent,
      evidence: "Signed through the private invitation link.",
      signedDocumentHash: record.documentHash,
    };
    tx.set(ref, next, { merge: true });
    tx.create(
      ref.collection("history").doc(String(next.revision).padStart(6, "0")),
      {
        ...next,
        businessId,
        proposalId: command.proposalId,
        action: "clientSign",
        note: "Client signed using the private invitation.",
        actorId: "invited-signatory",
        createdAt: now,
      },
    );
    tx.create(operation, {
      businessId,
      fingerprint,
      revision: next.revision,
      createdAt: now,
    });
    return publicAgreement(next);
  });
}
