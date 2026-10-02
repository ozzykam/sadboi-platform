import "server-only";
import { createHash } from "node:crypto";
import {
  publicInquirySchema,
  publicInquiryStatus,
  type PublicInquiryStatus,
} from "@sadboi/core";
import { adminServices, authConfig } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
const db = () => adminServices().db;
const c = (name: string) => db().collection(`businesses/${businessId}/${name}`);
const fail = (message: string, status = 409): never => {
  throw new AccessError(status, "public-inquiry", message);
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function opId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value))
    fail("A valid request ID is required.", 400);
  return value as string;
}
export async function savePublicInquiry(raw: unknown, request: Request) {
  if (
    request.headers.get("origin") !== authConfig().origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    fail("Refresh the page and try again.", 403);
  const rawRecord =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const { operationId, ...inputRaw } = rawRecord;
  const parsed = publicInquirySchema.safeParse(inputRaw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const input = parsed.data,
    id = opId(operationId),
    ref = c("publicInquiries").doc(id),
    op = c("publicInquiryOperations").doc(hash(id)),
    fingerprint = hash(JSON.stringify(input));
  return db().runTransaction(async (tx) => {
    const prior = await tx.get(op);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail("This request ID was already used for different details.");
      return prior.data()!.result;
    }
    const existing = await tx.get(ref);
    if (existing.exists) return { id, duplicate: true };
    const count =
      (await tx.get(c("publicInquiryState").doc("counts"))).data()?.total ?? 0;
    if (!Number.isSafeInteger(count) || count >= 10000)
      fail(
        "The studio inbox is temporarily full. Please try again another way.",
        503,
      );
    const now = new Date().toISOString(),
      record = {
        businessId,
        input,
        status: "new" as const,
        archived: false,
        lastNote: "",
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
    tx.create(ref, record);
    tx.set(
      c("publicInquiryState").doc("counts"),
      { total: count + 1 },
      { merge: true },
    );
    tx.create(op, {
      businessId,
      fingerprint,
      result: { id, duplicate: false },
      createdAt: now,
    });
    return { id, duplicate: false };
  });
}
function ensureRead(staff: Staff) {
  if (!["super_admin", "accounting"].includes(staff.role))
    fail("Public inquiries are restricted.", 403);
}
function project(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  if (data.businessId !== businessId)
    fail("Inquiry needs administrator review.");
  const input = publicInquirySchema.parse(data.input);
  if (!publicInquiryStatus.includes(data.status))
    fail("Inquiry status needs review.");
  const state = data.status as PublicInquiryStatus;
  return {
    id: doc.id,
    ...input,
    status: state,
    archived: data.archived === true,
    lastNote: typeof data.lastNote === "string" ? data.lastNote : "",
    revision: Number(data.revision),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
  };
}
export async function publicInquiryDirectory(staff: Staff) {
  ensureRead(staff);
  const result = await c("publicInquiries")
    .orderBy("createdAt", "desc")
    .limit(501)
    .get();
  if (result.size > 500)
    fail("This inbox needs pagination before loading more inquiries.", 503);
  return { inquiries: result.docs.map(project) };
}
export async function updatePublicInquiry(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    fail("Only super admins can update public inquiries.", 403);
  const body = raw as Record<string, unknown>,
    rawId = body.id,
    rawRevision = body.revision,
    rawStatus = body.status,
    rawArchived = body.archived;
  if (
    typeof rawId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(rawId) ||
    typeof rawRevision !== "number" ||
    !Number.isInteger(rawRevision) ||
    typeof rawStatus !== "string" ||
    !publicInquiryStatus.includes(rawStatus as PublicInquiryStatus) ||
    (rawArchived !== undefined && typeof rawArchived !== "boolean")
  )
    fail("Invalid inquiry update.", 400);
  const id = rawId as string,
    revision = rawRevision as number,
    status = rawStatus as PublicInquiryStatus,
    archived = rawArchived as boolean | undefined;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (note.length < 3) fail("Add a short private update note.", 400);
  const ref = c("publicInquiries").doc(id);
  return db().runTransaction(async (tx) => {
    const saved = await tx.get(ref),
      data = saved.data();
    if (!data || data.businessId !== businessId)
      fail("Inquiry not found.", 404);
    const current = data!;
    if (current.revision !== revision)
      fail("This inquiry changed. Reload the inbox.");
    const now = new Date().toISOString(),
      nextArchived = archived ?? current.archived === true;
    tx.update(ref, {
      status,
      archived: nextArchived,
      revision: revision + 1,
      updatedAt: now,
      updatedBy: staff.uid,
      lastNote: note,
    });
    tx.create(
      ref.collection("history").doc(String(revision + 1).padStart(4, "0")),
      {
        businessId,
        status,
        archived: nextArchived,
        note,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    return { id, revision: revision + 1 };
  });
}
