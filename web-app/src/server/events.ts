import "server-only";
import { createHash } from "node:crypto";
import {
  appearanceSchema,
  applyStudioEvent,
  eventAppearance,
  eventLocalNow,
  studioEventCommandSchema,
  studioEventInputSchema,
  type PublicAppearance,
  type StudioEventRecord,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
const c = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "events", message);
}
function access(staff: Staff, write = false) {
  if (
    write
      ? staff.role !== "super_admin"
      : !["super_admin", "accounting"].includes(staff.role)
  )
    fail(
      write
        ? "Only super admins manage events."
        : "Event planning access is restricted.",
      403,
    );
}
function eventId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    fail("Invalid event reference.", 400);
  return value;
}
function readEvent(doc: FirebaseFirestore.DocumentSnapshot): StudioEventRecord {
  const data = doc.data();
  if (!data || data.businessId !== businessId) fail("Event not found.", 404);
  if (
    !Number.isInteger(data.revision) ||
    data.revision < 1 ||
    data.revision > 200
  )
    fail("Event history needs administrator review.");
  return {
    id: doc.id,
    revision: data.revision,
    input: studioEventInputSchema.parse(data.input),
    published: data.published ? appearanceSchema.parse(data.published) : null,
    publishedAt: data.publishedAt ?? null,
    completionDates: data.completionDates ?? {},
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
  };
}
export async function eventDirectory(staff: Staff) {
  access(staff);
  const docs = await c("studioEvents").limit(501).get();
  if (docs.size > 500)
    fail("Event planning needs pagination before loading more records.", 503);
  return docs.docs
    .map(readEvent)
    .sort(
      (a, b) =>
        (a.input.startDate || "9999").localeCompare(
          b.input.startDate || "9999",
        ) || a.input.title.localeCompare(b.input.title),
    );
}
export async function eventDetail(rawId: unknown, staff: Staff) {
  access(staff);
  const id = eventId(rawId),
    ref = c("studioEvents").doc(id);
  return adminServices().db.runTransaction(async (tx) => {
    const [doc, history] = await Promise.all([
      tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(200)),
    ]);
    return {
      record: readEvent(doc),
      history: history.docs.map((row) => ({
        revision: Number(row.data().revision),
        action: String(row.data().action),
        note: String(row.data().note),
        createdAt: String(row.data().createdAt),
      })),
    };
  });
}
export async function publicAppearances(
  now = new Date().toISOString(),
): Promise<PublicAppearance[]> {
  const docs = await c("studioEvents")
    .where("isPublished", "==", true)
    .limit(501)
    .get();
  if (docs.size > 500)
    fail("The appearances schedule is temporarily unavailable.", 503);
  return docs.docs
    .map(readEvent)
    .filter(
      (record) =>
        record.input.status === "confirmed" &&
        !record.input.archived &&
        record.published &&
        record.published.endDate >=
          eventLocalNow(now, record.published.timezone).date &&
        JSON.stringify(eventAppearance(record.input)) ===
          JSON.stringify(record.published),
    )
    .map((record) => ({
      id: record.id,
      ...appearanceSchema.parse(record.published),
    }))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.startTime.localeCompare(b.startTime) ||
        a.title.localeCompare(b.title),
    );
}
export async function saveEvent(raw: unknown, staff: Staff) {
  access(staff, true);
  const parsed = studioEventCommandSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const command = parsed.data,
    operation = c("eventOperations").doc(
      hash(staff.uid + ":" + command.operationId),
    ),
    fingerprint = hash(JSON.stringify(command));
  return adminServices().db.runTransaction(async (tx) => {
    const prior = await tx.get(operation);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail("This request ID was used for different event details.");
      return prior.data()!.result as { id: string; revision: number };
    }
    const ref = c("studioEvents").doc(command.id),
      doc = await tx.get(ref),
      old = doc.exists ? readEvent(doc) : null;
    const countRef = c("eventState").doc("counts"),
      countDoc = !old ? await tx.get(countRef) : null,
      count = countDoc?.data()?.total ?? 0;
    if (!old && (!Number.isInteger(count) || count < 0 || count >= 500))
      fail("The 500-event planning limit has been reached.");
    const now = new Date().toISOString();
    let record: StudioEventRecord;
    try {
      record = applyStudioEvent(old, command, now);
    } catch (error) {
      fail((error as Error).message);
    }
    const { id, ...fields } = record;
    tx.set(ref, { ...fields, businessId, isPublished: !!record.published });
    tx.create(
      ref.collection("history").doc(String(record.revision).padStart(6, "0")),
      {
        ...fields,
        businessId,
        action: command.action,
        note: command.note,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    if (!old) tx.set(countRef, { total: count + 1 });
    const result = { id, revision: record.revision };
    tx.create(operation, { businessId, fingerprint, result, createdAt: now });
    return result;
  });
}
