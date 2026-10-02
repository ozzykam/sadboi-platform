import "server-only";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { orderIsDue, storePaymentOrderId, readCheckoutTotals } from "@sadboi/core";
import { adminServices, authConfig } from "./firebase";
import { AccessError, businessId } from "./staff";
import { stripeContext, type StripeSource } from "./stripe";
import { requireOrderToken, closePendingOrder } from "./order-lifecycle";
const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);

export type CheckoutState = "not_started" | "open" | "processing" | "paid" | "expired" | "unavailable";

// Call only after authorizing access to the order. The saved account and Session
// are the authority; return URLs and customer-supplied payment IDs are never used.
export async function reconcileStripeCheckout(orderId: string): Promise<CheckoutState> {
  const data = (await collection("storeOrders").doc(orderId).get()).data();
  if (!data || data.businessId !== businessId) throw new AccessError(404, "order-not-found", "Order not found.");
  if (["paid", "fulfilled"].includes(data.status)) return "paid";
  if (!data.stripeSource && !data.stripeCheckout) return "not_started";
  if (!data.stripeCheckout?.sessionId) return "unavailable";
  const { client, source } = await stripeContext(data.stripeSource);
  const session = await client.checkout.sessions.retrieve(data.stripeCheckout.sessionId);
  if (session.id !== data.stripeCheckout.sessionId || session.livemode || session.mode !== "payment" ||
      data.stripeSource?.accountId !== source.accountId || data.stripeSource?.mode !== "test" ||
      session.metadata?.orderId !== orderId || session.metadata?.businessId !== businessId ||
      session.metadata?.accountId !== source.accountId || session.client_reference_id !== orderId ||
      session.currency !== "usd" || session.amount_total !== data.totalMinor)
    throw new AccessError(409, "stripe-order", "Stripe session does not match its saved order.");
  if (session.payment_status === "paid") {
    const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentId) throw new AccessError(409, "stripe-payment", "The Stripe payment reference is missing.");
    const { confirmStorePayment } = await import("./store-payments");
    // One durable verification receipt, sharing the webhook's transactional
    // payment identity and late-payment policy. Repeated refreshes are harmless.
    const eventId = "lookup_" + createHash("sha256").update(session.id + ":paid").digest("hex");
    await confirmStorePayment({ eventId, orderId, provider: "stripe", paymentId,
      amountMinor: session.amount_total, currency: "USD", status: "succeeded" }, source, "stripe_lookup");
    return "paid";
  }
  return session.status === "open" ? "open" : session.status === "expired" ? "expired" : "processing";
}

