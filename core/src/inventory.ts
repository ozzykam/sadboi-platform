import { z } from "zod";
export const inventoryId = z.string().regex(/^[a-f0-9]{64}$/);
const text = (max: number) => z.string().trim().max(max);
const state = z.enum(["active", "archived"]);
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");
const money = z.number().int().min(0).max(100_000_000);
const quantity = z.number().int().positive().max(1_000_000);
export const productInputSchema = z
  .object({
    artworkId: inventoryId,
    title: text(160).min(1),
    kind: z.enum(["print", "apparel", "accessory", "playing_card", "other"]),
    description: text(3000),
    imageAssetId: text(128).optional(),
    gradientStart: hexColor.optional(),
    gradientEnd: hexColor.optional(),
    status: state,
    publication: z.enum(["private", "public"]).optional(),
  })
  .strict();
export const stockVariantInputSchema = z
  .object({
    productId: inventoryId,
    sku: text(60)
      .min(1)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
      .transform((value) => value.toUpperCase()),
    name: text(160).min(1),
    description: text(3000).optional(),
    size: text(100),
    color: text(80),
    material: text(160),
    finish: text(160),
    priceMinor: money,
    currency: z.literal("USD"),
    weightGrams: z.number().int().positive().max(1_000_000).nullable(),
    fulfillment: z.enum(["stocked", "made_to_order"]),
    imageAssetId: text(128).optional(),
    status: state,
    publication: z.enum(["private", "public"]).optional(),
  })
  .strict();
export const stockLocationInputSchema = z
  .object({
    name: text(120).min(1),
    kind: z.enum(["studio", "gallery", "event", "transit"]),
    onlineEligible: z.boolean(),
    status: state,
  })
  .strict()
  .refine((value) => value.kind !== "transit" || !value.onlineEligible, {
    message: "Transit locations cannot fulfill website orders.",
    path: ["onlineEligible"],
  });
export const movementInputSchema = z
  .object({
    variantId: inventoryId,
    locationId: inventoryId,
    kind: z.enum([
      "receive",
      "receive_quarantined",
      "adjust",
      "quarantine",
      "release",
      "discard",
    ]),
    quantity: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0, "Quantity cannot be zero."),
    expectedRevision: z.number().int().min(0).nullable(),
    reason: text(1000).min(3),
    reference: text(160),
    unitCostMinor: money.nullable(),
  })
  .strict()
  .refine((value) => value.kind === "adjust" || value.quantity > 0, {
    message: "Use a positive quantity for this movement.",
    path: ["quantity"],
  })
  .refine(
    (value) =>
      value.kind.startsWith("receive") || value.expectedRevision !== null,
    {
      message: "Refresh the balance before adjusting it.",
      path: ["expectedRevision"],
    },
  )
  .refine(
    (value) => value.kind.startsWith("receive") || value.unitCostMinor === null,
    {
      message: "Unit cost applies only to receiving.",
      path: ["unitCostMinor"],
    },
  );
export const dispatchInputSchema = z
  .object({
    variantId: inventoryId,
    fromId: inventoryId,
    toId: inventoryId,
    quantity,
    reason: text(1000).min(3),
    reference: text(160),
  })
  .strict()
  .refine((value) => value.fromId !== value.toId, {
    message: "Choose different source and destination locations.",
    path: ["toId"],
  });
export const transferReceiptSchema = z
  .object({
    transferId: inventoryId,
    kind: z.enum(["receive", "receive_quarantined", "loss"]),
    quantity,
    reason: text(1000).min(3),
  })
  .strict();
export const stockCountInputSchema = z
  .object({
    variantId: inventoryId,
    locationId: inventoryId,
    countedOnHand: z.number().int().min(0).max(1_000_000_000),
    expectedRevision: z.number().int().min(0).max(1_000_000_000),
    reason: text(1000).min(3),
    reference: text(160),
  })
  .strict();
export const stockPolicyInputSchema = z
  .object({
    variantId: inventoryId,
    locationId: inventoryId,
    minimum: z.number().int().min(0).max(999_999),
    target: z.number().int().positive().max(1_000_000),
    enabled: z.boolean(),
    expectedRevision: z.number().int().min(0).max(1_000_000_000),
  })
  .strict()
  .refine((input) => input.target > input.minimum, {
    message: "Target stock must be greater than the low-stock threshold.",
    path: ["target"],
  });
export type ProductInput = z.infer<typeof productInputSchema>;
export type StockVariantInput = z.infer<typeof stockVariantInputSchema>;
export type StockLocationInput = z.infer<typeof stockLocationInputSchema>;
export type MovementInput = z.infer<typeof movementInputSchema>;
export type DispatchInput = z.infer<typeof dispatchInputSchema>;
export type TransferReceiptInput = z.infer<typeof transferReceiptSchema>;
export type StockCountInput = z.infer<typeof stockCountInputSchema>;
export type StockPolicyInput = z.infer<typeof stockPolicyInputSchema>;
export type InventoryRecord<T> = T & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type ProductRecord = InventoryRecord<ProductInput>;
export type StockVariantRecord = InventoryRecord<StockVariantInput> & {
  imageAssetIds?: string[];
};
export type StockLocationRecord = InventoryRecord<StockLocationInput>;
export type StockPolicyRecord = InventoryRecord<
  Omit<StockPolicyInput, "expectedRevision">
