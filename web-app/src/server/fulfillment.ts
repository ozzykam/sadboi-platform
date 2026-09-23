import "server-only";
import { fulfillmentInputSchema } from "@sadboi/core";
import { adminServices } from "./firebase";
import { businessId, type Staff } from "./staff";
import { inventoryBalanceRef } from "./inventory";
const collection = (name: string) => adminServices().db.collection("businesses/" + businessId + "/" + name);
function fail(message: string, status = 409): never { throw new Error(message + " [" + status + "]"); }
export async function saveFulfillment(raw: unknown, staff: Staff): Promise<{ id: string }> {
  const parsed = fulfillmentInputSchema.safeParse(raw); if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400); const input = parsed.data; const ref = collection("fulfillments").doc(input.orderId);
  return adminServices().db.runTransaction(async tx => {
    const [order, existing, locations] = await Promise.all([tx.get(collection("storeOrders").doc(input.orderId)), tx.get(ref), tx.get(collection("stockLocations").where("input.onlineEligible", "==", true).where("input.status", "==", "active").limit(100))]);
    if (!order.exists || order.data()!.status !== "paid") fail("Fulfillment requires a paid order."); if (existing.exists && existing.data()!.status === "delivered") fail("This order is already fulfilled.");
    const lines = order.data()!.lines as Array<Record<string, unknown>>; const balanceRefs = lines.flatMap(line => locations.docs.map(location => inventoryBalanceRef(String(line.variantId), location.id))); const balances = await Promise.all(balanceRefs.map(balance => tx.get(balance))); const now = new Date().toISOString();
    if (["delivered", "cancelled"].includes(input.status)) { let index = 0; for (const line of lines) { let remaining = Number(line.quantity); for (let locationIndex = 0; locationIndex < locations.docs.length; locationIndex++) { if (!remaining) break; const stock = balances[index++]; if (!stock.exists) continue; const data = stock.data()!, take = Math.min(remaining, data.allocated ?? 0); if (!take) continue; tx.update(stock.ref, input.status === "delivered" ? { allocated: (data.allocated ?? 0) - take, onHand: (data.onHand ?? 0) - take, revision: (data.revision ?? 0) + 1, updatedAt: now } : { allocated: (data.allocated ?? 0) - take, revision: (data.revision ?? 0) + 1, updatedAt: now }); remaining -= take; } if (remaining) fail("The order allocation no longer covers fulfillment."); } }
    tx.set(ref, { input, businessId, revision: existing.data()?.revision ? existing.data()!.revision + 1 : 1, createdAt: existing.data()?.createdAt ?? now, updatedAt: now, updatedBy: staff.uid }); tx.update(order.ref, { status: input.status === "delivered" ? "fulfilled" : order.data()!.status, updatedAt: now }); return { id: ref.id };
  });
}
