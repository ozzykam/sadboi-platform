import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { orderRefundRequestSchema, readOrderRefundState, storePaymentOrderId, summarizeRefunds, type ProviderRefund } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { stripeContext, type StripeSource } from "./stripe";
import { readFulfillment } from "./fulfillment";
const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const paymentId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;
function fail(message: string, status = 409): never { throw new AccessError(status, "order-refund", message); }
type SavedRefund = { businessId: string; orderId: string; paymentId: string; source: StripeSource; amountMinor: number; reason: string;
  status: string; active: boolean; providerId: string | null; fingerprint: string; createdAt: string; actorId: string;
  params: Stripe.RefundCreateParams; key: string };
function validOrder(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data || data.businessId !== businessId) fail("Order not found.", 404);
  if (!data.paymentId || data.paymentProvider !== "stripe" || !data.stripeSource || data.stripeSource.mode !== "test" || !Number.isSafeInteger(data.totalMinor) || data.totalMinor < 1)
    fail("This order has no verified Stripe test payment. Resolve payment review before refunding it.");
  return data;
}
async function providerSnapshot(orderId: string, data: FirebaseFirestore.DocumentData) {
  const { client, source } = await stripeContext(data.stripeSource as StripeSource);
  const payment = await client.paymentIntents.retrieve(data.paymentId, { expand: ["latest_charge"] });
  if (payment.id !== data.paymentId || payment.livemode || payment.currency !== "usd" || payment.status !== "succeeded" || payment.amount_received !== data.totalMinor ||
      payment.metadata.orderId !== orderId || payment.metadata.businessId !== businessId || payment.metadata.accountId !== source.accountId)
    fail("Stripe does not confirm this order's original test payment.");
  const charge = payment.latest_charge;
  if (!charge || typeof charge === "string" || charge.disputed) fail("The charge needs review before refunds can be managed.");
  const listed = await client.refunds.list({ payment_intent: payment.id, limit: 100 });
  if (listed.has_more) fail("This payment has more than 100 refunds and needs administrator reconciliation.");
  const rows: ProviderRefund[] = listed.data.map(refund => {
    if (paymentId(refund.payment_intent) !== payment.id || refund.currency !== "usd") fail("Stripe returned a refund for a different payment.");
    return { id: refund.id, amountMinor: refund.amount, status: refund.status as ProviderRefund["status"] };
  });
  const totals = summarizeRefunds(rows, data.totalMinor);
  return { client, source, rows, raw: listed.data, ...totals };
}

// Read before the provider request and compare again when applying it. A slow
// lookup must never overwrite newer refund observations or a newly prepared job.
async function applySnapshot(orderId: string, revision: number, snapshot: Awaited<ReturnType<typeof providerSnapshot>>, job?: { id: string; status: string; providerId: string | null }) {
  const ref = collection("storeOrders").doc(orderId);
  return adminServices().db.runTransaction(async tx => {
    const order = await tx.get(ref), data = validOrder(order.data()), state = readOrderRefundState(data.refundState);
    if (state.revision !== revision) fail("Refund history changed. Refresh to see the latest result.");
    const saved = job ? await tx.get(collection("storeOrderRefunds").doc(job.id)) : null;
    if (job && (!saved?.exists || saved.data()!.orderId !== orderId || state.activeId !== job.id)) fail("The refund request changed. Reload the history.");
    const now = new Date().toISOString(), active = !!job && ["prepared", "pending", "requires_action", "needs_review"].includes(job.status);
    const next = { revision: state.revision + 1, activeId: job ? active ? job.id : null : state.activeId,
      refundedMinor: snapshot.refundedMinor, pendingMinor: snapshot.pendingMinor, refunds: snapshot.rows, checkedAt: now };
    tx.update(ref, { refundState: next });
    if (job && saved) {
      tx.update(saved.ref, { status: job.status, providerId: job.providerId, active, updatedAt: now });
      if (saved.data()!.status !== job.status || saved.data()!.providerId !== job.providerId)
        tx.create(collection("inventoryAudit").doc(), { businessId, resource: "storeOrders", recordId: orderId, kind: "refund_status_updated",
          requestId: job.id, before: saved.data()!.status, after: job.status, providerId: job.providerId, createdAt: now });
    }
    return next;
  });
}

