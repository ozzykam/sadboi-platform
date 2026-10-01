import "server-only";
import { createHash } from "node:crypto";
import { shipmentCaseInputSchema, shipmentCaseRequestSchema, storePaymentOrderId, validateShipmentCase, readOrderRefundState } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { readFulfillment, readOrderAllocations } from "./fulfillment";
import { readReplacement } from "./order-replacements";
const collection = (name: string) => adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function fail(message: string, status = 409): never { throw new AccessError(status, "shipment-case", message); }
function readCase(data: FirebaseFirestore.DocumentData | undefined, orderId: string) {
  if (!data) return null;
  const parsed = shipmentCaseInputSchema.safeParse(data.input);
  if (data.businessId !== businessId || data.orderId !== orderId || !parsed.success || !Number.isSafeInteger(data.revision) || data.revision < 1 || data.revision > 100)
    fail("This shipment case needs administrator review.");
  return { input: parsed.data, revision: data.revision as number, createdAt: String(data.createdAt), updatedAt: String(data.updatedAt),
    trackingNumber: String(data.trackingNumber ?? "") };
}
export async function shipmentCaseHistory(orderId: string) {
  if (!storePaymentOrderId.safeParse(orderId).success) fail("Invalid order reference.", 400);
  const ref = collection("storeShipmentCases").doc(orderId);
  return adminServices().db.runTransaction(async tx => {
    const [order, fulfillment, saved, events, refunds, returns, replacements, locations] = await Promise.all([
      tx.get(collection("storeOrders").doc(orderId)), tx.get(collection("fulfillments").doc(orderId)), tx.get(ref),
      tx.get(ref.collection("history").orderBy("revision", "desc").limit(101)),
      tx.get(collection("storeOrderRefunds").where("orderId", "==", orderId).limit(101)),
      tx.get(collection("storeOrderReturns").where("orderId", "==", orderId).limit(101)),
      tx.get(collection("orderReplacements").where("orderId", "==", orderId).limit(101)),
      tx.get(collection("stockLocations").where("input.status", "==", "active").limit(101)),
    ]);
    const data = order.data();
    if (!data || data.businessId !== businessId) fail("Order not found.", 404);
    if ([events, refunds, returns, replacements, locations].some(result => result.size > 100)) fail("This history needs administrator export before further updates.");
    const shipped = readFulfillment(fulfillment.data(), orderId), lines = readOrderAllocations(data), current = readCase(saved.data(), orderId);
    const refundState = readOrderRefundState(data.refundState);
    const replacementHistory = await Promise.all(replacements.docs.map(doc => tx.get(doc.ref.collection("history").orderBy("revision", "desc").limit(100))));
    return { current, eligible: !!shipped && shipped.input.method !== "pickup" && ["shipped", "delivered"].includes(shipped.input.status),
      trackingNumber: shipped?.input.trackingNumber ?? "",
      destination: shipped ? { recipientName: shipped.input.recipientName, address1: shipped.input.address1, address2: shipped.input.address2, city: shipped.input.city, region: shipped.input.region, postalCode: shipped.input.postalCode } : null,
      lines: lines.map(line => ({ variantId: line.variantId, sku: line.sku, name: line.name, quantity: line.quantity, fulfillment: line.fulfillment })),
      locations: locations.docs.filter(doc => doc.data().businessId === businessId && doc.data().input.kind !== "transit").map(doc => ({ id: doc.id, name: String(doc.data().input.name) })),
      replacements: replacements.docs.map((doc, index) => ({ id: doc.id, ...readReplacement(doc.data(), orderId), history: replacementHistory[index].docs.map(event => {
        const row = event.data(); return { revision: Number(row.revision), status: String(row.status), trackingNumber: String(row.trackingNumber), note: String(row.note), createdAt: String(row.createdAt) };
      }) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      history: events.docs.map(doc => { const row = doc.data(); return { revision: Number(row.revision), input: shipmentCaseInputSchema.parse(row.input), createdAt: String(row.createdAt), actorId: String(row.actorId) }; }),
      refunds: refunds.docs.filter(doc => { const row = doc.data(); return row.businessId === businessId && row.status === "succeeded" && refundState.refunds.some(r => r.id === row.providerId && r.status === "succeeded" && r.amountMinor === row.amountMinor); })
        .map(doc => ({ id: doc.id, amountMinor: Number(doc.data().amountMinor), providerId: String(doc.data().providerId) })),
      returns: returns.docs.filter(doc => doc.data().businessId === businessId).map(doc => ({ id: doc.id, sku: String(doc.data().sku), quantity: Number(doc.data().input.quantity), variantId: String(doc.data().input.variantId), disposition: String(doc.data().input.disposition) })),
    };
  });
}
export async function saveShipmentCase(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin") fail("Only super admins can manage shipment cases.", 403);
  const parsed = shipmentCaseRequestSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error.issues.map(issue => issue.message).join(" "), 400);
  const { orderId, operationId, expectedRevision, input } = parsed.data, fingerprint = hash(JSON.stringify(parsed.data));
  const ref = collection("storeShipmentCases").doc(orderId), op = collection("shipmentCaseOperations").doc(hash(staff.uid + ":" + operationId));
  return adminServices().db.runTransaction(async tx => {
    const old = await tx.get(op);
    if (old.exists) { if (old.data()!.fingerprint !== fingerprint) fail("This request ID was used for different case details."); return old.data()!.result as { id: string; revision: number }; }
    const [order, fulfillment, saved, refund, receipt, replacements] = await Promise.all([
      tx.get(collection("storeOrders").doc(orderId)), tx.get(collection("fulfillments").doc(orderId)), tx.get(ref),
      input.refundId ? tx.get(collection("storeOrderRefunds").doc(input.refundId)) : null,
      input.returnId ? tx.get(collection("storeOrderReturns").doc(input.returnId)) : null,
      tx.get(collection("orderReplacements").where("orderId", "==", orderId).limit(101)),
    ]);
    const data = order.data();
    if (!data || data.businessId !== businessId) fail("Order not found.", 404);
    const shipped = readFulfillment(fulfillment.data(), orderId), previous = readCase(saved.data(), orderId), lines = readOrderAllocations(data);
    if (!shipped || shipped.input.method === "pickup" || !["shipped", "delivered"].includes(shipped.input.status)) fail("Shipment cases require a dispatched shipping order. Pickup and unshipped orders use returns or cancellation.");
    if ((previous?.revision ?? 0) !== expectedRevision) fail("This case changed. Reload shipment case before saving again.");
    if (expectedRevision >= 100) fail("This case has reached 100 updates. Ask the administrator to export and reconcile it.");
    try { validateShipmentCase(previous?.input ?? null, input, lines); } catch (error) { fail(error instanceof Error ? error.message : "Invalid case update."); }
    if (replacements.size > 100) fail("Replacement history needs administrator reconciliation.");
    const retained = replacements.docs.map(doc => readReplacement(doc.data(), orderId)).filter(row => row.status !== "cancelled");
    if (retained.some(row => row.lines.length !== input.items.length || row.lines.some(line => !input.items.some(item => item.variantId === line.variantId && item.quantity === line.quantity))))
      fail("Affected items cannot change after a replacement is prepared. Cancel an unshipped replacement before correcting quantities.");
    if (input.status === "resolved" && retained.some(row => row.status === "prepared")) fail("Ship or cancel the prepared replacement before resolving this case.");
    if (input.resolution === "replacement" && !retained.some(row => ["shipped", "delivered"].includes(row.status))) fail("Dispatch a replacement before resolving the case as Replacement sent.");
    if (input.status === "resolved" && retained.length && !["replacement", "refund"].includes(input.resolution ?? "")) fail("Record the dispatched replacement or a confirmed refund in this case's resolution.");
    const refundData = refund?.data(), receiptData = receipt?.data();
    if (input.refundId && (!refundData || refundData.businessId !== businessId || refundData.orderId !== orderId || refundData.status !== "succeeded" ||
      !readOrderRefundState(data.refundState).refunds.some(r => r.id === refundData.providerId && r.status === "succeeded" && r.amountMinor === refundData.amountMinor)))
      fail("Choose a confirmed successful refund from this order. Check its status in Returns and refunds first.");
    if (input.returnId && (!receiptData || receiptData.businessId !== businessId || receiptData.orderId !== orderId || !input.items.some(item => item.variantId === receiptData.input?.variantId)))
      fail("Choose a received return from this order for an affected item.");
    const now = new Date().toISOString(), revision = expectedRevision + 1, result = { id: orderId, revision };
    const event = { businessId, orderId, revision, input, actorId: staff.uid, createdAt: now };
    tx.set(ref, { businessId, orderId, input, revision, createdAt: previous?.createdAt ?? now, updatedAt: now,
      trackingNumber: previous?.trackingNumber ?? shipped.input.trackingNumber,
      lines: saved.data()?.lines ?? lines.map(line => ({ variantId: line.variantId, sku: line.sku, quantity: line.quantity })), updatedBy: staff.uid });
    tx.create(ref.collection("history").doc(String(revision).padStart(3, "0")), event);
    tx.update(order.ref, { shipmentIssueStatus: input.status, shipmentIssueKind: input.kind });
    tx.create(op, { businessId, actorId: staff.uid, fingerprint, result, createdAt: now });
    tx.create(collection("inventoryAudit").doc(op.id), { ...event, resource: "storeShipmentCases", recordId: orderId, kind: "shipment_case_saved", before: previous?.input ?? null });
    return result;
  });
}
