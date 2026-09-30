import "server-only";
import { storeOrderInputSchema, readCheckoutTotals } from "@sadboi/core";
import { adminServices } from "./firebase";
import { businessId } from "./staff";
import { AccessError } from "./staff";
import { readFulfillment, readOrderAllocations } from "./fulfillment";
import { fulfillmentInputSchema } from "@sadboi/core";
const collection = (name: string) => adminServices().db.collection("businesses/" + businessId + "/" + name);
function fail(message: string, status = 409): never { throw new AccessError(status, "store-order", message); }
export { createStoreOrder } from "./store-checkout";
export { confirmStorePayment } from "./store-payments";
export async function storeOrderCatalog() {
  const result = await collection("storeOrders").limit(501).get();
  if (result.size > 500) fail("Store orders need pagination before more than 500 records.", 503);
  const fulfillments = new Map<string, FirebaseFirestore.DocumentData>();
  for (let offset = 0; offset < result.size; offset += 100) {
    const records = await adminServices().db.getAll(...result.docs.slice(offset, offset + 100).map(doc => collection("fulfillments").doc(doc.id)));
    for (const record of records) if (record.exists) fulfillments.set(record.id, record.data()!);
  }
  return { orders: result.docs.map(doc => {
    const data = doc.data(), saved = fulfillments.get(doc.id);
    let fulfillment: ReturnType<typeof readFulfillment> = null, reviewReason = "";
    try { fulfillment = readFulfillment(saved, doc.id); readOrderAllocations(data); }
    catch (error) {
      if (!(error instanceof AccessError)) throw error;
      reviewReason = error.message;
      // Show historical details without authorizing a guessed stock migration.
      const historical = fulfillmentInputSchema.safeParse(saved?.input);
      if (historical.success) fulfillment = { input: historical.data, revision: Number(saved?.revision) || 0, updatedAt: String(saved?.updatedAt ?? "") };
    }
    return { id: doc.id, input: storeOrderInputSchema.parse(data.input),
      orderNumber: String(data.orderNumber), status: String(data.status), totalMinor: Number(data.totalMinor), createdAt: String(data.createdAt),
      lines: (Array.isArray(data.lines) ? data.lines : []).map((line: Record<string, unknown>) => ({ sku: String(line.sku), quantity: Number(line.quantity), fulfillment: String(line.fulfillment) })),
      expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
      stripeExpiryPending: data.stripeExpiryPending === true,
      fulfillment, reviewReason, pricing: readCheckoutTotals(data.pricing, data.totalMinor), paymentReviewRequired: data.paymentReviewRequired === true };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}
