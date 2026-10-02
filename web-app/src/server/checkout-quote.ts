import "server-only";
import { createHash } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import {
  calculateCheckoutTotals,
  shippingForOrder,
  stockVariantInputSchema,
  storeOrderInputSchema,
  type StoreOrderInput,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { readShippingSettings, shippingSettingsRef } from "./shipping";
const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
function fail(message: string, status = 409): never {
  throw new AccessError(status, "store-order", message);
}

// Used by both the read-only quote and the order transaction. No client price,
// rate, total or previously returned quote is authoritative.
export async function readCheckoutQuote(
  tx: Transaction,
  input: StoreOrderInput,
) {
  const [settings, docs] = await Promise.all([
    tx.get(shippingSettingsRef()),
    Promise.all(
      input.lines.map((line) =>
        tx.get(collection("productVariants").doc(line.variantId)),
      ),
    ),
  ]);
  const variants = docs.map((doc) => {
    const parsed = stockVariantInputSchema.safeParse(doc.data()?.input);
    if (
      !parsed.success ||
      parsed.data.status !== "active" ||
      parsed.data.publication !== "public"
    )
      fail("A selected product is no longer available.");
    return parsed.data;
  });
  const products = await Promise.all(
    variants.map((variant) =>
      tx.get(collection("products").doc(variant.productId)),
    ),
  );
  if (
    products.some(
      (doc) =>
        doc.data()?.input.status !== "active" ||
        doc.data()?.input.publication !== "public",
    )
  )
    fail("A selected product is no longer available.");
  const lines = input.lines.map((line, i) => ({
    ...line,
    priceMinor: variants[i].priceMinor,
    sku: variants[i].sku,
    name: variants[i].name,
    productId: variants[i].productId,
    productTitle: String(products[i].data()!.input.title),
    fulfillment: variants[i].fulfillment,
  }));
  let totals;
  try {
    totals = calculateCheckoutTotals(
      lines,
      shippingForOrder(input, readShippingSettings(settings.data())),
    );
  } catch (error) {
    if (error instanceof AccessError) throw error;
    fail(
      error instanceof Error ? error.message : "This order cannot be priced.",
    );
  }
  const id = createHash("sha256")
    .update(JSON.stringify({ input, lines, totals }))
    .digest("hex");
  return { id, totals, lines };
}
export async function checkoutQuote(raw: unknown) {
  const input = storeOrderInputSchema.safeParse(raw);
  if (!input.success)
    fail(input.error.issues.map((issue) => issue.message).join(" "), 400);
  return adminServices().db.runTransaction((tx) =>
    readCheckoutQuote(tx, input.data),
  );
}