export async function processOrderRefund(id: string) {
  const ref = collection("storeOrderRefunds").doc(id), saved = await ref.get(), job = saved.data() as SavedRefund | undefined;
  if (!job || job.businessId !== businessId) fail("Refund request not found.", 404);
  if (!job.active) return { id, status: job.status };
  const order = await collection("storeOrders").doc(job.orderId).get(), data = validOrder(order.data()), state = readOrderRefundState(data.refundState);
  if (state.activeId !== id || job.paymentId !== data.paymentId || job.source.accountId !== data.stripeSource.accountId || job.source.mode !== "test") fail("Refund ownership needs review.");
  if (!Number.isSafeInteger(job.amountMinor) || job.amountMinor < 1 || job.amountMinor > data.totalMinor || job.key !== "sadboi-refund-" + id ||
      !job.params || Object.keys(job.params).sort().join(",") !== "amount,metadata,payment_intent" || job.params.amount !== job.amountMinor || job.params.payment_intent !== job.paymentId ||
      !job.params.metadata || Object.keys(job.params.metadata).sort().join(",") !== "businessId,orderId,sadboiRefundId" ||
      job.params.metadata.businessId !== businessId || job.params.metadata.orderId !== order.id || job.params.metadata.sadboiRefundId !== id)
    fail("The saved refund command needs administrator review before it can be submitted.");
  let snapshot = await providerSnapshot(order.id, data);
  const matches = snapshot.raw.filter(item => item.id === job.providerId || item.metadata?.sadboiRefundId === id);
  if (matches.length > 1) fail("Multiple provider refunds match this request. Administrator review is required.");
  let refund = matches[0];
  if (!refund && job.providerId) fail("The saved provider refund is missing. Administrator review is required.");
  if (!refund && job.status === "prepared") {
    // Recovery first searches provider metadata, even after the idempotency
    // retention window. Never blindly repeat an old uncertain money command.
    if (Date.now() - Date.parse(job.createdAt) > 23 * 60 * 60 * 1000 || !Number.isFinite(Date.parse(job.createdAt))) {
      await applySnapshot(order.id, state.revision, snapshot, { id, status: "needs_review", providerId: null });
      return { id, status: "needs_review" };
    }
    try { refund = await snapshot.client.refunds.create(job.params, { idempotencyKey: job.key }); }
    catch (error) {
      // Only explicit amount rejections can release this prepared request.
      // Network, provider and idempotency errors retain it for same-key recovery.
      if (["charge_already_refunded", "amount_too_large"].includes(String((error as { code?: string }).code))) {
        snapshot = await providerSnapshot(order.id, data);
        await applySnapshot(order.id, state.revision, snapshot, { id, status: "rejected", providerId: null });
        return { id, status: "rejected" };
      }
      throw error;
    }
    snapshot = await providerSnapshot(order.id, data);
  }
  if (!refund) return { id, status: job.status };
  if (refund.amount !== job.amountMinor || paymentId(refund.payment_intent) !== job.paymentId || refund.currency !== "usd" ||
      refund.metadata?.sadboiRefundId !== id || refund.metadata?.orderId !== order.id || refund.metadata?.businessId !== businessId)
    fail("The provider refund does not match the saved request. Administrator review is required.");
  const current = snapshot.rows.find(row => row.id === refund.id);
  if (!current || current.amountMinor !== job.amountMinor) fail("The latest provider list does not contain the matching refund. Refresh again.");
  await applySnapshot(order.id, state.revision, snapshot, { id, status: current.status, providerId: refund.id });
  return { id, status: current.status };
}

