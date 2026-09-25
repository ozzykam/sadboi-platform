import "server-only";
import { assertStock, stockAvailable } from "@sadboi/core";
import { createHash } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { readOrderAllocations } from "./fulfillment";
import { inventoryBalanceRef, readInventoryBalance } from "./inventory";
const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fail(message: string): never { throw new AccessError(409, "order-stock-review", message); }

// Prepare all reads first; the caller applies the writes after its other reads.
export async function planOrderStock(tx: Transaction, orderId: string, data: FirebaseFirestore.DocumentData,
  action: "release" | "reallocate", operationKey: string, actorId: string) {
  const lines = readOrderAllocations(data);
  const sites = action === "reallocate"
    ? (await tx.get(collection("stockLocations").where("input.status", "==", "active").where("input.onlineEligible", "==", true).limit(101))).docs
    : await Promise.all([...new Set(lines.flatMap(line => line.allocations.map(a => a.locationId)))].map(id => tx.get(collection("stockLocations").doc(id))));
  if (sites.length > 100) fail("Online stock needs review before reallocation.");
  const sitesById = new Map(sites.map(site => [site.id, site]));
  const balances = await Promise.all(lines.map(line => Promise.all(
    (action === "release" ? line.allocations.map(a => a.locationId) : line.fulfillment === "stocked" ? sites.map(site => site.id) : [])
      .map(locationId => tx.get(inventoryBalanceRef(line.variantId, locationId))))));
  const moves: Array<{ ref: FirebaseFirestore.DocumentReference; before: ReturnType<typeof assertStock>; after: ReturnType<typeof assertStock>; quantity: number; locationName: string; line: typeof lines[number] }> = [];
  const allocationsByVariant = new Map<string, Array<{ locationId: string; quantity: number }>>();
  for (const [index, line] of lines.entries()) {
    let remaining = line.fulfillment === "stocked" ? line.quantity : 0;
    const allocated: Array<{ locationId: string; quantity: number }> = [];
    for (const [balanceIndex, snapshot] of balances[index].entries()) {
      const locationId = action === "release" ? line.allocations[balanceIndex].locationId : sites[balanceIndex].id;
      if (action === "reallocate" && (!remaining || !snapshot.exists)) continue;
      const site = sitesById.get(locationId)?.data();
      if (!site || site.businessId !== businessId || typeof site.input?.name !== "string") fail("An allocated location needs review.");
      let before;
      try { before = readInventoryBalance(snapshot, line.variantId, locationId); }
      catch { fail("An allocated stock balance needs review."); }
      const quantity = action === "release" ? line.allocations[balanceIndex].quantity : Math.min(remaining, stockAvailable(before));
      if (!quantity) continue;
      if (action === "release" && before.allocated < quantity) fail("The saved allocation is not covered by stock. Reconcile it before closing the order.");
      const after = assertStock({ ...before, allocated: before.allocated + (action === "release" ? -quantity : quantity), revision: before.revision + 1 });
      moves.push({ ref: snapshot.ref, before, after, quantity, locationName: site.input.name, line });
      allocated.push({ locationId, quantity }); remaining -= quantity;
    }
    if (remaining) fail("There is not enough available stock to accept this late payment. Record its refund instead, or replenish stock first.");
    allocationsByVariant.set(line.variantId, allocated);
  }
  if (moves.length > 100) fail("This order has too many allocations for one atomic operation.");
  return {
    lines: (data.lines as Array<Record<string, unknown>>).map(line => ({ ...line, allocations: allocationsByVariant.get(String(line.variantId))! })),
    apply(now: string) {
      for (const [index, move] of moves.entries()) {
        tx.update(move.ref, { ...move.after, updatedAt: now });
        tx.create(collection("inventoryMovements").doc(hash(operationKey + ":" + index)), {
          businessId, orderId, variantId: move.line.variantId, sku: move.line.sku, variantName: move.line.name,
          productTitle: move.line.productTitle, locationId: move.before.locationId, locationName: move.locationName,
          kind: action === "release" ? "order_release" : "order_reallocate", quantity: move.quantity,
          onHandDelta: 0, before: move.before, after: move.after, actorId, createdAt: now,
          reason: action === "release" ? "Unpaid order closed" : "Late payment accepted", reference: String(data.orderNumber),
          unitCostMinor: null, transferId: null, otherLocationName: null,
        });
      }
    },
  };
}
