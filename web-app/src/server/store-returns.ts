import "server-only";
import { createHash } from "node:crypto";
import {
  assertStock,
  receivedReturnSchema,
  readReturnState,
  returnedQuantity,
  stockLocationInputSchema,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { readFulfillment, readOrderAllocations } from "./fulfillment";
import {
  inventoryBalanceRef,
  readInventoryBalance,
  inventoryTotal,
} from "./inventory";
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "order-return", message);
}

export async function receiveOrderReturn(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    fail("Only super admins can receive returns.", 403);
  const parsed = receivedReturnSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const input = parsed.data,
    fingerprint = hash(JSON.stringify(input));
  const ref = collection("storeOrderReturns").doc(
    hash(staff.uid + ":" + input.operationId),
  );
  return adminServices().db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    if (old.exists) {
      if (old.data()!.fingerprint !== fingerprint)
        fail("This request ID was used for a different return.");
      return { id: ref.id, revision: old.data()!.revision as number };
    }
    const [order, saved, history] = await Promise.all([
      tx.get(collection("storeOrders").doc(input.orderId)),
      tx.get(collection("fulfillments").doc(input.orderId)),
      tx.get(
        collection("storeOrderReturns")
          .where("orderId", "==", input.orderId)
          .limit(101),
      ),
    ]);
    if (history.size >= 100)
      fail(
        "This order has reached the supported return history limit. Ask the administrator to reconcile further returns.",
      );
    const data = order.data();
    if (!data || data.businessId !== businessId) fail("Order not found.", 404);
    const fulfillment = readFulfillment(saved.data(), order.id);
    if (
      !fulfillment ||
      !["shipped", "delivered"].includes(fulfillment.input.status)
    )
      fail(
        "Only dispatched or collected items can be received as a return. Cancel unshipped fulfillment instead.",
      );
    const lines = readOrderAllocations(data),
      line = lines.find((item) => item.variantId === input.variantId);
    if (!line) fail("Choose an item from this order.");
    const state = readReturnState(data.returnState);
    if (state.revision !== input.expectedRevision)
      fail("Returns changed. Reload the history before receiving more items.");
    let received: number;
    try {
      received = returnedQuantity(
        line.quantity,
        state.quantities[input.variantId] ?? 0,
        input.quantity,
      );
    } catch (error) {
      fail(
        error instanceof Error ? error.message : "Invalid returned quantity.",
      );
    }
    if (line.fulfillment !== "stocked" && input.disposition !== "discard")
      fail(
        "Made-to-order returns cannot enter tracked stock in this version. Record discarded items only, or ask the administrator to reconcile retained items.",
      );
    const now = new Date().toISOString(),
      revision = state.revision + 1;
    let locationName: string | null = null;
    if (input.locationId) {
      const [location, balance] = await Promise.all([
        tx.get(collection("stockLocations").doc(input.locationId)),
        tx.get(inventoryBalanceRef(input.variantId, input.locationId)),
      ]);
      const site = location.data(),
        policy = stockLocationInputSchema.safeParse(site?.input);
      if (
        !site ||
        site.businessId !== businessId ||
        !policy.success ||
        policy.data.status !== "active" ||
        policy.data.kind === "transit"
      )
        fail("Choose an active receiving location outside transit.");
      locationName = policy.data.name;
      const before = readInventoryBalance(
        balance,
        input.variantId,
        input.locationId,
      );
      const after = assertStock({
        ...before,
        onHand: before.onHand + input.quantity,
        unavailable:
          before.unavailable +
          (input.disposition === "quarantine" ? input.quantity : 0),
        revision: before.revision + 1,
      });
      const total = inventoryTotal(
        inventoryTotal(site.onHandUnits, 0),
        input.quantity,
      );
      tx.set(
        balance.ref,
        { ...after, businessId, updatedAt: now },
        { merge: true },
      );
      tx.update(location.ref, { onHandUnits: total, updatedAt: now });
      tx.create(collection("inventoryMovements").doc(ref.id), {
        businessId,
        orderId: order.id,
        kind: "order_return",
        variantId: input.variantId,
        sku: line.sku,
        variantName: line.name,
        productTitle: line.productTitle,
        locationId: input.locationId,
        locationName,
        quantity: input.quantity,
        onHandDelta: input.quantity,
        before,
        after,
        reason: input.notes,
        reference: String(data.orderNumber),
        unitCostMinor: null,
        transferId: null,
        otherLocationName: null,
        actorId: staff.uid,
        createdAt: now,
      });
    }
    tx.create(ref, {
      businessId,
      orderId: order.id,
      input,
      fingerprint,
      revision,
      sku: line.sku,
      locationName,
      actorId: staff.uid,
      createdAt: now,
    });
    tx.update(order.ref, {
      returnState: {
        revision,
        quantities: { ...state.quantities, [input.variantId]: received },
      },
      updatedAt: now,
    });
    tx.create(collection("inventoryAudit").doc(ref.id), {
      businessId,
      resource: "storeOrders",
      recordId: order.id,
      kind: "return_received",
      after: input,
      actorId: staff.uid,
      createdAt: now,
    });
    return { id: ref.id, revision };
  });
}