export async function startStripeCheckout(raw: Record<string, unknown>) {
  const parsed = storePaymentOrderId.safeParse(raw.orderId);
  if (!parsed.success || Object.keys(raw).some(key => !["orderId", "token"].includes(key))) throw new AccessError(400, "invalid-checkout", "Invalid order access.");
  const ref = collection("storeOrders").doc(parsed.data);
  const snapshot = await ref.get(), data = snapshot.data();
  if (!data) throw new AccessError(404, "order-not-found", "Order not found.");
  requireOrderToken(data, raw.token);
  const { client, source } = await stripeContext(data.stripeSource);
  const prepared = await adminServices().db.runTransaction(async tx => {
    const order = await tx.get(ref), d = order.data()!;
    requireOrderToken(d, raw.token);
    if (d.businessId !== businessId || d.status !== "pending_payment" || orderIsDue(d as { status: string; expiresAt?: string }))
      throw new AccessError(409, "order-closed", "This order is no longer awaiting payment. Refresh its status.");
    if (d.stripeSource && (d.stripeSource.accountId !== source.accountId || d.stripeSource.mode !== source.mode))
      throw new AccessError(409, "stripe-account", "This order belongs to another Stripe account.");
    if (d.stripeCheckout) return d.stripeCheckout as { key: string; params: Stripe.Checkout.SessionCreateParams; sessionId?: string; url?: string };
    if (!Number.isSafeInteger(d.totalMinor) || d.totalMinor < 50 || d.totalMinor > 99_999_999)
      throw new AccessError(409, "stripe-amount", "This amount is outside the supported test checkout range.");
    const pricing = readCheckoutTotals(d.pricing, d.totalMinor);
    const origin = authConfig().origin;
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment", payment_method_types: ["card"], customer_email: d.input.customerEmail,
      client_reference_id: order.id, metadata: { orderId: order.id, businessId, accountId: source.accountId },
      payment_intent_data: { metadata: { orderId: order.id, businessId, accountId: source.accountId } },
      line_items: pricing ? [
        { quantity: 1, price_data: { currency: "usd", unit_amount: pricing.subtotalMinor, product_data: { name: `Sadboi items · ${d.orderNumber}` } } },
        ...(pricing.shippingMinor ? [{ quantity: 1, price_data: { currency: "usd", unit_amount: pricing.shippingMinor, product_data: { name: pricing.deliveryLabel } } }] : []),
      ] : [{ quantity: 1, price_data: { currency: "usd", unit_amount: d.totalMinor, product_data: { name: `Sadboi order ${d.orderNumber}` } } }],
      // Stripe requires >=30 minutes from Session creation; our order deadline is
      // independent and never extended. The expiry worker closes the Session too.
      expires_at: Math.ceil(Date.now() / 1000) + 31 * 60,
      success_url: `${origin}/orders/${order.id}?checkout=returned`, cancel_url: `${origin}/orders/${order.id}?checkout=back`,
    };
    const key = "sadboi-checkout-" + createHash("sha256").update(source.accountId + ":" + order.id).digest("hex");
    const checkout = { key, params, state: "creating", createdAt: new Date().toISOString() };
    tx.update(ref, { stripeSource: source, stripeCheckout: checkout });
    return checkout as { key: string; params: Stripe.Checkout.SessionCreateParams; sessionId?: string; url?: string };
  });
  const session = prepared.sessionId ? await client.checkout.sessions.retrieve(prepared.sessionId)
    : await client.checkout.sessions.create(prepared.params, { idempotencyKey: prepared.key });
  if (session.livemode || session.client_reference_id !== ref.id || session.amount_total !== data.totalMinor)
    throw new AccessError(409, "stripe-session", "The returned checkout does not match this test order.");
  const closed = await adminServices().db.runTransaction(async tx => {
    const order = await tx.get(ref), d = order.data()!;
    tx.update(ref, { "stripeCheckout.sessionId": session.id, "stripeCheckout.url": session.url ?? null, "stripeCheckout.state": session.status });
    return d.status !== "pending_payment" || orderIsDue(d as { status: string; expiresAt?: string });
  });
  if (closed) {
    if (session.status === "open") await client.checkout.sessions.expire(session.id);
    throw new AccessError(409, "order-closed", "The order closed before checkout opened. Refresh its status.");
  }
  if (session.status !== "open" || !session.url || new URL(session.url).hostname !== "checkout.stripe.com")
    throw new AccessError(409, "stripe-session-closed", "Checkout is no longer open. Refresh the order to see the payment result.");
  return { url: session.url, testMode: true };
}

export async function expireStripeSession(orderId: string) {
  const ref = collection("storeOrders").doc(orderId), data = (await ref.get()).data();
  if (!data?.stripeSource) return;
  if (["paid", "fulfilled"].includes(data.status)) { await ref.update({ stripeExpiryPending: false }); return; }
  if (!["expired", "cancelled"].includes(data.status)) return;
  const { client } = await stripeContext(data.stripeSource as StripeSource);
  // Recover an interrupted create through the same idempotency key. Never
  // create another Session after Stripe's 24-hour idempotency retention window.
  if (!data.stripeCheckout?.sessionId && Date.now() - Date.parse(data.stripeCheckout?.createdAt) > 23 * 60 * 60 * 1000)
    throw new AccessError(409, "stripe-recovery", "An administrator must reconcile the interrupted Stripe session.");
  const session = data.stripeCheckout?.sessionId ? await client.checkout.sessions.retrieve(data.stripeCheckout.sessionId)
    : await client.checkout.sessions.create(data.stripeCheckout.params, { idempotencyKey: data.stripeCheckout.key });
  if (session.livemode) throw new AccessError(409, "stripe-mode", "Live Stripe sessions are not enabled.");
  if (session.status === "open") await client.checkout.sessions.expire(session.id);
  await ref.update({ stripeExpiryPending: false, "stripeCheckout.sessionId": session.id, "stripeCheckout.state": session.status === "open" ? "expired" : session.status });
}

