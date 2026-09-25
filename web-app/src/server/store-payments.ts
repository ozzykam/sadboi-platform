import "server-only";
import { createHash } from "node:crypto";
import {
  decideStorePayment, paymentConfirmationSchema, storePaymentOrderId, orderIsDue,
  type PaymentOrderState, type StorePaymentResult, type StorePaymentEvent,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { authResponse } from "./auth-http";
import type { StripeSource } from "./stripe";

const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fail(message: string, status = 409, code = "payment-conflict"): never {
  throw new AccessError(status, code, message);
}

export async function confirmStorePayment(raw: unknown, source?: StripeSource): Promise<StorePaymentResult> {
  const parsed = paymentConfirmationSchema.safeParse(raw);
  if (!parsed.success) fail("Invalid payment confirmation payload.", 400, "invalid-payment");
  const input = parsed.data, digest = fingerprint(source ? { input, source } : input);
  const scope = source ? `${input.provider}:${source.accountId}:${source.mode}` : input.provider;
  const orderRef = collection("storeOrders").doc(input.orderId);
  const eventRef = collection("storePaymentEvents").doc(`${scope}:${input.eventId}`);
  const legacyRef = source ? eventRef : collection("storePaymentEvents").doc(input.eventId);
  const identityRef = collection("storePaymentIdentities").doc(`${scope}:${input.paymentId}`);

  return adminServices().db.runTransaction(async tx => {
    const [event, legacy] = await Promise.all([tx.get(eventRef), tx.get(legacyRef)]);
    const recorded = event.exists ? event : legacy;
    if (recorded.exists) {
      const saved = recorded.data()!, previous = paymentConfirmationSchema.safeParse(saved.input);
      if (!previous.success || fingerprint(source ? { input: previous.data, source: saved.source } : previous.data) !== digest || (event.exists && saved.fingerprint !== digest))
        fail("This provider event ID was already received with different details.", 409, "payment-event-conflict");
      if (event.exists) return { ...saved.result, duplicate: true } as StorePaymentResult;
      // Legacy replay is read-only: do not pretend we know its original effect.
      const order = await tx.get(orderRef);
      if (!order.exists || order.data()!.businessId !== businessId) fail("Order not found.", 404);
      return { id: input.orderId, status: input.status, outcome: "legacy", reason: "historical_event", orderStatus: String(order.data()!.status), duplicate: true };
    }
    const [order, identity] = await Promise.all([tx.get(orderRef), tx.get(identityRef)]);
    if (!order.exists || order.data()!.businessId !== businessId) fail("Order not found.", 404, "payment-order-not-found");
    const data = order.data()!, owner = identity.data();
    if (data.stripeSource ? !source || data.stripeSource.accountId !== source.accountId || data.stripeSource.mode !== source.mode : !!source)
      fail("The payment must come from this order's verified Stripe account.", 403, "payment-source");
    let paymentSucceeded = owner?.status === "succeeded";
    let identityConflict = !!owner && (owner.businessId !== businessId || owner.orderId !== input.orderId || owner.provider !== input.provider ||
      owner.paymentId !== input.paymentId || owner.amountMinor !== input.amountMinor || owner.currency !== input.currency || !["failed", "succeeded"].includes(owner.status));
    // Before introducing a binding, inspect records created by the old handler.
    // Concurrent new claims serialize through identityRef in this transaction.
    if (!identity.exists && !source) {
      const [oldOrders, oldEvents] = await Promise.all([
        tx.get(collection("storeOrders").where("paymentId", "==", input.paymentId).limit(101)),
        tx.get(collection("storePaymentEvents").where("input.paymentId", "==", input.paymentId).limit(101)),
      ]);
      if (oldOrders.size > 100 || oldEvents.size > 100)
        fail("Historical payment identity needs administrative reconciliation.", 503, "payment-history-limit");
      identityConflict = oldOrders.docs.some(doc => doc.id !== input.orderId && (!doc.data().paymentProvider || doc.data().paymentProvider === input.provider)) ||
        oldEvents.docs.some(doc => (!doc.data().input?.provider || doc.data().input?.provider === input.provider) && doc.data().input?.orderId !== input.orderId);
      paymentSucceeded = oldOrders.docs.some(doc => doc.id === input.orderId && doc.data().paymentProvider === input.provider && ["paid", "fulfilled"].includes(doc.data().status)) ||
        oldEvents.docs.some(doc => doc.data().input?.orderId === input.orderId && doc.data().input?.provider === input.provider && doc.data().input?.status === "succeeded");
    }
    // A successfully bound payment with a pending order indicates inconsistent history.
    if (paymentSucceeded && data.status === "pending_payment" && !owner?.resolution && !orderIsDue(data as { status: string; expiresAt?: string })) identityConflict = true;
    const decision = owner?.resolution?.action === "record_refund" && !identityConflict
      ? { outcome: "ignored" as const, reason: "refunded_payment" as const }
      : decideStorePayment(data as PaymentOrderState, input, identityConflict);
    const now = new Date().toISOString();
    const orderStatus = decision.outcome === "applied" ? "paid" : String(data.status);
    const result: StorePaymentResult = { id: input.orderId, status: input.status, ...decision, orderStatus, duplicate: false };
    tx.create(eventRef, { businessId, schemaVersion: 1, input, fingerprint: digest, result,
      outcome: decision.outcome, reason: decision.reason, createdAt: now, source: source ?? null, revision: 0, resolution: null });
    if (!identityConflict && data.totalMinor === input.amountMinor) {
      tx.set(identityRef, { ...owner, businessId, provider: input.provider, paymentId: input.paymentId, orderId: input.orderId,
        amountMinor: input.amountMinor, currency: input.currency,
        status: paymentSucceeded || input.status === "succeeded" ? "succeeded" : "failed",
        source: source ?? null, createdAt: owner?.createdAt ?? now, updatedAt: now });
    }
    if (decision.outcome === "applied") tx.update(orderRef, {
      status: "paid", paymentId: input.paymentId, paymentProvider: input.provider,
      paymentEventId: input.eventId, paymentSchemaVersion: 1, paidAt: now, updatedAt: now,
    });
    else if (decision.outcome === "review") tx.update(orderRef, {
      paymentReviewRequired: true, updatedAt: now,
    });
    return result;
  });
}

export async function storePaymentHistory(rawId: unknown): Promise<{ events: StorePaymentEvent[] }> {
  const parsed = storePaymentOrderId.safeParse(rawId);
  if (!parsed.success) fail("Invalid order reference.", 400);
  const order = await collection("storeOrders").doc(parsed.data).get();
  if (!order.exists || order.data()!.businessId !== businessId) fail("Order not found.", 404);
  const result = await collection("storePaymentEvents").where("input.orderId", "==", parsed.data).limit(201).get();
  if (result.size > 200) fail("Payment history exceeds the current display limit. Ask the administrator for a full export.", 503, "payment-history-limit");
  return { events: result.docs.map(doc => {
    const saved = doc.data(), input = paymentConfirmationSchema.safeParse(saved.input);
    if (!input.success) fail("Historical payment data needs administrative review.", 503, "payment-history-invalid");
    return { id: doc.id, input: input.data, outcome: saved.outcome ?? "legacy", reason: saved.reason ?? "historical_event", receivedAt: String(saved.createdAt),
      source: saved.source ?? null, revision: saved.revision ?? 0, resolution: saved.resolution ?? null } as StorePaymentEvent;
  }).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt) || b.id.localeCompare(a.id)) };
}

export function paymentFailure(error: unknown) {
  if (error instanceof AccessError) return authResponse({ error: error.message, code: error.code }, error.status);
  console.error("Store payment service failed", { code: (error as { code?: string })?.code ?? "unavailable" });
  return authResponse({ error: "Payment records are temporarily unavailable. Retry the same request.", code: "payment-unavailable" }, 503);
}
