import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  orderCloseSchema,
  orderIsDue,
  storePaymentOrderId,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { planOrderStock } from "./order-stock";
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function requireOrderToken(
  data: FirebaseFirestore.DocumentData,
  token: unknown,
) {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token) ||
    typeof data.managementTokenHash !== "string" ||
    !timingSafeEqual(
      Buffer.from(hash(token)),
      Buffer.from(data.managementTokenHash.padEnd(64, " ").slice(0, 64)),
    )
  )
    throw new AccessError(
      404,
      "order-not-found",
      "Order access was not found.",
    );
}
export async function closePendingOrder(
  orderId: string,
  kind: "cancelled" | "expired",
  operationId: string,
  actorId: string,
  reason: string,
  token?: unknown,
) {
  storePaymentOrderId.parse(orderId);
  const operation = collection("orderLifecycleOperations").doc(
    hash(actorId + ":" + operationId),
  );
  const ref = collection("storeOrders").doc(orderId),
    fingerprint = hash(JSON.stringify({ orderId, kind, reason }));
  return adminServices().db.runTransaction(async (tx) => {
    const [previous, order, fulfillment] = await Promise.all([
      tx.get(operation),
      tx.get(ref),
      tx.get(collection("fulfillments").doc(orderId)),
    ]);
    const data = order.data();
    if (!data || data.businessId !== businessId)
      throw new AccessError(404, "order-not-found", "Order not found.");
    if (actorId === "customer") requireOrderToken(data, token);
    if (previous.exists) {
      if (previous.data()!.fingerprint !== fingerprint)
        throw new AccessError(
          409,
          "order-operation-conflict",
          "This request was used for different details.",
        );
      return previous.data()!.result as { id: string; status: string };
    }
    if (["cancelled", "expired"].includes(data.status) && data.pendingClosure)
      return { id: orderId, status: String(data.status) };
    if (
      data.status !== "pending_payment" ||
      fulfillment.exists ||
      data.paymentId ||
      data.paymentEventId
    )
      throw new AccessError(
        409,
        "order-close-conflict",
        "Only an unpaid order without prior payment or fulfillment can be closed here.",
      );
    if (
      kind === "expired" &&
      !orderIsDue(data as { status: string; expiresAt?: string })
    )
      throw new AccessError(
        409,
        "order-not-due",
        "This order has not reached its payment deadline.",
      );
    const stock = await planOrderStock(
      tx,
      orderId,
      data,
      "release",
      operation.id,
      actorId,
    );
    const now = new Date().toISOString(),
      result = { id: orderId, status: kind };
    stock.apply(now);
    tx.update(ref, {
      status: kind,
      allocationState: "released",
      pendingClosure: { kind, reason, actorId, createdAt: now },
      stripeExpiryPending: Boolean(data.stripeSource),
      lifecycleRevision: (data.lifecycleRevision ?? 0) + 1,
      updatedAt: now,
    });
    tx.create(operation, {
      businessId,
      fingerprint,
      result,
      actorId,
      createdAt: now,
    });
    tx.create(collection("inventoryAudit").doc(operation.id), {
      resource: "storeOrders",
      recordId: orderId,
      kind: "pending_order_" + kind,
      before: data.status,
      after: kind,
      reason,
      actorId,
      createdAt: now,
    });
    return result;
  });
}
export async function cancelPendingOrder(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can cancel orders.",
    );
  const parsed = orderCloseSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "invalid-order-close",
      "Provide an order, request ID, and cancellation reason.",
    );
  return closePendingOrder(
    parsed.data.orderId,
    "cancelled",
    parsed.data.operationId,
    staff.uid,
    parsed.data.reason,
  );
}
export async function expirePendingOrders() {
  // Explicit bounded batch; a cursor prevents legacy/problem orders starving later ones.
  const state = collection("inventoryState").doc("expiry"),
    previous = (await state.get()).data(),
    checkpoint = previous?.cursor;
  let query = collection("storeOrders")
    .where("status", "==", "pending_payment")
    .orderBy("__name__")
    .limit(50);
  if (typeof checkpoint === "string") query = query.startAfter(checkpoint);
  let batch = await query.get();
  if (batch.empty && checkpoint)
    batch = await collection("storeOrders")
      .where("status", "==", "pending_payment")
      .orderBy("__name__")
      .limit(50)
      .get();
  const results: Array<{ id: string; status: string }> = [];
  for (const doc of batch.docs) {
    const data = doc.data();
    if (!orderIsDue(data as { status: string; expiresAt?: string })) continue;
    try {
      results.push(
        await closePendingOrder(
          doc.id,
          "expired",
          "expiry:" + doc.id + ":" + data.expiresAt,
          "expiry",
          "Payment deadline reached",
        ),
      );
    } catch (error) {
      if (!(error instanceof AccessError)) throw error;
      results.push({ id: doc.id, status: error.code });
    }
  }
  let cleanupQuery = collection("storeOrders")
    .where("stripeExpiryPending", "==", true)
    .orderBy("__name__")
    .limit(20);
  if (typeof previous?.cleanupCursor === "string")
    cleanupQuery = cleanupQuery.startAfter(previous.cleanupCursor);
  let cleanup = await cleanupQuery.get();
  if (cleanup.empty && previous?.cleanupCursor)
    cleanup = await collection("storeOrders")
      .where("stripeExpiryPending", "==", true)
      .orderBy("__name__")
      .limit(20)
      .get();
  const { expireStripeSession } = await import("./stripe-checkout");
  const cleanupResults = await Promise.all(
    cleanup.docs.map(async (doc) => {
      try {
        await expireStripeSession(doc.id);
        return { id: doc.id, status: "closed" };
      } catch {
        return { id: doc.id, status: "retry-required" };
      }
    }),
  );
  await state.set({
    cursor: batch.size === 50 ? batch.docs.at(-1)!.id : null,
    cleanupCursor: cleanup.size === 20 ? cleanup.docs.at(-1)!.id : null,
    lastRunAt: new Date().toISOString(),
    scanned: batch.size,
    results,
    cleanupResults,
  });
  return { scanned: batch.size, results, cleanupResults };
}