export async function handleStripeWebhook(accountId: string, bytes: Buffer, signature: string | null) {
  const { client, source, webhookSecret } = await stripeContext({ accountId, mode: "test" });
  let event: Stripe.Event;
  try { event = client.webhooks.constructEvent(bytes, signature ?? "", webhookSecret); }
  catch { throw new AccessError(400, "stripe-signature", "Invalid Stripe signature."); }
  if (event.livemode || (event.account && event.account !== accountId)) throw new AccessError(400, "stripe-mode", "Unexpected Stripe account or live mode.");
  if (["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed", "charge.dispute.funds_reinstated", "charge.dispute.funds_withdrawn"].includes(event.type)) {
    const { handleDisputeWebhook } = await import("./store-disputes");
    return handleDisputeWebhook(event.data.object as Stripe.Dispute, source);
  }
  if (["refund.created", "refund.updated", "refund.failed"].includes(event.type)) {
    const { handleRefundWebhook } = await import("./store-refunds");
    return handleRefundWebhook(event.data.object as Stripe.Refund, source);
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type)) return { received: true, ignored: true };
  const delivered = event.data.object as Stripe.Checkout.Session;
  const session = await client.checkout.sessions.retrieve(delivered.id);
  const orderId = session.metadata?.orderId;
  if (session.livemode || session.mode !== "payment" || !storePaymentOrderId.safeParse(orderId).success || session.metadata?.businessId !== businessId || session.metadata?.accountId !== accountId || session.client_reference_id !== orderId)
    throw new AccessError(400, "stripe-order", "Stripe session is not mapped to this store.");
  const ref = collection("storeOrders").doc(orderId!), order = await ref.get(), data = order.data();
  if (!data || data.stripeSource?.accountId !== accountId || data.stripeSource?.mode !== "test" || session.currency !== "usd" || session.amount_total !== data.totalMinor ||
      (data.stripeCheckout?.sessionId && data.stripeCheckout.sessionId !== session.id))
    throw new AccessError(409, "stripe-order", "Stripe session does not match its saved order.");
  // A webhook may arrive before session creation's HTTP response. Bind only the
  // Session created with our saved request, verified through its exact metadata.
  if (!data.stripeCheckout?.sessionId) {
    const found = await client.checkout.sessions.create(data.stripeCheckout.params, { idempotencyKey: data.stripeCheckout.key });
    if (found.id !== session.id) throw new AccessError(409, "stripe-session", "Unexpected Checkout Session.");
    await ref.update({ "stripeCheckout.sessionId": session.id });
  }
  if (event.type === "checkout.session.expired") {
    if (session.status !== "expired") return { received: true, ignored: true };
    if (orderIsDue(data as { status: string; expiresAt?: string }))
      await closePendingOrder(orderId!, "expired", "expiry:" + orderId + ":" + data.expiresAt, "expiry", "Payment deadline reached");
    return { received: true };
  }
  const succeeded = event.type !== "checkout.session.async_payment_failed" && session.payment_status === "paid";
  if (!succeeded && event.type !== "checkout.session.async_payment_failed") return { received: true, ignored: true };
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentId) throw new AccessError(409, "stripe-payment", "The Stripe payment reference is missing.");
  const { confirmStorePayment } = await import("./store-payments");
  return confirmStorePayment({ eventId: event.id, orderId, provider: "stripe", paymentId,
    amountMinor: session.amount_total, currency: "USD", status: succeeded ? "succeeded" : "failed" }, source);
}
