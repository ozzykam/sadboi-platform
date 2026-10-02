import "server-only";
import { createHash } from "node:crypto";
import { orderIsDue, paymentReviewSchema } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { stripeContext, type StripeSource } from "./stripe";
import { closePendingOrder } from "./order-lifecycle";
import { planOrderStock } from "./order-stock";
import { queueOrderEmail } from "./order-email-queue";
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fail(message: string): never {
  throw new AccessError(409, "payment-review-conflict", message);
}

export async function resolvePaymentReview(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can resolve payment reviews.",
    );
  const parsed = paymentReviewSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "payment-review-input",
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const input = parsed.data,
    fingerprint = hash(input);
  const operation = collection("paymentReviewOperations").doc(
    hash(staff.uid + ":" + input.operationId),
  );
  const existing = await operation.get();
  if (existing.exists) {
    if (existing.data()!.fingerprint !== fingerprint)
      fail("This request was already used for different details.");
    return existing.data()!.result as { id: string; status: string };
  }
  const eventRef = collection("storePaymentEvents").doc(input.eventId),
    orderRef = collection("storeOrders").doc(input.orderId);
  const initialEvent = (await eventRef.get()).data();
  if (
    !initialEvent ||
    initialEvent.input?.orderId !== input.orderId ||
    initialEvent.outcome !== "review"
  )
    fail("Select a payment event that needs review.");
  if (input.action === "dismiss") {
    if (initialEvent.input.status !== "failed")
      fail(
        "A successful payment must be accepted or matched to a verified refund; it cannot be dismissed.",
      );
  } else {
    if (!initialEvent.source)
      fail(
        "This historical event has no Stripe account mapping. Reconcile its account before accepting or refunding it.",
      );
    const { client } = await stripeContext(initialEvent.source as StripeSource);
    const payment = await client.paymentIntents.retrieve(
      initialEvent.input.paymentId,
      { expand: ["latest_charge"] },
    );
    if (
      payment.livemode ||
      payment.currency !== "usd" ||
      payment.status !== "succeeded" ||
      payment.amount_received !== initialEvent.input.amountMinor ||
      payment.metadata.orderId !== input.orderId ||
      payment.metadata.businessId !== businessId
    )
      fail("Stripe does not confirm the matching successful test payment.");
    if (input.action === "accept_payment") {
      const charge = payment.latest_charge;
      if (!charge || typeof charge === "string" || charge.amount_refunded !== 0)
        fail(
          "This payment has been refunded or its charge cannot be verified.",
        );
    } else {
      const refund = await client.refunds.retrieve(input.reference);
      const paymentId =
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id;
      if (
        refund.status !== "succeeded" ||
        refund.amount !== initialEvent.input.amountMinor ||
        refund.currency !== "usd" ||
        paymentId !== initialEvent.input.paymentId
      )
        fail(
          "The refund must be completed, for this payment, and for the full reviewed amount.",
        );
    }
  }
  const initialOrder = (await orderRef.get()).data();
  if (
    input.action === "accept_payment" &&
    initialOrder &&
    orderIsDue(initialOrder as { status: string; expiresAt?: string })
  )
    await closePendingOrder(
      input.orderId,
      "expired",
      "expiry:" + input.orderId + ":" + initialOrder.expiresAt,
      "expiry",
      "Payment deadline reached",
    );
  return adminServices().db.runTransaction(async (tx) => {
    const [prior, order, event, history, fulfillment] = await Promise.all([
      tx.get(operation),
      tx.get(orderRef),
      tx.get(eventRef),
      tx.get(
        collection("storePaymentEvents")
          .where("input.orderId", "==", input.orderId)
          .limit(201),
      ),
      tx.get(collection("fulfillments").doc(input.orderId)),
    ]);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail("This request was already used for different details.");
      return prior.data()!.result as { id: string; status: string };
    }
    const d = order.data(),
      e = event.data();
    if (
      !d ||
      d.businessId !== businessId ||
      !e ||
      e.input.orderId !== input.orderId ||
      e.outcome !== "review" ||
      e.resolution ||
      (e.revision ?? 0) !== input.expectedRevision
    )
      fail(
        "This payment review changed. Reload its history before resolving it.",
      );
    if (history.size > 200)
      fail(
        "The payment history needs an administrative export before resolution.",
      );
    const source = e.source as StripeSource | null;
    const scope = source
      ? `stripe:${source.accountId}:${source.mode}`
      : "stripe";
    const identityRef = collection("storePaymentIdentities").doc(
      `${scope}:${e.input.paymentId}`,
    );
    const identity = await tx.get(identityRef);
    let stock: Awaited<ReturnType<typeof planOrderStock>> | undefined;
    if (input.action === "accept_payment") {
      if (
        e.reason !== "late_success" ||
        e.input.status !== "succeeded" ||
        e.input.amountMinor !== d.totalMinor ||
        !d.pendingClosure ||
        !["expired", "cancelled"].includes(d.status) ||
        d.allocationState !== "released" ||
        d.paymentId ||
        fulfillment.exists ||
        identity.data()?.orderId !== order.id ||
        identity.data()?.status !== "succeeded"
      )
        fail(
          "Only a matching late payment on a closed unpaid order can be accepted. Existing paid orders cannot be paid again.",
        );
      stock = await planOrderStock(
        tx,
        order.id,
        d,
        "reallocate",
        operation.id,
        staff.uid,
      );
    }
    if (input.action === "dismiss" && e.input.status !== "failed")
      fail("Successful payments cannot be dismissed.");
    const related = history.docs.filter(
      (doc) =>
        doc.data().outcome === "review" &&
        !doc.data().resolution &&
        (input.action === "dismiss"
          ? doc.id === event.id
          : doc.data().input.paymentId === e.input.paymentId &&
            hash(doc.data().source ?? null) === hash(source)),
    );
    const unresolved = history.docs.some(
      (doc) =>
        doc.data().outcome === "review" &&
        !doc.data().resolution &&
        !related.some((item) => item.id === doc.id),
    );
    const now = new Date().toISOString(),
      resolution = {
        action: input.action,
        notes: input.notes,
        reference: input.reference,
        actorId: staff.uid,
        createdAt: now,
      };
    stock?.apply(now);
    const status = stock ? "paid" : String(d.status);
    if (stock) queueOrderEmail(tx, order.id, "payment_confirmed", d, now);
    tx.update(orderRef, {
      ...(stock
        ? {
            status,
            lines: stock.lines,
            allocationState: "held",
            stripeExpiryPending: false,
            paymentId: e.input.paymentId,
            paymentProvider: "stripe",
            paymentEventId: e.input.eventId,
            paidAt: now,
          }
        : {}),
      paymentReviewRequired: unresolved,
      lifecycleRevision: (d.lifecycleRevision ?? 0) + 1,
      updatedAt: now,
    });
    for (const item of related)
      tx.update(item.ref, {
        resolution,
        revision: (item.data().revision ?? 0) + 1,
      });
    if (
      input.action === "record_refund" &&
      identity.data()?.orderId === order.id
    )
      tx.update(identityRef, { resolution, updatedAt: now });
    const result = { id: order.id, status };
    tx.create(operation, {
      fingerprint,
      input,
      result,
      actorId: staff.uid,
      createdAt: now,
    });
    tx.create(collection("inventoryAudit").doc(operation.id), {
      resource: "storePaymentEvents",
      recordId: event.id,
      kind: "payment_review_resolved",
      resolution,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
