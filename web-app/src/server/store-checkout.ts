import "server-only";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import {
  assertStock,
  stockAvailable,
  stockVariantInputSchema,
  storeOrderRequestSchema,
  type StockBalance,
  orderHoldMinutes,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { inventoryBalanceRef } from "./inventory";

const collection = (name: string) =>
  adminServices().db.collection(`businesses/${businessId}/${name}`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "store-order", message);
}

export async function createStoreOrder(raw: unknown) {
  const parsed = storeOrderRequestSchema.safeParse(raw);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const { input, operationId } = parsed.data;
  const fingerprint = hash(JSON.stringify(input));
  const operationRef = collection("storeOrderOperations").doc(
    hash(operationId),
  );
  const orderRef = collection("storeOrders").doc(
    randomUUID().replaceAll("-", ""),
  );
  const counterRef = collection("inventoryState").doc("store");

  return adminServices().db.runTransaction(async (tx) => {
    const previous = await tx.get(operationRef);
    if (previous.exists) {
      if (previous.data()!.fingerprint !== fingerprint)
        throw new AccessError(
          409,
          "store-order-request-conflict",
          "This request was already used for different order details. Recover the original request before starting another.",
        );
      return previous.data()!.result as {
        id: string;
        orderNumber: string;
        totalMinor: number;
        managementToken?: string;
        expiresAt?: string;
      };
    }
    const [counter, locations, variantDocs] = await Promise.all([
      tx.get(counterRef),
      tx.get(
        collection("stockLocations")
          .where("input.onlineEligible", "==", true)
          .where("input.status", "==", "active")
          .limit(101),
      ),
      Promise.all(
        input.lines.map((line) =>
          tx.get(collection("productVariants").doc(line.variantId)),
        ),
      ),
    ]);
    if (locations.size > 100)
      fail("Online stock needs review before this order can be placed.", 503);
    const variants = variantDocs.map((doc) => {
      const variant = stockVariantInputSchema.safeParse(doc.data()?.input);
      if (
        !variant.success ||
        variant.data.status !== "active" ||
        variant.data.publication !== "public"
      )
        fail("A selected product is no longer available.");
      return variant.data;
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

    // Firestore requires every read to finish before the first write, including
    // balances for later cart lines. Missing balances never create stock.
    const balancesByLine = await Promise.all(
      input.lines.map((line, index) =>
        variants[index].fulfillment === "made_to_order"
          ? Promise.resolve([])
          : Promise.all(
              locations.docs.map((location) =>
                tx.get(inventoryBalanceRef(line.variantId, location.id)),
              ),
            ),
      ),
    );
    const now = new Date().toISOString();
    let totalMinor = 0;
    const snapshots = input.lines.map((line, index) => {
      const variant = variants[index];
      const allocations: Array<{ locationId: string; quantity: number }> = [];
      let remaining = variant.fulfillment === "stocked" ? line.quantity : 0;
      for (const balance of balancesByLine[index]) {
        if (!remaining) break;
        if (!balance.exists) continue;
        const stock = assertStock(balance.data() as StockBalance);
        const take = Math.min(remaining, stockAvailable(stock));
        if (!take) continue;
        tx.update(balance.ref, {
          allocated: stock.allocated + take,
          revision: stock.revision + 1,
          updatedAt: now,
        });
        allocations.push({ locationId: stock.locationId, quantity: take });
        remaining -= take;
      }
      if (remaining)
        fail("A selected product does not have enough available stock.");
      totalMinor += line.quantity * variant.priceMinor;
      return {
        ...line,
        sku: variant.sku,
        name: variant.name,
        productId: variant.productId,
        productTitle: products[index].data()!.input.title,
        unitCostMinor: variant.priceMinor,
        fulfillment: variant.fulfillment,
        allocations,
      };
    });
    const count = counter.data()?.orders ?? 0;
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      !Number.isSafeInteger(count + 1)
    )
      fail("Order numbering needs review.", 503);
    const orderNumber = `SO-${String(count + 1).padStart(6, "0")}`;
    const managementToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + orderHoldMinutes * 60_000).toISOString();
    const result = { id: orderRef.id, orderNumber, totalMinor, managementToken, expiresAt };
    tx.create(orderRef, {
      input,
      lines: snapshots,
      totalMinor,
      orderNumber,
      status: "pending_payment",
      expiresAt, managementTokenHash: hash(managementToken), allocationState: "held", lifecycleRevision: 0,
      businessId,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(counterRef, { orders: count + 1 }, { merge: true });
    tx.create(operationRef, { fingerprint, result, createdAt: now });
    return result;
  });
}
