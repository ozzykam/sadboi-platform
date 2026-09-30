import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { renderOrderEmail, type OrderEmailKind } from "@sadboi/core";
import { adminServices, authConfig } from "./firebase";
import { businessId } from "./staff";

// Called only as part of the transaction that creates an order or transitions
// it to paid or saves a fulfillment event. Stable IDs deduplicate retries.
export function queueOrderEmail(tx: Transaction, orderId: string, kind: OrderEmailKind, order: FirebaseFirestore.DocumentData, now: string,
  fulfillmentEvent?: { revision: number; status: string; method: string; trackingNumber: string }) {
  // Historical orders have no recoverable link pointer; do not backfill or
  // manufacture customer capabilities from payment events.
  if (!order.emailAccessOperationId) return;
  const template = renderOrderEmail(kind, { ...order, trackingNumber: fulfillmentEvent?.trackingNumber } as Parameters<typeof renderOrderEmail>[1]);
  const enabled = process.env.SADBOI_ORDER_EMAIL_MODE === "resend";
  const suffix = fulfillmentEvent ? `_${fulfillmentEvent.revision}` : "";
  tx.create(adminServices().db.doc(`businesses/${businessId}/orderEmails/${orderId}_${kind}${suffix}`), {
    businessId, orderId, kind, recipient: order.input.customerEmail, orderNumber: order.orderNumber,
    template, origin: authConfig().origin, accessOperationId: order.emailAccessOperationId,
    status: enabled ? "queued" : "disabled", active: enabled, attempts: 0,
    createdAt: now, updatedAt: now, nextAttemptAt: now, firstAttemptAt: null,
    leaseId: null, leaseUntil: null, providerId: null, lastError: null, revision: 0,
    ...(fulfillmentEvent ? { fulfillmentEvent } : {}),
  });
}
