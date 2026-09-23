import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { FieldPath } from "firebase-admin/firestore";
import { artworkInputSchema, type ArtworkInput, type SharedArtwork, type ArtworkPage } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, cookieName, staffForCookie, type Staff } from "./staff";
import { ensureStaffMode, authResponse } from "./auth-http";

export async function artworkStaff(write = false): Promise<Staff> {
  ensureStaffMode();
  const staff = await staffForCookie((await cookies()).get(cookieName("session"))?.value);
  if (!staff) throw new AccessError(401, "sign-in", "Your session has ended. Sign in again before continuing.");
  if (write ? staff.role !== "super_admin" : !["super_admin", "legal"].includes(staff.role)) throw new AccessError(403, "forbidden", "Your staff role does not allow this action.");
  return staff;
}
export function recordId(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new AccessError(404, "not-found", "Artwork not found.");
  return id;
}
export function operationId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) throw new AccessError(400, "invalid-request", "A valid request ID is required.");
  return value;
}
export function artworkCollection() { return adminServices().db.collection("businesses/" + businessId + "/artworks"); }
export function artworkRef(id: string) { return artworkCollection().doc(recordId(id)); }
export function parseInput(value: unknown): ArtworkInput {
  const result = artworkInputSchema.safeParse(value);
  if (!result.success) throw new AccessError(400, "validation", result.error.issues.map(issue => issue.message).join(" "));
  return result.data;
}
export function onlyKeys(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some(key => !keys.includes(key))) throw new AccessError(400, "validation", "Unexpected artwork fields.");
}
export function projectArtwork(id: string, data: FirebaseFirestore.DocumentData, staff: Staff): SharedArtwork {
  const input = artworkInputSchema.parse(data.input);
  const { internalNotes, ...details } = input;
  return { ...details, ...(staff.role === "super_admin" ? { internalNotes } : {}), id, businessId,
    createdAt: data.createdAt, updatedAt: data.updatedAt, revision: data.revision, coverAssetId: data.coverAssetId ?? null };
}
export async function getArtwork(id: string, staff: Staff) {
  const record = await artworkRef(id).get();
  if (!record.exists) throw new AccessError(404, "not-found", "Artwork not found.");
  return projectArtwork(record.id, record.data()!, staff);
}
export async function listArtwork(staff: Staff, cursor?: string | null): Promise<ArtworkPage> {
  let query = artworkCollection().orderBy(FieldPath.documentId()).limit(51);
  if (cursor) query = query.startAfter(recordId(cursor));
  const result = await query.get();
  const records = result.docs.slice(0, 50);
  return { artworks: records.map(doc => projectArtwork(doc.id, doc.data(), staff)), nextCursor: result.docs.length > 50 ? records.at(-1)!.id : null };
}
export async function createArtwork(body: Record<string, unknown>, staff: Staff) {
  onlyKeys(body, ["input", "operationId"]);
  const input = parseInput(body.input), key = operationId(body.operationId);
  const id = createHash("sha256").update(staff.uid + ":" + key).digest("hex");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const { db } = adminServices(), ref = artworkRef(id);
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.data()!.createHash !== hash) throw new AccessError(409, "conflict", "That save was already used for different details. Reload the artwork before saving again.");
      return;
    }
    const now = new Date().toISOString();
    tx.create(ref, { input, businessId, revision: 1, coverAssetId: null, assetCount: 0,
      createdAt: now, updatedAt: now, createdBy: staff.uid, updatedBy: staff.uid, createHash: hash });
    tx.create(ref.collection("events").doc(randomUUID()), { kind: "created", actorId: staff.uid, at: now, revision: 1 });
  });
  return getArtwork(id, staff);
}
export async function updateArtwork(id: string, body: Record<string, unknown>, staff: Staff) {
  onlyKeys(body, ["input", "revision", "operationId"]);
  const input = parseInput(body.input), key = operationId(body.operationId);
  if (!Number.isSafeInteger(body.revision) || (body.revision as number) < 1) throw new AccessError(400, "validation", "A record version is required.");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const ref = artworkRef(id);
  await adminServices().db.runTransaction(async tx => {
    const record = await tx.get(ref);
    if (!record.exists) throw new AccessError(404, "not-found", "Artwork not found.");
    const data = record.data()!;
    if (data.lastOperation === key && data.updatedBy === staff.uid && data.lastHash === hash) return;
    if (data.revision !== body.revision) throw new AccessError(409, "conflict", "This artwork changed since you opened it. Your edits are still here; open the latest version in another tab before reconciling them.");
    const now = new Date().toISOString(), revision = data.revision + 1;
    tx.update(ref, { input, revision, updatedAt: now, updatedBy: staff.uid, lastOperation: key, lastHash: hash });
    tx.create(ref.collection("events").doc(randomUUID()), { kind: input.status === "archived" ? "archived" : "updated", actorId: staff.uid, at: now, revision });
  });
  return getArtwork(id, staff);
}
export function artworkFailure(error: unknown) {
  if (error instanceof AccessError) return authResponse({ error: error.message, code: error.code }, error.status);
  console.error("Artwork operation failed", { code: (error as { code?: string }).code ?? "service-error" });
  return authResponse({ error: "The artwork service is temporarily unavailable. Your unsaved edits have been kept; please retry.", code: "unavailable" }, 503);
}
