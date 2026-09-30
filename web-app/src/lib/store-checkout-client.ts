"use client";

import { storeOrderRequestSchema, type StoreOrderInput, type CheckoutTotals } from "@sadboi/core";
import { InventoryRequestError, inventoryRequest } from "./inventory-client";

const key = "sadboi-pending-checkout";
export type CheckoutAttempt = { operationId: string; input: StoreOrderInput; quoteId?: string };

export function pendingCheckout(): CheckoutAttempt | null {
  try {
    const parsed = storeOrderRequestSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function savePendingCheckout(attempt: CheckoutAttempt | null) {
  // Checkout still works when browser storage is unavailable. The caller keeps
  // the same attempt in memory for retries in that case.
  try {
    if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt));
    else sessionStorage.removeItem(key);
  } catch {
    /* Storage can be blocked or full. */
  }
}

export function checkoutWasRejected(error: unknown) {
  // Only a definitive checkout rejection allows a new request. An auth/CSRF
  // error during recovery says nothing about whether the earlier save worked.
  return (
    error instanceof InventoryRequestError &&
    error.code === "store-order" &&
    (error.status === 400 || error.status === 409)
  );
}

export async function submitCheckout(attempt: CheckoutAttempt) {
  const result = await inventoryRequest("/api/store/orders", {
    method: "POST",
    body: JSON.stringify(attempt),
  });
  if (
    typeof result?.id !== "string" ||
    typeof result?.orderNumber !== "string" ||
    !Number.isSafeInteger(result?.totalMinor)
  )
    throw new Error(
      "The order response was incomplete. Retry to recover your order number.",
    );
  return result as { id: string; orderNumber: string; totalMinor: number; managementToken?: string; expiresAt?: string; pricing?: CheckoutTotals };
}
