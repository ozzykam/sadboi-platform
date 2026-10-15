import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type {
  Transaction,
  DocumentSnapshot,
  DocumentReference,
} from "firebase-admin/firestore";
import {
  productInputSchema,
  stockVariantInputSchema,
  stockLocationInputSchema,
  movementInputSchema,
  dispatchInputSchema,
  transferReceiptSchema,
  assertStock,
  stockAvailable,
  moveStock,
  type ProductInput,
  type StockVariantInput,
  type StockLocationInput,
  type StockBalance,
  type InventoryCatalog,
  type InventoryStock,
  type InventoryMovement,
  type StockTransfer,
  stockCountInputSchema,
  stockPolicyInputSchema,
  reconcileStock,
  replenishmentNeed,
  type StockPolicyRecord,
  type ReplenishmentQueue,
  reservationInputSchema,
  type ReservationCatalog,
  type ReservationRecord,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import {
  AccessError,
  businessId,
  cookieName,
  staffForCookie,
  type Staff,
} from "./staff";
import { ensureStaffMode, authResponse } from "./auth-http";
import { operationId } from "./artworks";
import {
  inventoryImageAssetId,
  inventoryImages,
} from "./inventory-image-reference";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const root = () => adminServices().db.doc("businesses/" + businessId);
const collection = (name: string) => root().collection(name);
export function inventoryId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new AccessError(400, "invalid-id", "Invalid inventory record.");
  return value;
}
function fail(message: string, status = 409): never {
  throw new AccessError(status, "inventory-conflict", message);
}
function keys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail("Unexpected inventory fields.", 400);
}
function parsed<T>(
  schema: {
    safeParse(value: unknown): {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success)
    fail(result.error!.issues.map((issue) => issue.message).join(" "), 400);
  return result.data!;
}
export async function inventoryStaff(write = false): Promise<Staff> {
  ensureStaffMode();
  const staff = await staffForCookie(
    (await cookies()).get(cookieName("session"))?.value,
  );
  if (!staff)
    throw new AccessError(
      401,
      "sign-in",
      "Your session has ended. Sign in again to continue.",
    );
  if (
    write
      ? staff.role !== "super_admin"
      : !["super_admin", "accounting"].includes(staff.role)
  )
    throw new AccessError(
      403,
      "forbidden",
      "Your staff role does not allow this action.",
    );
  return staff;
}
export function inventoryFailure(error: unknown) {
  if (error instanceof AccessError)
    return authResponse(
      { error: error.message, code: error.code },
      error.status,
    );
  console.error("Inventory operation failed", {
    code: (error as { code?: string }).code ?? "service-error",
  });
  return authResponse(
    {
      error:
        "Inventory is temporarily unavailable. Keep your entries and retry the same operation.",
      code: "unavailable",
    },
    503,
  );
}
type Result = { id: string };
async function operate(
  kind: string,
  payload: unknown,
  key: unknown,
  staff: Staff,
  apply: (tx: Transaction, id: string, now: string) => Promise<Result>,
) {
  const id = hash(staff.uid + ":" + operationId(key)),
    fingerprint = hash(JSON.stringify({ kind, payload }));
  const ref = collection("inventoryOperations").doc(id),
    member = root().collection("memberships").doc(staff.uid);
  return adminServices().db.runTransaction(async (tx) => {
    const [prior, membership] = await Promise.all([
      tx.get(ref),
      tx.get(member),
    ]);
    const access = membership.data();
    if (
      access?.status !== "active" ||
      access.role !== "super_admin" ||
      access.businessId !== businessId ||
      access.userId !== staff.uid ||
      access.email !== staff.email
    )
      throw new AccessError(
        403,
        "forbidden",
        "Your inventory access has changed.",
      );
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail(
          "This request was already used for another action. Refresh before starting a new operation.",
        );
      return prior.data()!.result as Result;
    }
    const now = new Date().toISOString();
    const result = await apply(tx, id, now);
    tx.create(ref, {
      kind,
      fingerprint,
      result,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
type Resource = "products" | "variants" | "locations";
export function metadataResource(value: string): value is Resource {
  return ["products", "variants", "locations"].includes(value);
}
const schemas = {
  products: productInputSchema,
  variants: stockVariantInputSchema,
  locations: stockLocationInputSchema,
};
const names = {
  products: "products",
  variants: "productVariants",
  locations: "stockLocations",
};
const limits = { products: 500, variants: 500, locations: 100 };
function dto(resource: Resource, snapshot: DocumentSnapshot) {
  const data = snapshot.data()!;
  const input = schemas[resource].parse(data.input);
  return {
    ...input,
    ...(resource === "variants"
      ? { imageAssetIds: inventoryImages(data).map((image) => image.assetId) }
      : {}),
    ...(resource !== "locations" && inventoryImageAssetId(data)
      ? { imageAssetId: inventoryImageAssetId(data) }
      : {}),
    id: snapshot.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
export async function inventoryCatalog(): Promise<InventoryCatalog> {
  const resources = ["products", "variants", "locations"] as const;
  const sets = await Promise.all(
    resources.map((kind) =>
      collection(names[kind])
        .limit(limits[kind] + 1)
        .get(),
    ),
  );
  for (let i = 0; i < resources.length; i++)
    if (sets[i].size > limits[resources[i]])
      fail(
        "The inventory catalog needs pagination before more records can be shown.",
        503,
      );
  return {
    products: sets[0].docs.map((doc) =>
      dto("products", doc),
    ) as InventoryCatalog["products"],
    variants: sets[1].docs.map((doc) =>
      dto("variants", doc),
    ) as InventoryCatalog["variants"],
    locations: sets[2].docs.map((doc) =>
      dto("locations", doc),
    ) as InventoryCatalog["locations"],
  };
}
export async function saveMetadata(
  resource: Resource,
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  keys(
    body,
    editing
      ? ["id", "revision", "input", "operationId"]
      : ["input", "operationId"],
  );
  const result = schemas[resource].safeParse(body.input);
  if (!result.success)
    fail(result.error.issues.map((issue) => issue.message).join(" "), 400);
  const submittedInput = result.data;
  const target = editing ? inventoryId(body.id) : null;
  if (
    editing &&
    (!Number.isSafeInteger(body.revision) || (body.revision as number) < 1)
  )
    fail("A current record revision is required.", 400);
  return operate(
    (editing ? "update:" : "create:") + resource,
    { target, revision: body.revision ?? null, input: submittedInput },
    body.operationId,
    staff,
    async (tx, id, now) => {
      let input = submittedInput;
      const ref = collection(names[resource]).doc(target ?? id),
        counterRef = collection("inventoryState").doc("counts");
      const [record, counters] = await Promise.all([
        tx.get(ref),
        tx.get(counterRef),
      ]);
      const data = record.data();
      if (editing && !record.exists) fail("Inventory record not found.", 404);
      if (editing && data!.revision !== body.revision)
        fail(
          "This record changed. Refresh its details before saving your edits.",
        );
      if (editing && (resource === "products" || resource === "variants")) {
        // Uploads are saved independently. Never let an older metadata form
        // clear or replace the image selected by the upload endpoint.
        const { imageAssetId: ignored, ...fields } = input as
          ProductInput | StockVariantInput;
        void ignored;
        const imageAssetId = inventoryImageAssetId(data!);
        input = {
          ...fields,
          ...(imageAssetId ? { imageAssetId } : {}),
        } as typeof input;
      }
      if (!editing && record.exists) fail("Inventory record already exists.");
      const count = counters.data()?.[resource] ?? 0;
      if (!editing && count >= limits[resource])
        fail("This catalog has reached its supported " + resource + " limit.");
      let skuRef: DocumentReference | null = null;
      if (resource === "products") {
        const product = input as ProductInput;
        if (editing && product.artworkId !== data!.input.artworkId)
          fail("An existing product cannot be reassigned to another artwork.");
        const artwork = await tx.get(
          collection("artworks").doc(product.artworkId),
        );
        if (!artwork.exists) fail("Choose an existing artwork.", 400);
      } else if (resource === "variants") {
        const variant = input as StockVariantInput;
        if (
          editing &&
          (variant.productId !== data!.input.productId ||
            variant.sku !== data!.input.sku)
        )
          fail(
            "SKU and product links are permanent. Create another variant instead.",
          );
        const parent = await tx.get(
          collection("products").doc(variant.productId),
        );
        if (!parent.exists) fail("Choose an existing product.", 400);
        if (!editing && parent.data()!.input.status === "archived")
          fail("Restore the product before adding a variant.");
        skuRef = collection("skuClaims").doc(hash(variant.sku));
        const claim = await tx.get(skuRef);
        if (claim.exists && claim.data()!.variantId !== ref.id)
          fail("This SKU is already assigned. Choose a unique SKU.");
      } else if (
        editing &&
        (input as StockLocationInput).status === "archived"
      ) {
        if (
          (data!.onHandUnits ?? 0) > 0 ||
          (data!.incomingUnits ?? 0) > 0 ||
          (data!.outgoingUnits ?? 0) > 0
        )
          fail(
            "Empty this location and complete its transfers before archiving it.",
          );
      }
      const revision = editing ? data!.revision + 1 : 1;
      const metadata = {
        input,
        businessId,
        revision,
        updatedAt: now,
        updatedBy: staff.uid,
      };
      if (editing) tx.update(ref, metadata);
      else
        tx.create(ref, {
          ...metadata,
          createdAt: now,
          createdBy: staff.uid,
          ...(resource === "locations"
            ? { onHandUnits: 0, incomingUnits: 0, outgoingUnits: 0 }
            : {}),
          ...(resource === "variants" ? { openTransferCount: 0 } : {}),
        });
      if (!editing)
        tx.set(counterRef, { [resource]: count + 1 }, { merge: true });
      if (resource === "variants" && !editing)
        tx.create(skuRef!, {
          variantId: ref.id,
          sku: (input as StockVariantInput).sku,
          createdAt: now,
        });
      tx.create(collection("inventoryAudit").doc(id), {
        kind: editing ? "updated" : "created",
        resource,
        recordId: ref.id,
        actorId: staff.uid,
        createdAt: now,
        before: editing ? data!.input : null,
        after: input,
      });
      return { id: ref.id };
    },
  );
}
const balanceRef = (variantId: string, locationId: string) =>
  collection("stockBalances").doc(hash(variantId + ":" + locationId));
export {
  operate as inventoryOperation,
  balanceRef as inventoryBalanceRef,
  balance as readInventoryBalance,
  requireLocation as activeInventoryLocation,
  total as inventoryTotal,
};
function reservationProjection(doc: DocumentSnapshot): ReservationRecord {
  const data = doc.data()!,
    input = reservationInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    sku: data.sku,
    variantName: data.variantName,
    locationName: data.locationName,
  };
}
export async function reservationCatalog(): Promise<ReservationCatalog> {
  const result = await collection("reservations").limit(501).get();
  if (result.size > 500)
    fail("Reservations need pagination before more than 500 records.", 503);
  return {
    reservations: result.docs
      .map(reservationProjection)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
export async function saveReservation(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  keys(
    body,
    editing
      ? ["input", "operationId", "id", "revision"]
      : ["input", "operationId"],
  );
  const parsed = reservationInputSchema.safeParse(body.input);
  if (!parsed.success)
    fail(parsed.error.issues.map((issue) => issue.message).join(" "), 400);
  const input = parsed.data,
    target = editing ? inventoryId(body.id) : null;
  return operate(
    "reservation:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("reservations").doc(target ?? id),
        previous = await tx.get(ref),
        variant = await tx.get(
          collection("productVariants").doc(input.variantId),
        ),
        location = await tx.get(
          collection("stockLocations").doc(input.locationId),
        ),
        stock = await tx.get(balanceRef(input.variantId, input.locationId));
      if (editing && !previous.exists) fail("Reservation not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This reservation changed. Refresh before editing it.");
      if (!variant.exists || !location.exists)
        fail("Choose an active SKU and location.");
      const site = requireLocation(location),
        before = balance(stock, input.variantId, input.locationId);
      if (variant.data()!.input.status !== "active")
        fail("Restore the variant before reserving stock.");
      const old = previous.exists
        ? reservationInputSchema.parse(previous.data()!.input)
        : null;
      if (
        old &&
        (old.variantId !== input.variantId ||
          old.locationId !== input.locationId)
      )
        fail(
          "Edit the existing SKU and location in place; release this reservation before moving it.",
        );
      const oldReserved = old && old.status === "reserved" ? old.quantity : 0,
        oldAllocated = old && old.status === "allocated" ? old.quantity : 0,
        nextReserved = input.status === "reserved" ? input.quantity : 0,
        nextAllocated = input.status === "allocated" ? input.quantity : 0;
      const after = assertStock({
        ...before,
        reserved: before.reserved - oldReserved + nextReserved,
        allocated: before.allocated - oldAllocated + nextAllocated,
        revision: before.revision + 1,
      });
      if (stockAvailable(after) < 0)
        fail("Not enough available stock for this reservation.");
      tx.set(balanceRef(input.variantId, input.locationId), {
        ...after,
        businessId,
        updatedAt: now,
      });
      tx.set(ref, {
        input,
        businessId,
        sku: variant.data()!.input.sku,
        variantName: variant.data()!.input.name,
        locationName: site.input.name,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "reservations",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: old,
        after: input,
        actorId: staff.uid,
        createdAt: now,
        stockBefore: before,
        stockAfter: after,
      });
      return { id: ref.id };
    },
  );
}
function balance(
  snapshot: DocumentSnapshot,
  variantId: string,
  locationId: string,
): StockBalance {
  const data = snapshot.data();
  if (
    data &&
    (data.variantId !== variantId ||
      data.locationId !== locationId ||
      data.businessId !== businessId)
  )
    fail("Invalid inventory ownership.", 503);
  return assertStock({
    variantId,
    locationId,
    onHand: data?.onHand ?? 0,
    reserved: data?.reserved ?? 0,
    allocated: data?.allocated ?? 0,
    unavailable: data?.unavailable ?? 0,
    revision: data?.revision ?? 0,
  });
}
function transition(
  current: StockBalance,
  kind: Parameters<typeof moveStock>[1],
  quantity: number,
) {
  try {
    return moveStock(current, kind, quantity);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid stock movement.");
  }
}
function total(value: number, delta: number) {
  const result = value + delta;
  if (!Number.isSafeInteger(result) || result < 0 || result > 1_000_000_000)
    fail("Location totals would become invalid.");
  return result;
}
function requireLocation(snapshot: DocumentSnapshot) {
  if (!snapshot.exists) fail("Location not found.", 404);
  if (snapshot.data()!.input.status !== "active")
    fail("Restore the location before moving stock.");
  return snapshot.data()!;
}
function movementProjection(doc: DocumentSnapshot): InventoryMovement {
  const d = doc.data()!;
  return {
    id: doc.id,
    kind: d.kind,
    variantId: d.variantId,
    sku: d.sku,
    variantName: d.variantName,
    productTitle: d.productTitle,
    locationId: d.locationId,
    locationName: d.locationName,
    otherLocationName: d.otherLocationName,
    quantity: d.quantity,
    onHandDelta: d.onHandDelta,
    reason: d.reason,
    reference: d.reference,
    unitCostMinor: d.unitCostMinor,
    transferId: d.transferId,
    actorId: d.actorId,
    createdAt: d.createdAt,
    before: d.before,
    after: d.after,
    countedOnHand: d.countedOnHand ?? null,
    purchaseDelivery: d.purchaseOrderId
      ? {
          orderId: d.purchaseOrderId,
          accepted: d.accepted,
          quarantined: d.quarantined,
          rejected: d.rejected,
        }
      : null,
  };
}
function transferProjection(doc: DocumentSnapshot): StockTransfer {
  const d = doc.data()!;
  return {
    id: doc.id,
    variantId: d.variantId,
    sku: d.sku,
    fromId: d.fromId,
    toId: d.toId,
    fromName: d.fromName,
    toName: d.toName,
    quantity: d.quantity,
    received: d.received,
    lost: d.lost,
    remaining: d.remaining,
    status: d.status,
    reason: d.reason,
    reference: d.reference,
    createdAt: d.createdAt,
  };
}
export async function inventoryStock(
  variantId: string,
  cursor?: string | null,
): Promise<InventoryStock> {
  inventoryId(variantId);
  const variant = await collection("productVariants").doc(variantId).get();
  if (!variant.exists) fail("Variant not found.", 404);
  let history = collection("inventoryMovements")
    .where("variantId", "==", variantId)
    .orderBy("createdAt", "desc")
    .limit(51);
  if (cursor) {
    const previous = await collection("inventoryMovements")
      .doc(inventoryId(cursor))
      .get();
    if (!previous.exists || previous.data()!.variantId !== variantId)
      fail("Invalid movement cursor.", 400);
    history = history.startAfter(previous);
  }
  const [balances, transfers, movements, policies] = await Promise.all([
    collection("stockBalances")
      .where("variantId", "==", variantId)
      .limit(101)
      .get(),
    collection("stockTransfers")
      .where("variantId", "==", variantId)
      .where("status", "==", "in_transit")
      .orderBy("createdAt", "desc")
      .limit(101)
      .get(),
    history.get(),
    collection("stockPolicies")
      .where("input.variantId", "==", variantId)
      .limit(101)
      .get(),
  ]);
  if (balances.size > 100 || transfers.size > 100 || policies.size > 100)
    fail("Inventory exceeds the supported view size.", 503);
  const page = movements.docs.slice(0, 50);
  return {
    balances: balances.docs.map((doc) =>
      balance(doc, variantId, doc.data().locationId),
    ),
    transfers: transfers.docs.map(transferProjection),
    movements: page.map(movementProjection),
    policies: policies.docs.map(policyProjection),
    nextCursor: movements.size > 50 ? page.at(-1)!.id : null,
  };
}
export async function postMovement(
  body: Record<string, unknown>,
  staff: Staff,
) {
  keys(body, ["input", "operationId"]);
  const input = parsed(movementInputSchema, body.input);
  return operate(
    "movement",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const variantRef = collection("productVariants").doc(input.variantId),
        locationRef = collection("stockLocations").doc(input.locationId),
        stockRef = balanceRef(input.variantId, input.locationId);
      const [variant, location, stock] = await Promise.all([
        tx.get(variantRef),
        tx.get(locationRef),
        tx.get(stockRef),
      ]);
      if (!variant.exists) fail("Variant not found.", 404);
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists) fail("Product not found.", 404);
      const site = requireLocation(location),
        before = balance(stock, input.variantId, input.locationId);
      if (
        input.kind.startsWith("receive") &&
        (variant.data()!.input.status !== "active" ||
          product.data()!.input.status !== "active")
      )
        fail("Restore the product and variant before receiving new stock.");
      if (
        !input.kind.startsWith("receive") &&
        before.revision !== input.expectedRevision
      )
        fail("This balance changed. Refresh it before adjusting stock.");
      const after = transition(before, input.kind, input.quantity),
        delta = after.onHand - before.onHand;
      tx.set(stockRef, { ...after, businessId, updatedAt: now });
      tx.update(locationRef, {
        onHandUnits: total(site.onHandUnits ?? 0, delta),
      });
      tx.create(collection("inventoryMovements").doc(id), {
        ...input,
        businessId,
        sku: variant.data()!.input.sku,
        variantName: variant.data()!.input.name,
        productTitle: product.data()!.input.title,
        locationName: site.input.name,
        otherLocationName: null,
        onHandDelta: delta,
        transferId: null,
        before,
        after,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id };
    },
  );
}
export async function postStockCount(
  body: Record<string, unknown>,
  staff: Staff,
) {
  keys(body, ["input", "operationId"]);
  const input = parsed(stockCountInputSchema, body.input);
  return operate(
    "stocktake",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const locationRef = collection("stockLocations").doc(input.locationId);
      const stockRef = balanceRef(input.variantId, input.locationId);
      const [variant, location, stock] = await Promise.all([
        tx.get(collection("productVariants").doc(input.variantId)),
        tx.get(locationRef),
        tx.get(stockRef),
      ]);
      if (!variant.exists) fail("Variant not found.", 404);
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists) fail("Product not found.", 404);
      const site = requireLocation(location),
        before = balance(stock, input.variantId, input.locationId);
      if (before.revision !== input.expectedRevision)
        fail(
          "Stock changed after this count was started. Refresh the balance and recount before recording it.",
        );
      let after: StockBalance;
      try {
        after = reconcileStock(before, input.countedOnHand);
      } catch (error) {
        fail(
          error instanceof Error ? error.message : "Invalid physical count.",
        );
      }
      const delta = after.onHand - before.onHand;
      tx.set(stockRef, { ...after, businessId, updatedAt: now });
      tx.update(locationRef, {
        onHandUnits: total(site.onHandUnits ?? 0, delta),
      });
      tx.create(collection("inventoryMovements").doc(id), {
        ...input,
        businessId,
        kind: "stocktake",
        quantity: delta,
        onHandDelta: delta,
        sku: variant.data()!.input.sku,
        variantName: variant.data()!.input.name,
        productTitle: product.data()!.input.title,
        locationName: site.input.name,
        otherLocationName: null,
        unitCostMinor: null,
        transferId: null,
        before,
        after,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id };
    },
  );
}

function policyProjection(doc: DocumentSnapshot): StockPolicyRecord {
  const data = doc.data()!;
  if (data.businessId !== businessId) fail("Invalid inventory ownership.", 503);
  const validated = stockPolicyInputSchema.parse({
    ...data.input,
    expectedRevision: data.revision,
  });
  const { expectedRevision, ...input } = validated;
  return {
    ...input,
    id: doc.id,
    revision: expectedRevision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
export async function saveStockPolicy(
  body: Record<string, unknown>,
  staff: Staff,
) {
  keys(body, ["input", "operationId"]);
  const input = parsed(stockPolicyInputSchema, body.input);
  return operate(
    "stock-policy",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("stockPolicies").doc(
        hash(input.variantId + ":" + input.locationId),
      );
      const counterRef = collection("inventoryState").doc("counts");
      const [previous, variant, location, counters] = await Promise.all([
        tx.get(ref),
        tx.get(collection("productVariants").doc(input.variantId)),
        tx.get(collection("stockLocations").doc(input.locationId)),
        tx.get(counterRef),
      ]);
      if (!variant.exists || !location.exists)
        fail("Choose an existing variant and location.", 404);
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists) fail("Product not found.", 404);
      if ((previous.data()?.revision ?? 0) !== input.expectedRevision)
        fail("This threshold changed. Refresh stock before editing it.");
      const policyCount = counters.data()?.policies ?? 0;
      if (!previous.exists && policyCount >= 1000)
        fail("This workspace has reached its limit of 1,000 stock thresholds.");
      if (
        input.enabled &&
        (variant.data()!.input.status !== "active" ||
          product.data()!.input.status !== "active" ||
          location.data()!.input.status !== "active" ||
          location.data()!.input.kind === "transit" ||
          variant.data()!.input.fulfillment !== "stocked")
      ) {
        fail(
          "Enable thresholds for active stocked variants at active studio, gallery, or event locations.",
        );
      }
      const { expectedRevision, ...settings } = input;
      tx.set(ref, {
        input: settings,
        businessId,
        revision: expectedRevision + 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      if (!previous.exists)
        tx.set(counterRef, { policies: policyCount + 1 }, { merge: true });
      tx.create(collection("inventoryAudit").doc(id), {
        kind: previous.exists ? "updated" : "created",
        resource: "stockPolicies",
        recordId: ref.id,
        actorId: staff.uid,
        createdAt: now,
        before: previous.data()?.input ?? null,
        after: settings,
      });
      return { id: ref.id };
    },
  );
}
export async function replenishmentQueue(): Promise<ReplenishmentQueue> {
  const [catalog, policies] = await Promise.all([
    inventoryCatalog(),
    collection("stockPolicies")
      .where("input.enabled", "==", true)
      .limit(1001)
      .get(),
  ]);
  if (policies.size > 1000)
    fail("Replenishment exceeds the supported view size.", 503);
  const candidates = policies.docs.map(policyProjection).flatMap((policy) => {
    const variant = catalog.variants.find(
      (record) => record.id === policy.variantId,
    );
    const product = catalog.products.find(
      (record) => record.id === variant?.productId,
    );
    const location = catalog.locations.find(
      (record) => record.id === policy.locationId,
    );
    return variant?.status === "active" &&
      variant.fulfillment === "stocked" &&
      product?.status === "active" &&
      location?.status === "active" &&
      location.kind !== "transit"
      ? [{ policy, variant, product, location }]
      : [];
  });
  const items: ReplenishmentQueue["items"] = [];
  // Bound each read request; no full scan of historical stock movements is needed.
  for (let offset = 0; offset < candidates.length; offset += 100) {
    const group = candidates.slice(offset, offset + 100);
    const snapshots = await adminServices().db.getAll(
      ...group.map(({ policy }) =>
        balanceRef(policy.variantId, policy.locationId),
      ),
    );
    group.forEach(({ policy, variant, product, location }, index) => {
      const need = replenishmentNeed(
        balance(snapshots[index], variant.id, location.id),
        policy,
      );
      if (need)
        items.push({
          ...need,
          variantId: variant.id,
          locationId: location.id,
          sku: variant.sku,
          variantName: variant.name,
          productTitle: product.title,
          locationName: location.name,
          minimum: policy.minimum,
          target: policy.target,
        });
    });
  }
  items.sort(
    (a, b) =>
      a.available - b.available ||
      a.sku.localeCompare(b.sku) ||
      a.locationName.localeCompare(b.locationName) ||
      a.locationId.localeCompare(b.locationId),
  );
  return {
    items,
    enabledPolicies: candidates.length,
    generatedAt: new Date().toISOString(),
  };
}
export async function dispatchStock(
  body: Record<string, unknown>,
  staff: Staff,
) {
  keys(body, ["input", "operationId"]);
  const input = parsed(dispatchInputSchema, body.input);
  return operate(
    "dispatch",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const vref = collection("productVariants").doc(input.variantId),
        fromRef = collection("stockLocations").doc(input.fromId),
        toRef = collection("stockLocations").doc(input.toId),
        stockRef = balanceRef(input.variantId, input.fromId);
      const [variant, from, to, stock] = await Promise.all([
        tx.get(vref),
        tx.get(fromRef),
        tx.get(toRef),
        tx.get(stockRef),
      ]);
      if (!variant.exists) fail("Variant not found.", 404);
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists) fail("Product not found.", 404);
      const source = requireLocation(from),
        destination = requireLocation(to),
        before = balance(stock, input.variantId, input.fromId);
      const after = transition(before, "adjust", -input.quantity);
      const open = variant.data()!.openTransferCount ?? 0;
      if (open >= 100)
        fail(
          "Complete existing transfers before dispatching more stock for this variant.",
        );
      const snapshot = {
        variantId: input.variantId,
        sku: variant.data()!.input.sku,
        variantName: variant.data()!.input.name,
        productTitle: product.data()!.input.title,
      };
      tx.set(stockRef, { ...after, businessId, updatedAt: now });
      tx.update(fromRef, {
        onHandUnits: total(source.onHandUnits ?? 0, -input.quantity),
        outgoingUnits: total(source.outgoingUnits ?? 0, input.quantity),
      });
      tx.update(toRef, {
        incomingUnits: total(destination.incomingUnits ?? 0, input.quantity),
      });
      tx.update(vref, { openTransferCount: open + 1 });
      tx.create(collection("stockTransfers").doc(id), {
        ...input,
        ...snapshot,
        businessId,
        fromName: source.input.name,
        toName: destination.input.name,
        received: 0,
        lost: 0,
        remaining: input.quantity,
        status: "in_transit",
        createdAt: now,
        createdBy: staff.uid,
      });
      tx.create(collection("inventoryMovements").doc(id), {
        ...snapshot,
        businessId,
        kind: "dispatch",
        quantity: input.quantity,
        onHandDelta: -input.quantity,
        locationId: input.fromId,
        locationName: source.input.name,
        otherLocationName: destination.input.name,
        reason: input.reason,
        reference: input.reference,
        unitCostMinor: null,
        transferId: id,
        before,
        after,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id };
    },
  );
}
export async function receiveTransfer(
  body: Record<string, unknown>,
  staff: Staff,
) {
  keys(body, ["input", "operationId"]);
  const input = parsed(transferReceiptSchema, body.input);
  return operate(
    "transfer-receipt",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const transferRef = collection("stockTransfers").doc(input.transferId),
        record = await tx.get(transferRef);
      if (!record.exists) fail("Transfer not found.", 404);
      const transfer = record.data()!;
      if (
        transfer.status !== "in_transit" ||
        input.quantity > transfer.remaining
      )
        fail("The quantity exceeds the units still in transit.");
      const fromRef = collection("stockLocations").doc(transfer.fromId),
        toRef = collection("stockLocations").doc(transfer.toId),
        vref = collection("productVariants").doc(transfer.variantId),
        stockRef = balanceRef(transfer.variantId, transfer.toId);
      const [from, to, variant, stock] = await Promise.all([
        tx.get(fromRef),
        tx.get(toRef),
        tx.get(vref),
        tx.get(stockRef),
      ]);
      const source = requireLocation(from),
        destination = requireLocation(to);
      if (!variant.exists) fail("Variant not found.", 404);
      const before = balance(stock, transfer.variantId, transfer.toId),
        after =
          input.kind !== "loss"
            ? transition(before, input.kind, input.quantity)
            : before;
      const remaining = transfer.remaining - input.quantity,
        received =
          transfer.received + (input.kind !== "loss" ? input.quantity : 0),
        lost = transfer.lost + (input.kind === "loss" ? input.quantity : 0);
      tx.update(transferRef, {
        remaining,
        received,
        lost,
        status:
          remaining > 0
            ? "in_transit"
            : lost > 0
              ? "closed_with_loss"
              : "received",
        updatedAt: now,
      });
      tx.update(fromRef, {
        outgoingUnits: total(source.outgoingUnits ?? 0, -input.quantity),
      });
      tx.update(toRef, {
        incomingUnits: total(destination.incomingUnits ?? 0, -input.quantity),
        onHandUnits: total(
          destination.onHandUnits ?? 0,
          after.onHand - before.onHand,
        ),
      });
      if (remaining === 0)
        tx.update(vref, {
          openTransferCount: total(variant.data()!.openTransferCount ?? 0, -1),
        });
      if (input.kind !== "loss")
        tx.set(stockRef, { ...after, businessId, updatedAt: now });
      tx.create(collection("inventoryMovements").doc(id), {
        businessId,
        variantId: transfer.variantId,
        sku: transfer.sku,
        variantName: transfer.variantName,
        productTitle: transfer.productTitle,
        kind:
          input.kind === "loss"
            ? "transfer_loss"
            : input.kind === "receive_quarantined"
              ? "transfer_quarantined"
              : "transfer_received",
        quantity: input.quantity,
        onHandDelta: after.onHand - before.onHand,
        locationId: transfer.toId,
        locationName: transfer.toName,
        otherLocationName: transfer.fromName,
        reason: input.reason,
        reference: transfer.reference,
        unitCostMinor: null,
        transferId: input.transferId,
        before: input.kind !== "loss" ? before : null,
        after: input.kind !== "loss" ? after : null,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id };
    },
  );
}
