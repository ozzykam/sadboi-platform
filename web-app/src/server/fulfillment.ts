import "server-only";
import { createHash } from "node:crypto";
import { assertStock, fulfillmentRequestSchema, fulfillmentInputSchema, fulfillmentLinesSchema, fulfillmentEffect, fulfillmentDisposition, storeOrderInputSchema } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { inventoryBalanceRef, readInventoryBalance, inventoryTotal } from "./inventory";
const collection = (name: string) => adminServices().db.collection("businesses/" + businessId + "/" + name);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fail(message: string, code = "fulfillment-conflict", status = 409): never { throw new AccessError(status, code, message); }
export function readFulfillment(data: FirebaseFirestore.DocumentData | undefined, orderId: string) {
  if (!data) return null;
  const parsed = fulfillmentInputSchema.safeParse(data.input);
  if (data.schemaVersion !== 1 || data.businessId !== businessId || !parsed.success || parsed.data.orderId !== orderId ||
      !Number.isSafeInteger(data.revision) || data.revision < 1 || data.stockDisposition !== fulfillmentDisposition(parsed.data.status))
    fail("This fulfillment record needs reconciliation before further changes. Its stock history cannot be inferred safely.", "fulfillment-review");
  return { input: parsed.data, revision: data.revision as number, updatedAt: String(data.updatedAt) };
}
export function readOrderAllocations(data: FirebaseFirestore.DocumentData) {
  const lines = fulfillmentLinesSchema.safeParse(data.lines), input = storeOrderInputSchema.safeParse(data.input);
  if (data.businessId !== businessId || !lines.success || !input.success || lines.data.length !== input.data.lines.length ||
      lines.data.some(line => !input.data.lines.some(wanted => wanted.variantId === line.variantId && wanted.quantity === line.quantity)))
    fail("This order needs allocation review before fulfillment. Missing or inconsistent allocation history must be reconciled first.", "fulfillment-review");
  return lines.data;
}
export async function saveFulfillment(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin") fail("Only super admins can change fulfillment.", "forbidden", 403);
  const parsed = fulfillmentRequestSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), "invalid-fulfillment", 400);
  const { input, operationId, expectedRevision } = parsed.data;
  const ref = collection("fulfillments").doc(input.orderId);
  const operationRef = collection("fulfillmentOperations").doc(hash(staff.uid + ":" + operationId));
  const fingerprint = hash(JSON.stringify({ input, expectedRevision }));
  return adminServices().db.runTransaction(async tx => {
    const operation = await tx.get(operationRef);
    if (operation.exists) {
      if (operation.data()!.fingerprint !== fingerprint) fail("This request ID was already used for different details.");
      return operation.data()!.result as { id: string; revision: number; status: string; orderStatus: string };
    }
    const [order, existing] = await Promise.all([tx.get(collection("storeOrders").doc(input.orderId)), tx.get(ref)]);
    if (!order.exists) fail("Order not found.", "not-found", 404);
    const data = order.data()!, previous = readFulfillment(existing.data(), input.orderId);
    if ((previous?.revision ?? 0) !== expectedRevision) fail("Someone changed this fulfillment. Reload the order before saving.", "fulfillment-revision");
    if (data.status !== "paid") fail("Fulfillment requires a paid order. Completed and cancelled orders cannot be reopened.");
    const lines = readOrderAllocations(data);
    let effect: ReturnType<typeof fulfillmentEffect>;
    try { effect = fulfillmentEffect(previous?.input ?? null, input); }
    catch (error) { fail(error instanceof Error ? error.message : "Invalid transition."); }
    const allocations = effect === "none" ? [] : lines.flatMap(line => line.allocations.map(a => ({ ...a, line })));
    const locationIds = [...new Set(allocations.map(a => a.locationId))];
    const [balances, locations] = await Promise.all([
      Promise.all(allocations.map(a => tx.get(inventoryBalanceRef(a.line.variantId, a.locationId)))),
      Promise.all(locationIds.map(id => tx.get(collection("stockLocations").doc(id)))),
    ]);
    const now = new Date().toISOString();
    // Compute every result before writing; balances, rollups, and history commit together.
    const movements = allocations.map((allocation, index) => {
      const { line, locationId, quantity } = allocation;
      let before, after;
      try {
        before = readInventoryBalance(balances[index], line.variantId, locationId);
        if (before.allocated < quantity) fail("The saved allocation is no longer covered.");
        after = assertStock({ ...before, allocated: before.allocated - quantity,
          onHand: before.onHand - (effect === "consume" ? quantity : 0), revision: before.revision + 1 });
      } catch { fail("The saved order allocation is no longer covered by valid stock. Reconcile stock before retrying.", "fulfillment-review"); }
      return { allocation, before, after, ref: balances[index].ref };
    });
    const totals = locations.map(location => {
      const site = location.data();
      if (!site || site.businessId !== businessId || typeof site.input?.name !== "string" || !Number.isSafeInteger(site.onHandUnits) || site.onHandUnits < 0)
        fail("An allocated location needs reconciliation before fulfillment.", "fulfillment-review");
      const consumed = effect === "consume" ? allocations.filter(a => a.locationId === location.id).reduce((sum, a) => sum + a.quantity, 0) : 0;
      return { ref: location.ref, name: site.input.name as string, onHandUnits: inventoryTotal(site.onHandUnits, -consumed) };
    });
    for (const [index, movement] of movements.entries()) {
      const { allocation: { line, locationId, quantity }, before, after } = movement;
      tx.update(movement.ref, { ...after, updatedAt: now });
      tx.create(collection("inventoryMovements").doc(hash(operationRef.id + ":" + index)), {
        businessId, kind: effect === "consume" ? "order_dispatch" : "order_cancel", orderId: order.id,
        variantId: line.variantId, sku: line.sku, variantName: line.name, productTitle: line.productTitle,
        locationId, locationName: totals.find(t => t.ref.id === locationId)!.name, otherLocationName: null,
        quantity, onHandDelta: after.onHand - before.onHand, reason: "Order " + input.status,
        reference: String(data.orderNumber), unitCostMinor: null, transferId: null,
        actorId: staff.uid, createdAt: now, before, after,
      });
    }
    if (effect === "consume") for (const total of totals) tx.update(total.ref, { onHandUnits: total.onHandUnits, updatedAt: now });
    const revision = expectedRevision + 1;
    const orderStatus = input.status === "delivered" ? "fulfilled" : input.status === "cancelled" ? "cancelled" : "paid";
    const result = { id: ref.id, revision, status: input.status, orderStatus };
    tx.set(ref, { input, businessId, schemaVersion: 1, stockDisposition: fulfillmentDisposition(input.status), revision,
      createdAt: existing.data()?.createdAt ?? now, updatedAt: now, updatedBy: staff.uid });
    tx.update(order.ref, { status: orderStatus, updatedAt: now });
    tx.create(collection("inventoryAudit").doc(operationRef.id), { resource: "fulfillments", recordId: ref.id,
      kind: "fulfillment_saved", actorId: staff.uid, createdAt: now, before: previous?.input ?? null, after: input, revision, effect });
    tx.create(operationRef, { businessId, actorId: staff.uid, fingerprint, result, createdAt: now });
    return result;
  });
}
