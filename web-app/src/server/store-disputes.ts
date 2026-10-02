import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { disputeSnapshotSchema, disputeNeedsSync, disputeBlocksDispatch, readDisputeState, disputeNoteInputSchema, disputeNoteRequestSchema, storePaymentOrderId, type DisputeSnapshot } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { stripeContext, type StripeSource } from "./stripe";
const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const reference = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;
function fail(message: string, status = 409): never { throw new AccessError(status, "order-dispute", message); }
function orderPayment(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data || data.businessId !== businessId) fail("Order not found.", 404);
  if (typeof data.paymentId !== "string" || !/^pi_[a-zA-Z0-9]+$/.test(data.paymentId) || data.paymentProvider !== "stripe" || data.stripeSource?.mode !== "test")
    fail("Disputes require this order's confirmed Stripe test payment. Resolve unmapped or additional payments in Payment history.");
  return data;
}
function snapshot(row: Stripe.Dispute, paymentId: string, chargeId: string): DisputeSnapshot {
  if (row.livemode || reference(row.payment_intent) !== paymentId || reference(row.charge) !== chargeId) fail("Stripe returned a dispute for a different payment or mode.");
  const parsed = disputeSnapshotSchema.safeParse({ id: row.id, paymentId, chargeId, amountMinor: row.amount, currency: row.currency.toUpperCase(),
    status: row.status, reason: row.reason, createdAt: new Date(row.created * 1000).toISOString(),
    dueAt: row.evidence_details.due_by == null ? null : new Date(row.evidence_details.due_by * 1000).toISOString(),
    hasEvidence: row.evidence_details.has_evidence, pastDue: row.evidence_details.past_due,
    submissionCount: row.evidence_details.submission_count, isChargeRefundable: row.is_charge_refundable });
  if (!parsed.success) fail("Stripe dispute details are outside the supported format. Check the Stripe Dashboard.");
  return parsed.data;
}
export async function refreshOrderDisputes(orderId: string, requiredId?: string) {
  if (!storePaymentOrderId.safeParse(orderId).success) fail("Invalid order reference.", 400);
  const ref = collection("storeOrders").doc(orderId), initial = orderPayment((await ref.get()).data()), previous = readDisputeState(initial.disputeState);
  const { client, source } = await stripeContext(initial.stripeSource as StripeSource);
  const payment = await client.paymentIntents.retrieve(initial.paymentId, { expand: ["latest_charge"] });
  if (payment.id !== initial.paymentId || payment.livemode || payment.currency !== "usd" || payment.status !== "succeeded" || payment.amount_received !== initial.totalMinor ||
      payment.metadata.orderId !== orderId || payment.metadata.businessId !== businessId || payment.metadata.accountId !== source.accountId)
    fail("Stripe does not confirm this order's original test payment.");
  const chargeId = reference(payment.latest_charge);
  if (!chargeId) fail("The payment has no verifiable charge.");
  const listed = await client.disputes.list({ payment_intent: payment.id, limit: 21 });
  if (listed.has_more || listed.data.length > 20) fail("This payment has more than 20 disputes. Reconcile its full history in Stripe.");
  const rows = listed.data.map(row => snapshot(row, payment.id, chargeId)).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(rows.map(row => row.id)).size !== rows.length || (requiredId && !rows.some(row => row.id === requiredId)) ||
      previous.rows.some(row => !rows.some(next => next.id === row.id))) fail("The Stripe dispute list is incomplete. Saved history was retained; retry the refresh.");
  return adminServices().db.runTransaction(async tx => {
    const current = await tx.get(ref), data = orderPayment(current.data()), state = readDisputeState(data.disputeState);
    if (data.paymentId !== initial.paymentId || data.totalMinor !== initial.totalMinor || data.stripeSource.accountId !== source.accountId || state.revision !== previous.revision)
      fail("Dispute history changed while Stripe was checked. Refresh again.");
    const refs = rows.map(row => collection("storeDisputes").doc(hash(source.accountId + ":test:" + row.id)));
    const saved = await Promise.all(refs.map(item => tx.get(item)));
    const now = new Date().toISOString();
    for (const [index, row] of rows.entries()) {
      const old = saved[index].data();
      if (old && (old.businessId !== businessId || old.orderId !== orderId || old.source?.accountId !== source.accountId || old.snapshot?.paymentId !== payment.id))
        fail("Dispute ownership needs administrator review.");
      const digest = hash(JSON.stringify(row)), changed = old?.fingerprint !== digest;
      const providerRevision = (old?.providerRevision ?? 0) + (changed ? 1 : 0);
      tx.set(refs[index], { businessId, orderId, source, snapshot: row, fingerprint: digest, providerRevision,
        needsSync: disputeNeedsSync(row.status), updatedAt: now,
        ...(old ? {} : { noteRevision: 0, input: null, createdAt: now }) }, { merge: true });
      if (changed) tx.create(refs[index].collection("providerHistory").doc(String(providerRevision).padStart(8, "0")),
        { snapshot: row, revision: providerRevision, checkedAt: now });
    }
    tx.update(ref, { disputeState: { revision: state.revision + 1, checkedAt: now, rows } });
    return { status: "checked", count: rows.length, held: rows.some(row => disputeBlocksDispatch(row.status)) };
  });
}
export async function orderDisputeHistory(orderId: string) {
  if (!storePaymentOrderId.safeParse(orderId).success) fail("Invalid order reference.", 400);
  return adminServices().db.runTransaction(async tx => {
    const [order, records] = await Promise.all([tx.get(collection("storeOrders").doc(orderId)), tx.get(collection("storeDisputes").where("orderId", "==", orderId).limit(21))]);
    const data = order.data();
    if (!data || data.businessId !== businessId) fail("Order not found.", 404);
    if (records.size > 20) fail("This order needs an administrator export before further updates.");
    const state = readDisputeState(data.disputeState);
    const rows = await Promise.all(records.docs.map(async doc => {
      const row = doc.data();
      if (row.businessId !== businessId || row.source?.accountId !== data.stripeSource?.accountId || row.source?.mode !== "test" || row.snapshot?.paymentId !== data.paymentId)
        fail("Dispute ownership needs administrator review.");
      const [notes, events] = await Promise.all([tx.get(doc.ref.collection("notes").orderBy("revision", "desc").limit(30)), tx.get(doc.ref.collection("providerHistory").orderBy("revision", "desc").limit(30))]);
      return { id: doc.id, snapshot: disputeSnapshotSchema.parse(row.snapshot), noteRevision: Number(row.noteRevision), providerRevision: Number(row.providerRevision),
        input: row.input ? disputeNoteInputSchema.parse(row.input) : null,
        notes: notes.docs.map(note => ({ revision: Number(note.data().revision), input: disputeNoteInputSchema.parse(note.data().input), createdAt: String(note.data().createdAt) })),
        events: events.docs.map(event => ({ revision: Number(event.data().revision), snapshot: disputeSnapshotSchema.parse(event.data().snapshot), checkedAt: String(event.data().checkedAt) })),
      };
    }));
    return { rows: rows.sort((a, b) => (a.snapshot.dueAt ?? "z").localeCompare(b.snapshot.dueAt ?? "z")), checkedAt: state.checkedAt,
      held: state.rows.some(row => disputeBlocksDispatch(row.status)), accountId: typeof data.stripeSource?.accountId === "string" ? data.stripeSource.accountId : null,
      paymentMapped: data.paymentProvider === "stripe" && typeof data.paymentId === "string" && data.stripeSource?.mode === "test" };
  });
}
export async function saveDisputeNote(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin") fail("Only super admins can manage dispute notes.", 403);
  const parsed = disputeNoteRequestSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400);
  const input = parsed.data, fingerprint = hash(JSON.stringify(input));
  const ref = collection("storeDisputes").doc(input.id), op = collection("disputeNoteOperations").doc(hash(staff.uid + ":" + input.operationId));
  return adminServices().db.runTransaction(async tx => {
    const old = await tx.get(op);
    if (old.exists) { if (old.data()!.fingerprint !== fingerprint) fail("This request ID was used for different notes."); return old.data()!.result as { revision: number }; }
    const [saved, order] = await Promise.all([tx.get(ref), tx.get(collection("storeOrders").doc(input.orderId))]);
    const row = saved.data(), data = orderPayment(order.data());
    if (!row || row.businessId !== businessId || row.orderId !== input.orderId || row.source?.accountId !== data.stripeSource.accountId || row.snapshot?.paymentId !== data.paymentId)
      fail("Dispute not found for this order.", 404);
    if (row.noteRevision !== input.expectedRevision || input.expectedRevision >= 200) fail("Notes changed or reached their update limit. Reload dispute history.");
    const revision = input.expectedRevision + 1, now = new Date().toISOString(), result = { revision };
    const event = { businessId, orderId: input.orderId, input: input.input, revision, actorId: staff.uid, createdAt: now };
    tx.update(ref, { input: input.input, noteRevision: revision });
    tx.create(ref.collection("notes").doc(String(revision).padStart(4, "0")), event);
    tx.create(op, { fingerprint, result, createdAt: now, actorId: staff.uid });
    tx.create(collection("inventoryAudit").doc(op.id), { ...event, resource: "storeDisputes", recordId: ref.id, kind: "dispute_note_saved" });
    return result;
  });
}
export async function handleDisputeWebhook(delivered: Stripe.Dispute, source: StripeSource) {
  if (!/^du_[a-zA-Z0-9]+$/.test(delivered.id)) fail("Invalid dispute reference.", 400);
  const { client } = await stripeContext(source), dispute = await client.disputes.retrieve(delivered.id);
  const pi = reference(dispute.payment_intent);
  if (dispute.livemode || !pi) fail("The dispute does not identify a test payment.");
  const payment = await client.paymentIntents.retrieve(pi), orderId = payment.metadata.orderId;
  if (payment.livemode || payment.metadata.businessId !== businessId || payment.metadata.accountId !== source.accountId || !storePaymentOrderId.safeParse(orderId).success)
    return { received: true, ignored: true };
  const data = (await collection("storeOrders").doc(orderId).get()).data();
  // Additional or unaccepted late payments remain in the payment-review workflow.
  if (!data || data.paymentId !== pi || data.stripeSource?.accountId !== source.accountId) return { received: true, ignored: true };
  await refreshOrderDisputes(orderId, dispute.id);
  return { received: true };
}
export async function processOrderDisputes() {
  const cursorRef = collection("inventoryState").doc("orderDisputes"), cursor = (await cursorRef.get()).data()?.cursor;
  let query = collection("storeDisputes").where("needsSync", "==", true).orderBy("__name__").limit(3);
  if (typeof cursor === "string") query = query.startAfter(cursor);
  let batch = await query.get();
  if (batch.empty && cursor) batch = await collection("storeDisputes").where("needsSync", "==", true).orderBy("__name__").limit(3).get();
  const results = await Promise.all([...new Set(batch.docs.map(doc => String(doc.data().orderId)))].map(async orderId => {
    try { return { orderId, ...await refreshOrderDisputes(orderId) }; } catch { return { orderId, status: "retry_required" }; }
  }));
  await cursorRef.set({ cursor: batch.size === 3 ? batch.docs.at(-1)!.id : null, lastRunAt: new Date().toISOString(), results });
  return { processed: results.length, results };
}
