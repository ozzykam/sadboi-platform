import "server-only";
import { storeOrderInputSchema, paymentConfirmationSchema } from "@sadboi/core";
import { adminServices } from "./firebase";
import { businessId } from "./staff";
import { AccessError } from "./staff";
const collection = (name: string) => adminServices().db.collection("businesses/" + businessId + "/" + name);
function fail(message: string, status = 409): never { throw new AccessError(status, "store-order", message); }
export { createStoreOrder } from "./store-checkout";
export async function confirmStorePayment(raw: unknown) {
  const parsed = paymentConfirmationSchema.safeParse(raw); if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400); const input = parsed.data; const orderRef = collection("storeOrders").doc(input.orderId), eventRef = collection("storePaymentEvents").doc(input.eventId);
  return adminServices().db.runTransaction(async tx => { const [event, order] = await Promise.all([tx.get(eventRef), tx.get(orderRef)]); if (event.exists) return { id: order.id, status: event.data()!.status, duplicate: true }; if (!order.exists) fail("Order not found.", 404); if (input.status === "succeeded" && (order.data()!.totalMinor !== input.amountMinor || order.data()!.status !== "pending_payment")) fail("Payment amount or order state does not match.", 409); const now = new Date().toISOString(); tx.create(eventRef, { input, status: input.status, createdAt: now }); tx.update(orderRef, { status: input.status === "succeeded" ? "paid" : "pending_payment", paymentId: input.paymentId, paymentProvider: input.provider, paymentEventId: input.eventId, updatedAt: now }); return { id: order.id, status: input.status, duplicate: false }; });
}
export async function storeOrderCatalog() { const result = await collection("storeOrders").limit(501).get(); if (result.size > 500) fail("Store orders need pagination before more than 500 records.", 503); return { orders: result.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>), input: storeOrderInputSchema.parse(doc.data()!.input) })).sort((a, b) => String((b as Record<string, unknown>).createdAt).localeCompare(String((a as Record<string, unknown>).createdAt))) }; }