export async function requestOrderRefund(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin") fail("Only super admins can issue test refunds.", 403);
  const parsed = orderRefundRequestSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400);
  const input = parsed.data, fingerprint = hash(JSON.stringify(input)), id = hash(staff.uid + ":" + input.operationId);
  const ref = collection("storeOrderRefunds").doc(id), old = await ref.get();
  if (old.exists) {
    if (old.data()!.fingerprint !== fingerprint) fail("This request ID was used for a different refund.");
    return resumePreparedRefund(id);
  }
  const orderRef = collection("storeOrders").doc(input.orderId), initial = validOrder((await orderRef.get()).data());
  const snapshot = await providerSnapshot(input.orderId, initial);
  if (snapshot.rows.length >= 100) fail("This payment has reached the supported refund history limit. Administrator reconciliation is required.");
  if (snapshot.pendingMinor || input.amountMinor > snapshot.availableMinor) fail("This amount exceeds the available balance or another refund is pending. Refresh Stripe refund status.");
  await adminServices().db.runTransaction(async tx => {
    const [prior, order, fulfillment, history] = await Promise.all([tx.get(ref), tx.get(orderRef), tx.get(collection("fulfillments").doc(input.orderId)), tx.get(collection("storeOrderRefunds").where("orderId", "==", input.orderId).limit(101))]);
    if (prior.exists) { if (prior.data()!.fingerprint !== fingerprint) fail("This request ID was used for a different refund."); return; }
    if (history.size >= 100) fail("This order has reached the supported refund request limit. Administrator reconciliation is required.");
    const data = validOrder(order.data()), state = readOrderRefundState(data.refundState), savedFulfillment = readFulfillment(fulfillment.data(), input.orderId);
    if (state.revision !== input.expectedRevision || state.activeId) fail("Another refund changed this order. Reload history before issuing a new refund.");
    if (data.paymentId !== initial.paymentId || data.stripeSource.accountId !== initial.stripeSource.accountId || data.paymentReviewRequired)
      fail("Resolve the order's payment review before issuing a refund.");
    if (!savedFulfillment || !["cancelled", "shipped", "delivered"].includes(savedFulfillment.input.status))
      fail("Cancel unshipped fulfillment before refunding it. Dispatched or collected orders can be refunded without changing stock.");
    const now = new Date().toISOString();
    const params: Stripe.RefundCreateParams = { payment_intent: data.paymentId, amount: input.amountMinor,
      metadata: { sadboiRefundId: id, orderId: order.id, businessId } };
    tx.create(ref, { businessId, orderId: order.id, paymentId: data.paymentId, source: snapshot.source, amountMinor: input.amountMinor, reason: input.reason,
      fingerprint, params, key: "sadboi-refund-" + id, status: "prepared", active: true, providerId: null, actorId: staff.uid, createdAt: now, updatedAt: now });
    tx.update(order.ref, { refundState: { revision: state.revision + 1, activeId: id, refundedMinor: snapshot.refundedMinor,
      pendingMinor: snapshot.pendingMinor, refunds: snapshot.rows, checkedAt: now } });
    tx.create(collection("inventoryAudit").doc(id), { businessId, resource: "storeOrders", recordId: order.id, kind: "refund_requested",
      amountMinor: input.amountMinor, reason: input.reason, actorId: staff.uid, createdAt: now });
  });
  // The durable request survives disconnects and is resumed by refresh/worker.
  return resumePreparedRefund(id);
}

async function resumePreparedRefund(id: string) {
  try { return await processOrderRefund(id); }
  catch { throw new AccessError(503, "refund-retry", "The refund request is saved, but its provider result is not yet confirmed. Retry the same request or refresh Stripe refund status."); }
}

export async function refreshOrderRefunds(orderId: string) {
  if (!storePaymentOrderId.safeParse(orderId).success) fail("Invalid order reference.", 400);
  const data = validOrder((await collection("storeOrders").doc(orderId).get()).data()), state = readOrderRefundState(data.refundState);
  if (state.activeId) return processOrderRefund(state.activeId);
  await applySnapshot(orderId, state.revision, await providerSnapshot(orderId, data));
  return { status: "checked" };
}
export async function processOrderRefunds() {
  const stateRef = collection("inventoryState").doc("orderRefunds"), cursor = (await stateRef.get()).data()?.cursor;
  let query = collection("storeOrderRefunds").where("active", "==", true).orderBy("__name__").limit(5);
  if (typeof cursor === "string") query = query.startAfter(cursor);
  let batch = await query.get();
  if (batch.empty && cursor) batch = await collection("storeOrderRefunds").where("active", "==", true).orderBy("__name__").limit(5).get();
  const results = await Promise.all(batch.docs.map(async doc => {
    try { return await processOrderRefund(doc.id); } catch { return { id: doc.id, status: "retry_required" }; }
  }));
  await stateRef.set({ cursor: batch.size === 5 ? batch.docs.at(-1)!.id : null, lastRunAt: new Date().toISOString(), results });
  return { processed: batch.size, results };
}
export async function handleRefundWebhook(delivered: Stripe.Refund, source: StripeSource) {
  const { client } = await stripeContext(source), refund = await client.refunds.retrieve(delivered.id);
  const pi = paymentId(refund.payment_intent);
  if (!pi) return { received: true, ignored: true };
  const payment = await client.paymentIntents.retrieve(pi), orderId = payment.metadata.orderId;
  if (payment.livemode || payment.metadata.businessId !== businessId || payment.metadata.accountId !== source.accountId || !storePaymentOrderId.safeParse(orderId).success)
    return { received: true, ignored: true };
  const data = (await collection("storeOrders").doc(orderId).get()).data();
  // Late/additional payments still belong to the existing payment-review flow.
  if (!data || data.paymentId !== pi || data.stripeSource?.accountId !== source.accountId) return { received: true, ignored: true };
  await refreshOrderRefunds(orderId);
  return { received: true };
}
