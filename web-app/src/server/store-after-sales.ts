import "server-only";
import {
  readOrderRefundState,
  readReturnState,
  storePaymentOrderId,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { readFulfillment, readOrderAllocations } from "./fulfillment";
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
export async function orderAfterSales(orderId: string) {
  if (!storePaymentOrderId.safeParse(orderId).success)
    throw new AccessError(400, "after-sales", "Invalid order reference.");
  return adminServices().db.runTransaction(async (tx) => {
    const [order, fulfillment, refunds, returns, locations] = await Promise.all(
      [
        tx.get(collection("storeOrders").doc(orderId)),
        tx.get(collection("fulfillments").doc(orderId)),
        tx.get(
          collection("storeOrderRefunds")
            .where("orderId", "==", orderId)
            .limit(101),
        ),
        tx.get(
          collection("storeOrderReturns")
            .where("orderId", "==", orderId)
            .limit(101),
        ),
        tx.get(
          collection("stockLocations")
            .where("input.status", "==", "active")
            .limit(101),
        ),
      ],
    );
    const data = order.data();
    if (!data || data.businessId !== businessId)
      throw new AccessError(404, "after-sales", "Order not found.");
    if (refunds.size > 100 || returns.size > 100 || locations.size > 100)
      throw new AccessError(
        503,
        "after-sales",
        "After-sales history needs administrator export before more records can be shown.",
      );
    const saved = readFulfillment(fulfillment.data(), orderId),
      lines = readOrderAllocations(data);
    return {
      totalMinor: Number(data.totalMinor),
      refundState: readOrderRefundState(data.refundState),
      returnState: readReturnState(data.returnState),
      paymentMapped:
        !!data.paymentId &&
        data.paymentProvider === "stripe" &&
        data.stripeSource?.mode === "test",
      canRefund:
        !data.paymentReviewRequired &&
        !!saved &&
        ["cancelled", "shipped", "delivered"].includes(saved.input.status),
      canReturn:
        !!saved && ["shipped", "delivered"].includes(saved.input.status),
      lines: lines.map((line) => ({
        variantId: line.variantId,
        sku: line.sku,
        name: line.name,
        quantity: line.quantity,
        fulfillment: line.fulfillment,
      })),
      locations: locations.docs
        .filter(
          (doc) =>
            doc.data().businessId === businessId &&
            doc.data().input.kind !== "transit",
        )
        .map((doc) => ({ id: doc.id, name: String(doc.data().input.name) })),
      refunds: refunds.docs
        .map((doc) => {
          const row = doc.data();
          return {
            id: doc.id,
            amountMinor: Number(row.amountMinor),
            reason: String(row.reason),
            status: String(row.status),
            providerId: row.providerId as string | null,
            createdAt: String(row.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      returns: returns.docs
        .map((doc) => {
          const row = doc.data();
          return {
            id: doc.id,
            sku: String(row.sku),
            quantity: Number(row.input.quantity),
            disposition: String(row.input.disposition),
            locationName: row.locationName as string | null,
            notes: String(row.input.notes),
            createdAt: String(row.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  });
}
