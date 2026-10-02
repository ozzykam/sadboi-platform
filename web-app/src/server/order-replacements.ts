import "server-only";
import { createHash } from "node:crypto";
import {
  assertStock,
  replacementRequestSchema,
  replacementStatusSchema,
  replacementEffect,
  shipmentCaseInputSchema,
  orderHasDisputeHold,
  stockLocationInputSchema,
  inventoryId,
  readOrderRefundState,
  replacementDestinationSchema,
  type ReplacementStatus,
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
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "shipment-case", message);
}
type Line = {
  variantId: string;
  quantity: number;
  locationId: string | null;
  sku: string;
  name: string;
  productTitle: string;
  fulfillment: string;
};
export function readReplacement(
  data: FirebaseFirestore.DocumentData,
  orderId: string,
) {
  const state = replacementStatusSchema.safeParse(data.status);
  if (
    data.businessId !== businessId ||
    data.orderId !== orderId ||
    !state.success ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 1 ||
    data.revision > 100 ||
    data.stockDisposition !==
      (data.status === "prepared"
        ? "held"
        : data.status === "cancelled"
          ? "released"
          : "consumed") ||
    !Array.isArray(data.lines) ||
    !data.lines.length ||
    data.lines.length > 20 ||
    new Set(data.lines.map((line: Line) => line.variantId)).size !==
      data.lines.length ||
    data.lines.some(
      (line: Line) =>
        !inventoryId.safeParse(line.variantId).success ||
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 1000 ||
        !["stocked", "made_to_order"].includes(line.fulfillment) ||
        (line.fulfillment === "stocked"
          ? !inventoryId.safeParse(line.locationId).success
          : line.locationId !== null),
    )
  )
    fail(
      "This replacement needs administrator reconciliation before further changes.",
    );
  return {
    status: state.data,
    revision: data.revision as number,
    lines: data.lines as Line[],
    trackingNumber: String(data.trackingNumber ?? ""),
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    note: String(data.note ?? ""),
    destination: replacementDestinationSchema.parse(data.destination),
  };
}
export async function saveReplacement(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    fail("Only super admins can manage replacement shipments.", 403);
  const parsed = replacementRequestSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const input = parsed.data,
    fingerprint = hash(JSON.stringify(input)),
    id = hash(staff.uid + ":" + input.operationId);
  const op = collection("replacementOperations").doc(id),
    orderRef = collection("storeOrders").doc(input.orderId);
  const ref = collection("orderReplacements").doc(
    input.action === "prepare" ? id : input.replacementId,
  );
  return adminServices().db.runTransaction(async (tx) => {
    const old = await tx.get(op);
    if (old.exists) {
      if (old.data()!.fingerprint !== fingerprint)
        fail("This request ID was used for different replacement details.");
      return old.data()!.result as { id: string; revision: number };
    }
    const [order, fulfillment, caseDoc, saved, all] = await Promise.all([
      tx.get(orderRef),
      tx.get(collection("fulfillments").doc(input.orderId)),
      tx.get(collection("storeShipmentCases").doc(input.orderId)),
      tx.get(ref),
      tx.get(
        collection("orderReplacements")
          .where("orderId", "==", input.orderId)
          .limit(101),
      ),
    ]);
    const data = order.data();
    if (!data || data.businessId !== businessId) fail("Order not found.", 404);
    const original = readFulfillment(fulfillment.data(), order.id),
      orderLines = readOrderAllocations(data);
    if (
      !original ||
      original.input.method === "pickup" ||
      !["shipped", "delivered"].includes(original.input.status)
    )
      fail("A replacement requires an original dispatched shipping order.");
    const caseData = caseDoc.data(),
      caseInput = shipmentCaseInputSchema.safeParse(caseData?.input);
    if (
      !caseData ||
      caseData.businessId !== businessId ||
      caseData.orderId !== order.id ||
      !caseInput.success
    )
      fail("Open a valid shipment case first.");
    let lines: Line[],
      previous: ReturnType<typeof readReplacement> | null = null,
      effect: "allocate" | "consume" | "release" | "none",
      status: ReplacementStatus,
      trackingNumber = "";
    if (input.action === "prepare") {
      if (
        caseData.revision !== input.expectedCaseRevision ||
        caseInput.data.status === "resolved"
      )
        fail("Reload the open shipment case before preparing a replacement.");
      if (
        all.size >= 100 ||
        all.docs.some(
          (doc) => readReplacement(doc.data(), order.id).status !== "cancelled",
        )
      )
        fail(
          "This order already has a non-cancelled replacement or has reached its history limit.",
        );
      if (
        new Set(input.items.map((line) => line.variantId)).size !==
          input.items.length ||
        input.items.length !== caseInput.data.items.length ||
        input.items.some(
          (item) =>
            !caseInput.data.items.some(
              (affected) =>
                affected.variantId === item.variantId &&
                affected.quantity === item.quantity,
            ),
        )
      )
        fail("The replacement must match all affected case items exactly.");
      lines = input.items.map((item) => {
        const source = orderLines.find(
          (line) => line.variantId === item.variantId,
        );
        if (
          !source ||
          item.quantity > source.quantity ||
          (source.fulfillment === "stocked"
            ? !item.locationId
            : item.locationId !== null)
        )
          fail(
            "Choose a stock location for stocked items only; quantities must match the original order.",
          );
        return {
          ...item,
          sku: source.sku,
          name: source.name,
          productTitle: source.productTitle,
          fulfillment: source.fulfillment,
        };
      });
      effect = "allocate";
      status = "prepared";
    } else {
      if (!saved.exists) fail("Replacement not found.", 404);
      previous = readReplacement(saved.data()!, order.id);
      if (
        previous.revision !== input.expectedRevision ||
        previous.revision >= 100
      )
        fail(
          "Replacement changed or reached its update limit. Reload its history.",
        );
      try {
        effect = replacementEffect(previous.status, input.status);
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : "Invalid replacement update.",
        );
      }
      status = input.status;
      lines = previous.lines;
      trackingNumber = input.trackingNumber;
      if (["shipped", "delivered"].includes(status) && !trackingNumber)
        fail(
          "Enter the replacement tracking number before dispatch or delivery.",
        );
    }
    if (
      (effect === "allocate" || effect === "consume") &&
      (data.paymentReviewRequired ||
        readOrderRefundState(data.refundState).activeId ||
        readOrderRefundState(data.refundState).pendingMinor)
    )
      fail(
        "Resolve payment review and pending refunds before preparing or shipping a replacement.",
      );
    if (
      (effect === "allocate" || effect === "consume") &&
      orderHasDisputeHold(data.disputeState)
    )
      fail(
        "Resolve the open or lost payment dispute before preparing or shipping a replacement. Cancellation remains available.",
      );
    const stockLines =
      effect === "none"
        ? []
        : lines.filter((line) => line.fulfillment === "stocked");
    const locationIds = [
      ...new Set(stockLines.map((line) => line.locationId!)),
    ];
    const [balances, locations] = await Promise.all([
      Promise.all(
        stockLines.map((line) =>
          tx.get(inventoryBalanceRef(line.variantId, line.locationId!)),
        ),
      ),
      Promise.all(
        locationIds.map((locationId) =>
          tx.get(collection("stockLocations").doc(locationId)),
        ),
      ),
    ]);
    const movements = stockLines.map((line, index) => {
      try {
        const before = readInventoryBalance(
          balances[index],
          line.variantId,
          line.locationId!,
        );
        if (effect !== "allocate" && before.allocated < line.quantity)
          fail("Replacement allocation is no longer covered.");
        const after = assertStock({
          ...before,
          allocated:
            before.allocated +
            (effect === "allocate" ? line.quantity : -line.quantity),
          onHand: before.onHand - (effect === "consume" ? line.quantity : 0),
          revision: before.revision + 1,
        });
        return { line, before, after, ref: balances[index].ref };
      } catch {
        fail(
          "Replacement stock is unavailable or its allocation needs reconciliation. No stock was changed.",
        );
      }
    });
    const totals = locations.map((location) => {
      const site = location.data(),
        policy = stockLocationInputSchema.safeParse(site?.input);
      if (
        !site ||
        site.businessId !== businessId ||
        !policy.success ||
        (effect === "allocate" &&
          (policy.data.status !== "active" || policy.data.kind === "transit"))
      )
        fail("Choose an active non-transit location with valid stock history.");
      try {
        return {
          ref: location.ref,
          name: policy.data.name,
          onHandUnits: inventoryTotal(
            inventoryTotal(site.onHandUnits, 0),
            effect === "consume"
              ? -stockLines
                  .filter((line) => line.locationId === location.id)
                  .reduce((sum, line) => sum + line.quantity, 0)
              : 0,
          ),
        };
      } catch {
        fail(
          "The receiving location total needs reconciliation before stock can change.",
        );
      }
    });
    const now = new Date().toISOString(),
      revision = (previous?.revision ?? 0) + 1,
      result = { id: ref.id, revision };
    for (const [index, movement] of movements.entries()) {
      tx.set(
        movement.ref,
        { ...movement.after, businessId, updatedAt: now },
        { merge: true },
      );
      tx.create(collection("inventoryMovements").doc(hash(id + ":" + index)), {
        businessId,
        orderId: order.id,
        replacementId: ref.id,
        kind: "replacement_" + effect,
        variantId: movement.line.variantId,
        sku: movement.line.sku,
        variantName: movement.line.name,
        productTitle: movement.line.productTitle,
        locationId: movement.line.locationId,
        locationName: totals.find(
          (total) => total.ref.id === movement.line.locationId,
        )!.name,
        otherLocationName: null,
        quantity: movement.line.quantity,
        onHandDelta: movement.after.onHand - movement.before.onHand,
        before: movement.before,
        after: movement.after,
        reason: input.note,
        reference: String(data.orderNumber),
        unitCostMinor: null,
        transferId: null,
        actorId: staff.uid,
        createdAt: now,
      });
    }
    if (effect === "consume")
      for (const total of totals)
        tx.update(total.ref, {
          onHandUnits: total.onHandUnits,
          updatedAt: now,
        });
    const destination = previous?.destination ?? {
      recipientName: original.input.recipientName,
      address1: original.input.address1,
      address2: original.input.address2,
      city: original.input.city,
      region: original.input.region,
      postalCode: original.input.postalCode,
      country: original.input.country,
    };
    tx.set(ref, {
      businessId,
      orderId: order.id,
      lines,
      destination,
      status,
      revision,
      trackingNumber,
      note: input.note,
      stockDisposition:
        status === "prepared"
          ? "held"
          : status === "cancelled"
            ? "released"
            : "consumed",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      actorId: staff.uid,
    });
    tx.create(
      ref.collection("history").doc(String(revision).padStart(3, "0")),
      {
        businessId,
        orderId: order.id,
        revision,
        status,
        trackingNumber,
        note: input.note,
        effect,
        actorId: staff.uid,
        createdAt: now,
      },
    );
    tx.update(orderRef, {
      replacement: { status, trackingNumber, updatedAt: now },
    });
    tx.create(op, {
      businessId,
      fingerprint,
      result,
      actorId: staff.uid,
      createdAt: now,
    });
    tx.create(collection("inventoryAudit").doc(id), {
      businessId,
      resource: "orderReplacements",
      recordId: ref.id,
      orderId: order.id,
      kind: "replacement_saved",
      revision,
      status,
      effect,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