>;
export type ReplenishmentItem = {
  variantId: string;
  locationId: string;
  sku: string;
  variantName: string;
  productTitle: string;
  locationName: string;
  available: number;
  minimum: number;
  target: number;
  suggested: number;
};
export type ReplenishmentQueue = {
  items: ReplenishmentItem[];
  enabledPolicies: number;
  generatedAt: string;
};
export type StockBalance = {
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  allocated: number;
  unavailable: number;
  revision: number;
};
export type InventoryCatalog = {
  products: ProductRecord[];
  variants: StockVariantRecord[];
  locations: StockLocationRecord[];
};
export type InventoryMovement = {
  id: string;
  kind: string;
  variantId: string;
  sku: string;
  variantName: string;
  productTitle: string;
  locationId: string;
  locationName: string;
  otherLocationName: string | null;
  quantity: number;
  onHandDelta: number;
  reason: string;
  reference: string;
  unitCostMinor: number | null;
  transferId: string | null;
  actorId: string;
  createdAt: string;
  before: StockBalance | null;
  after: StockBalance | null;
  countedOnHand: number | null;
  purchaseDelivery: {
    orderId: string;
    accepted: number;
    quarantined: number;
    rejected: number;
  } | null;
};
export type StockTransfer = {
  id: string;
  variantId: string;
  sku: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  quantity: number;
  received: number;
  lost: number;
  remaining: number;
  status: "in_transit" | "received" | "closed_with_loss";
  reason: string;
  reference: string;
  createdAt: string;
};
export type InventoryStock = {
  balances: StockBalance[];
  transfers: StockTransfer[];
  movements: InventoryMovement[];
  policies: StockPolicyRecord[];
  nextCursor: string | null;
};
export function stockAvailable(balance: StockBalance) {
  return (
    balance.onHand - balance.reserved - balance.allocated - balance.unavailable
  );
}
export function assertStock(balance: StockBalance): StockBalance {
  for (const key of [
    "onHand",
    "reserved",
    "allocated",
    "unavailable",
    "revision",
  ] as const) {
    if (
      !Number.isSafeInteger(balance[key]) ||
      balance[key] < 0 ||
      balance[key] > 1_000_000_000
    )
      throw new Error("Stock quantity is outside its supported range.");
  }
  if (stockAvailable(balance) < 0)
    throw new Error(
      "This movement would use reserved, allocated, or unavailable stock.",
    );
  return balance;
}
export function moveStock(
  balance: StockBalance,
  kind: MovementInput["kind"],
  count: number,
): StockBalance {
  if (
    !Number.isSafeInteger(count) ||
    count === 0 ||
    Math.abs(count) > 1_000_000 ||
    (kind !== "adjust" && count < 0)
  )
    throw new Error("Invalid movement quantity.");
  assertStock(balance);
  const next = { ...balance, revision: balance.revision + 1 };
  if (kind === "receive" || kind === "adjust") next.onHand += count;
  else if (kind === "receive_quarantined") {
    next.onHand += count;
    next.unavailable += count;
  } else if (kind === "quarantine") next.unavailable += count;
  else if (kind === "release") next.unavailable -= count;
  else if (kind === "discard") {
    next.onHand -= count;
    next.unavailable -= count;
  }
  return assertStock(next);
}
export function reconcileStock(
  balance: StockBalance,
  countedOnHand: number,
): StockBalance {
  assertStock(balance);
  if (
    !Number.isSafeInteger(countedOnHand) ||
    countedOnHand < 0 ||
    countedOnHand > 1_000_000_000
  )
    throw new Error("Enter a whole physical count of zero or more.");
  if (
    countedOnHand <
    balance.reserved + balance.allocated + balance.unavailable
  )
    throw new Error(
      "This count is below reserved, allocated, and unavailable units. Reconcile those units before recording the count.",
    );
  return assertStock({
    ...balance,
    onHand: countedOnHand,
    revision: balance.revision + 1,
  });
}
export function replenishmentNeed(
  balance: StockBalance,
  policy: Pick<StockPolicyInput, "minimum" | "target" | "enabled">,
) {
  const available = stockAvailable(assertStock(balance));
  return policy.enabled && available <= policy.minimum
    ? { available, suggested: policy.target - available }
    : null;
}
export function parseUsd(value: string): number {
  if (!/^\d+(\.\d{0,2})?$/.test(value.trim()))
    throw new Error("Enter a USD amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return money.parse(result);
}
