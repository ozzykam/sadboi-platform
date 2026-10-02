import "server-only";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import {
  supplierInputSchema,
  purchaseOrderInputSchema,
  purchaseActionSchema,
  purchaseReceiptSchema,
  purchaseProductionSchema,
  purchaseRemaining,
  receivePurchaseLine,
  assertStock,
  type SupplierRecord,
  type PurchaseOrderRecord,
  type PurchaseLine,
  type PurchasingCatalog,
  type PurchaseReceipt,
  type PurchaseProductionUpdate,
} from "@sadboi/core";
import {
  quoteInputSchema,
  quoteTotal,
  quoteEffectiveUnitCost,
  type QuoteCatalog,
  type QuoteRecord,
  proofInputSchema,
  type ProofCatalog,
  type ProofRecord,
  batchInputSchema,
  type BatchCatalog,
  type BatchRecord,
  reprintInputSchema,
  type ReprintCatalog,
  type ReprintRecord,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import {
  inventoryOperation,
  inventoryId,
  inventoryBalanceRef,
  readInventoryBalance,
  activeInventoryLocation,
  inventoryTotal,
} from "./inventory";

const collection = (name: string) =>
  adminServices().db.collection("businesses/" + businessId + "/" + name);
function fail(message: string, status = 409): never {
  throw new AccessError(status, "purchasing", message);
}
function validate<T>(
  schema: {
    safeParse(input: unknown): {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    fail(parsed.error!.issues.map((issue) => issue.message).join(" "), 400);
  return parsed.data!;
}
function bodyKeys(body: Record<string, unknown>, editing = false) {
  const allowed = editing
    ? ["input", "operationId", "id", "revision"]
    : ["input", "operationId"];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail("Unexpected request fields.", 400);
  if (
    editing &&
    (!Number.isSafeInteger(body.revision) || (body.revision as number) < 1)
  )
    fail("A current record revision is required.", 400);
}
function supplierProjection(doc: DocumentSnapshot): SupplierRecord {
  const data = doc.data()!;
  return {
    ...supplierInputSchema.parse(data.input),
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
function productionProjection(
  data: PurchaseProductionUpdate,
): PurchaseProductionUpdate {
  return {
    id: data.id,
    orderId: data.orderId,
    variantId: data.variantId,
    sku: data.sku,
    stage: data.stage,
    expectedDate: data.expectedDate,
    note: data.note,
    reference: data.reference,
    actorId: data.actorId,
    createdAt: data.createdAt,
  };
}
function quoteProjection(doc: DocumentSnapshot): QuoteRecord {
  const data = doc.data()!,
    input = quoteInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    supplierName: data.supplierName,
    sku: data.sku,
    variantName: data.variantName,
    productTitle: data.productTitle,
    totalMinor: quoteTotal(input),
    effectiveUnitCostMinor: quoteEffectiveUnitCost(input),
  };
}
function orderProjection(doc: DocumentSnapshot): PurchaseOrderRecord {
  const data = doc.data()!,
    input = purchaseOrderInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    number: data.number,
    revision: data.revision,
    supplier: supplierInputSchema.parse(data.supplier),
    lines: input.lines.map((line) => {
      const snapshot = (data.lines as PurchaseLine[]).find(
        (item) => item.variantId === line.variantId,
      )!;
      return {
        ...line,
        sku: snapshot.sku,
        variantName: snapshot.variantName,
        productTitle: snapshot.productTitle,
        accepted: snapshot.accepted,
        quarantined: snapshot.quarantined,
        rejected: snapshot.rejected,
        cancelled: snapshot.cancelled,
      };
    }),
    subtotalMinor: data.subtotalMinor,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    orderedAt: data.orderedAt,
    closedAt: data.closedAt,
    closeReason: data.closeReason,
    quoteSnapshot: data.quoteSnapshot ?? null,
    production: (data.production ?? []).map(productionProjection),
  };
}
export async function purchasingCatalog(): Promise<PurchasingCatalog> {
  const [suppliers, orders] = await Promise.all([
    collection("suppliers").limit(501).get(),
    collection("purchaseOrders").limit(501).get(),
  ]);
  if (suppliers.size > 500 || orders.size > 500)
    fail(
      "Purchasing needs pagination before this catalog can grow further.",
      503,
    );
  return {
    suppliers: suppliers.docs
      .map(supplierProjection)
      .sort((a, b) => a.name.localeCompare(b.name)),
    orders: orders.docs
      .map(orderProjection)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
  };
}
export async function quoteCatalog(): Promise<QuoteCatalog> {
  const result = await collection("quotes").limit(501).get();
  if (result.size > 500)
    fail("Purchasing needs pagination before more than 500 quotes.", 503);
  return {
    quotes: result.docs
      .map(quoteProjection)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      ),
  };
}
function proofProjection(doc: DocumentSnapshot): ProofRecord {
  const data = doc.data()!,
    input = proofInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    filename: data.filename,
    sku: data.sku,
    variantName: data.variantName,
    supplierName: data.supplierName,
    orderNumber: data.orderNumber,
    artworkId: data.artworkId,
  };
}
export async function proofCatalog(orderId: string): Promise<ProofCatalog> {
  const order = await collection("purchaseOrders")
    .doc(inventoryId(orderId))
    .get();
  if (!order.exists) fail("Purchase order not found.", 404);
  const result = await collection("proofs")
    .where("input.orderId", "==", order.id)
    .limit(501)
    .get();
  if (result.size > 500)
    fail(
      "This order needs pagination before more than 500 proof records.",
      503,
    );
  const variants = await Promise.all(
    (order.data()!.lines as Array<Record<string, unknown>>).map((line) =>
      collection("productVariants").doc(String(line.variantId)).get(),
    ),
  );
  const products = await Promise.all(
    variants
      .filter((doc) => doc.exists)
      .map((doc) =>
        collection("products").doc(doc.data()!.input.productId).get(),
      ),
  );
  const artworkIds = [
    ...new Set(
      products
        .filter((doc) => doc.exists)
        .map((doc) => doc.data()!.input.artworkId),
    ),
  ];
  const assetSets = await Promise.all(
    artworkIds.map((artworkId) =>
      collection("artworks")
        .doc(artworkId)
        .collection("assets")
        .where("status", "==", "ready")
        .limit(100)
        .get(),
    ),
  );
  return {
    proofs: result.docs
      .map(proofProjection)
      .sort(
        (a, b) =>
          b.version - a.version || b.createdAt.localeCompare(a.createdAt),
      ),
    assets: assetSets
      .flatMap((set, index) =>
        set.docs.map((doc) => ({
          id: doc.id,
          filename: doc.data().filename,
          createdAt: doc.data().createdAt,
          artworkId: artworkIds[index],
        })),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
function batchProjection(doc: DocumentSnapshot): BatchRecord {
  const data = doc.data()!,
    input = batchInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    sku: data.sku,
    variantName: data.variantName,
    supplierName: data.supplierName,
    orderNumber: data.orderNumber,
  };
}
export async function batchCatalog(orderId: string): Promise<BatchCatalog> {
  const safeOrder = inventoryId(orderId),
    result = await collection("productionBatches")
      .where("input.orderId", "==", safeOrder)
      .limit(501)
      .get();
  if (result.size > 500)
    fail(
      "This order needs pagination before more than 500 production batches.",
      503,
    );
  return {
    batches: result.docs
      .map(batchProjection)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
function reprintProjection(doc: DocumentSnapshot): ReprintRecord {
  const data = doc.data()!,
    input = reprintInputSchema.parse(data.input);
  return {
    ...input,
    id: doc.id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    sku: data.sku,
    batchNumber: data.batchNumber,
    supplierName: data.supplierName,
    orderNumber: data.orderNumber,
  };
}
export async function reprintCatalog(orderId: string): Promise<ReprintCatalog> {
  const result = await collection("reprints")
    .where("input.orderId", "==", inventoryId(orderId))
    .limit(501)
    .get();
  if (result.size > 500)
    fail("This order needs pagination before more than 500 reprints.", 503);
  return {
    reprints: result.docs
      .map(reprintProjection)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
export async function saveReprint(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(reprintInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "reprint:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("reprints").doc(target ?? id),
        previous = await tx.get(ref),
        order = await tx.get(collection("purchaseOrders").doc(input.orderId)),
        batch = await tx.get(
          collection("productionBatches").doc(input.batchId),
        );
      if (!order.exists) fail("Purchase order not found.", 404);
      if (
        !batch.exists ||
        batch.data()!.input.orderId !== input.orderId ||
        batch.data()!.input.variantId !== input.variantId
      )
        fail("Choose a batch from this order and SKU.", 400);
      if (editing && !previous.exists) fail("Reprint request not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This reprint changed. Refresh before editing it.");
      const line = (order.data()!.lines as Array<Record<string, unknown>>).find(
        (item) => item.variantId === input.variantId,
      );
      if (!line) fail("Choose a SKU from this purchase order.", 400);
      const count =
        (await tx.get(collection("inventoryState").doc("purchasing"))).data()
          ?.reprints ?? 0;
      if (!editing && count >= 1000)
        fail("This workspace supports up to 1,000 reprint requests.");
      tx.set(ref, {
        input,
        businessId,
        sku: line.sku,
        batchNumber: batch.data()!.input.batchNumber,
        supplierName: order.data()!.supplier.name,
        orderNumber: order.data()!.number,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      if (!editing)
        tx.set(
          collection("inventoryState").doc("purchasing"),
          { reprints: count + 1 },
          { merge: true },
        );
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "reprints",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function saveBatch(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(batchInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "batch:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("productionBatches").doc(target ?? id),
        previous = await tx.get(ref),
        order = await tx.get(collection("purchaseOrders").doc(input.orderId));
      if (!order.exists) fail("Purchase order not found.", 404);
      if (editing && !previous.exists) fail("Production batch not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This batch changed. Refresh before editing it.");
      if (!["ordered", "partially_received"].includes(order.data()!.status))
        fail("Batches require a placed order with outstanding work.");
      const line = (order.data()!.lines as Array<Record<string, unknown>>).find(
        (item) => item.variantId === input.variantId,
      );
      if (!line) fail("Choose a SKU from this purchase order.", 400);
      const existing = await tx.get(
        collection("productionBatches")
          .where("input.orderId", "==", input.orderId)
          .where("input.variantId", "==", input.variantId),
      );
      const committed = existing.docs
        .filter(
          (doc) => doc.id !== ref.id && doc.data().input.status !== "cancelled",
        )
        .reduce((sum, doc) => sum + doc.data().input.quantity, 0);
      if (
        committed + (input.status === "cancelled" ? 0 : input.quantity) >
        Number(line.quantity)
      )
        fail("Batch quantities exceed the units ordered for this SKU.");
      const count =
        (await tx.get(collection("inventoryState").doc("purchasing"))).data()
          ?.batches ?? 0;
      if (!editing && count >= 1000)
        fail("This workspace supports up to 1,000 production batches.");
      tx.set(ref, {
        input,
        businessId,
        sku: line.sku,
        variantName: line.variantName,
        supplierName: order.data()!.supplier.name,
        orderNumber: order.data()!.number,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      if (!editing)
        tx.set(
          collection("inventoryState").doc("purchasing"),
          { batches: count + 1 },
          { merge: true },
        );
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "productionBatches",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function saveProof(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(proofInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "proof:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("proofs").doc(target ?? id),
        previous = await tx.get(ref),
        order = await tx.get(collection("purchaseOrders").doc(input.orderId));
      if (!order.exists) fail("Purchase order not found.", 404);
      if (editing && !previous.exists) fail("Proof record not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This proof changed. Refresh before editing it.");
      const line = (order.data()!.lines as Array<Record<string, unknown>>).find(
        (item) => item.variantId === input.variantId,
      );
      if (!line) fail("Choose a SKU from this purchase order.", 400);
      const variant = await tx.get(
        collection("productVariants").doc(input.variantId),
      );
      if (!variant.exists) fail("The proof SKU no longer exists.", 404);
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists) fail("The proof product no longer exists.", 404);
      const artworkId = product.data()!.input.artworkId;
      const asset = await tx.get(
        collection("artworks")
          .doc(artworkId)
          .collection("assets")
          .doc(input.assetId),
      );
      if (!asset.exists || asset.data()!.status !== "ready")
        fail("Choose a ready private artwork asset.", 400);
      const existing = await tx.get(
        collection("proofs")
          .where("input.orderId", "==", input.orderId)
          .where("input.variantId", "==", input.variantId)
          .where("input.version", "==", input.version),
      );
      if (existing.docs.some((doc) => doc.id !== ref.id))
        fail("That proof version already exists for this SKU.", 409);
      const count =
        (await tx.get(collection("inventoryState").doc("purchasing"))).data()
          ?.proofs ?? 0;
      if (!editing && count >= 1000)
        fail("This workspace supports up to 1,000 proof records.");
      const approved =
        input.status === "approved"
          ? await tx.get(
              collection("proofs")
                .where("input.orderId", "==", input.orderId)
                .where("input.variantId", "==", input.variantId)
                .where("input.status", "==", "approved"),
            )
          : null;
      const proofData = {
        input,
        businessId,
        filename: asset.data()!.filename,
        sku: line.sku,
        variantName: line.variantName,
        supplierName: order.data()!.supplier.name,
        orderNumber: order.data()!.number,
        artworkId,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      };
      tx.set(ref, proofData);
      if (!editing)
        tx.set(
          collection("inventoryState").doc("purchasing"),
          { proofs: count + 1 },
          { merge: true },
        );
      approved?.docs
        .filter((doc) => doc.id !== ref.id)
        .forEach((doc) =>
          tx.update(doc.ref, {
            "input.status": "superseded",
            updatedAt: now,
            updatedBy: staff.uid,
            revision: (doc.data().revision ?? 1) + 1,
          }),
        );
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "proofs",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function saveQuote(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(quoteInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "quote:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("quotes").doc(target ?? id),
        previous = await tx.get(ref),
        supplier = await tx.get(collection("suppliers").doc(input.supplierId)),
        variant = await tx.get(
          collection("productVariants").doc(input.variantId),
        );
      if (editing && !previous.exists) fail("Quote not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This quote changed. Refresh before editing it.");
      if (!supplier.exists || supplier.data()!.input.status !== "active")
        fail("Choose an active supplier.");
      if (!variant.exists || variant.data()!.input.status !== "active")
        fail("Choose an active variant.");
      const product = await tx.get(
        collection("products").doc(variant.data()!.input.productId),
      );
      if (!product.exists || product.data()!.input.status !== "active")
        fail("Restore the product before quoting it.");
      const count =
        (await tx.get(collection("inventoryState").doc("purchasing"))).data()
          ?.quotes ?? 0;
      if (!editing && count >= 500)
        fail("This workspace supports up to 500 quotes.");
      tx.set(ref, {
        input,
        businessId,
        supplierName: supplier.data()!.input.name,
        sku: variant.data()!.input.sku,
        variantName: variant.data()!.input.name,
        productTitle: product.data()!.input.title,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      if (!editing)
        tx.set(
          collection("inventoryState").doc("purchasing"),
          { quotes: count + 1 },
          { merge: true },
        );
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "quotes",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function saveSupplier(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(supplierInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "supplier:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("suppliers").doc(target ?? id),
        counter = collection("inventoryState").doc("purchasing");
      const [previous, counts] = await Promise.all([
        tx.get(ref),
        tx.get(counter),
      ]);
      if (editing && !previous.exists) fail("Supplier not found.", 404);
      if (editing && previous.data()!.revision !== body.revision)
        fail("This supplier changed. Refresh before editing it.");
      const count = counts.data()?.suppliers ?? 0;
      if (!editing && count >= 500)
        fail(
          "This workspace supports up to 500 suppliers, including archived records.",
        );
      tx.set(ref, {
        input,
        businessId,
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      if (!editing) tx.set(counter, { suppliers: count + 1 }, { merge: true });
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "suppliers",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function savePurchaseOrder(
  body: Record<string, unknown>,
  staff: Staff,
  editing: boolean,
) {
  bodyKeys(body, editing);
  const input = validate(purchaseOrderInputSchema, body.input),
    target = editing ? inventoryId(body.id) : null;
  return inventoryOperation(
    "purchase-order:" + (editing ? "update" : "create"),
    { input, target, revision: body.revision ?? null },
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("purchaseOrders").doc(target ?? id),
        counter = collection("inventoryState").doc("purchasing");
      const [previous, counts, supplier, quote] = await Promise.all([
        tx.get(ref),
        tx.get(counter),
        tx.get(collection("suppliers").doc(input.supplierId)),
        input.quoteId
          ? tx.get(collection("quotes").doc(input.quoteId))
          : Promise.resolve(null),
      ]);
      if (editing && !previous.exists) fail("Purchase order not found.", 404);
      if (
        editing &&
        (previous.data()!.revision !== body.revision ||
          previous.data()!.status !== "draft")
      )
        fail("Only the current draft can be edited. Refresh this order.");
      if (!supplier.exists || supplier.data()!.input.status !== "active")
        fail("Choose an active supplier.");
      if (
        input.quoteId &&
        (!quote?.exists ||
          quote.data()!.input.supplierId !== input.supplierId ||
          quote.data()!.input.status !== "accepted" ||
          !input.lines.some(
            (line) => line.variantId === quote.data()!.input.variantId,
          ))
      )
        fail(
          "Choose an accepted quote from this supplier and include its SKU on the draft.",
        );
      const count = counts.data()?.orders ?? 0;
      if (!editing && count >= 500)
        fail("This workspace supports up to 500 purchase orders.");
      const variants = await Promise.all(
        input.lines.map((line) =>
          tx.get(collection("productVariants").doc(line.variantId)),
        ),
      );
      if (
        variants.some(
          (doc) => !doc.exists || doc.data()!.input.status !== "active",
        )
      )
        fail("Choose active variants for every order line.");
      const products = await Promise.all(
        variants.map((doc) =>
          tx.get(collection("products").doc(doc.data()!.input.productId)),
        ),
      );
      if (
        products.some(
          (doc) => !doc.exists || doc.data()!.input.status !== "active",
        )
      )
        fail("Restore the products before ordering more units.");
      const lines: PurchaseLine[] = input.lines.map((line, index) => ({
        ...line,
        sku: variants[index].data()!.input.sku,
        variantName: variants[index].data()!.input.name,
        productTitle: products[index].data()!.input.title,
        accepted: 0,
        quarantined: 0,
        rejected: 0,
        cancelled: 0,
      }));
      const number =
        previous.data()?.number ?? "PO-" + String(count + 1).padStart(6, "0");
      tx.set(ref, {
        input,
        lines,
        supplier: supplierInputSchema.parse(supplier.data()!.input),
        businessId,
        number,
        subtotalMinor: lines.reduce(
          (sum, line) => sum + line.quantity * line.unitCostMinor,
          0,
        ),
        status: "draft",
        revision: editing ? previous.data()!.revision + 1 : 1,
        createdAt: previous.data()?.createdAt ?? now,
        updatedAt: now,
        updatedBy: staff.uid,
        orderedAt: null,
        closedAt: null,
        closeReason: "",
        receiptCount: 0,
        production: [],
        productionCount: 0,
        quoteSnapshot: quote?.exists
          ? {
              id: quote.id,
              reference: quote.data()!.input.reference,
              totalMinor: quoteTotal(quote.data()!.input),
              effectiveUnitCostMinor: quoteEffectiveUnitCost(
                quote.data()!.input,
              ),
              specification: quote.data()!.input.specification,
            }
          : null,
      });
      if (!editing) tx.set(counter, { orders: count + 1 }, { merge: true });
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "purchaseOrders",
        recordId: ref.id,
        kind: editing ? "updated" : "created",
        before: previous.data()?.input ?? null,
        after: input,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function actOnPurchaseOrder(
  body: Record<string, unknown>,
  staff: Staff,
) {
  bodyKeys(body);
  const input = validate(purchaseActionSchema, body.input);
  return inventoryOperation(
    "purchase-order:" + input.action,
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("purchaseOrders").doc(input.orderId),
        previous = await tx.get(ref);
      if (!previous.exists) fail("Purchase order not found.", 404);
      const order = orderProjection(previous);
      if (order.revision !== input.expectedRevision)
        fail("This order changed. Refresh before recording this action.");
      if (["closed", "cancelled"].includes(order.status))
        fail("This order is already closed.");
      let status: PurchaseOrderRecord["status"],
        lines = order.lines;
      if (input.action === "place") {
        if (order.status !== "draft")
          fail("Only a draft can be marked ordered.");
        const [supplier, ...variants] = await Promise.all([
          tx.get(collection("suppliers").doc(order.supplierId)),
          ...lines.map((line) =>
            tx.get(collection("productVariants").doc(line.variantId)),
          ),
        ]);
        if (
          !supplier.exists ||
          supplier.data()!.input.status !== "active" ||
          variants.some(
            (doc) => !doc.exists || doc.data()!.input.status !== "active",
          )
        )
          fail("Restore the supplier and variants before placing this order.");
        const products = await Promise.all(
          variants.map((doc) =>
            tx.get(collection("products").doc(doc.data()!.input.productId)),
          ),
        );
        if (
          products.some(
            (doc) => !doc.exists || doc.data()!.input.status !== "active",
          )
        )
          fail("Restore the products before placing this order.");
        status = "ordered";
      } else {
        status = lines.some(
          (line) => line.accepted + line.quarantined + line.rejected > 0,
        )
          ? "closed"
          : "cancelled";
        lines = lines.map((line) => ({
          ...line,
          cancelled: line.cancelled + purchaseRemaining(line),
        }));
      }
      tx.update(ref, {
        status,
        lines,
        revision: order.revision + 1,
        updatedAt: now,
        updatedBy: staff.uid,
        ...(input.action === "place"
          ? { orderedAt: now }
          : { closedAt: now, closeReason: input.reason }),
      });
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "purchaseOrders",
        recordId: ref.id,
        kind: input.action,
        reason: input.reason,
        before: { status: order.status, lines: order.lines },
        after: { status, lines },
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: ref.id };
    },
  );
}
export async function recordPurchaseProduction(
  body: Record<string, unknown>,
  staff: Staff,
) {
  bodyKeys(body);
  const input = validate(purchaseProductionSchema, body.input);
  return inventoryOperation(
    "purchase-production",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const ref = collection("purchaseOrders").doc(input.orderId),
        previous = await tx.get(ref);
      if (!previous.exists) fail("Purchase order not found.", 404);
      const order = orderProjection(previous);
      if (order.revision !== input.expectedRevision)
        fail(
          "This order changed. Refresh purchasing and review the latest progress before saving.",
        );
      if (!["ordered", "partially_received"].includes(order.status))
        fail("Production updates require an outstanding placed order.");
      const line = order.lines.find(
        (item) => item.variantId === input.variantId,
      );
      if (!line) fail("This SKU is not on the purchase order.", 400);
      if (purchaseRemaining(line) === 0)
        fail("This SKU has no units outstanding.");
      const count = previous.data()!.productionCount ?? 0;
      if (count >= 500)
        fail("This order has reached its limit of 500 production updates.");
      const update: PurchaseProductionUpdate = {
        id,
        orderId: order.id,
        variantId: line.variantId,
        sku: line.sku,
        stage: input.stage,
        expectedDate: input.expectedDate,
        note: input.note,
        reference: input.reference,
        actorId: staff.uid,
        createdAt: now,
      };
      const before =
        order.production.find((item) => item.variantId === line.variantId) ??
        null;
      tx.update(ref, {
        production: [
          ...order.production.filter(
            (item) => item.variantId !== line.variantId,
          ),
          update,
        ],
        productionCount: count + 1,
        revision: order.revision + 1,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      tx.create(ref.collection("productionUpdates").doc(id), {
        ...update,
        businessId,
      });
      tx.create(collection("inventoryAudit").doc(id), {
        resource: "purchaseOrders",
        recordId: order.id,
        kind: "production",
        before,
        after: update,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: order.id };
    },
  );
}
export async function purchaseProductionHistory(
  orderId: string,
  cursor: string | null,
) {
  const ref = collection("purchaseOrders").doc(inventoryId(orderId));
  if (!(await ref.get()).exists) fail("Purchase order not found.", 404);
  let query = ref
    .collection("productionUpdates")
    .orderBy("createdAt", "desc")
    .limit(51);
  if (cursor) {
    const previous = await ref
      .collection("productionUpdates")
      .doc(inventoryId(cursor))
      .get();
    if (!previous.exists) fail("Invalid production history cursor.", 400);
    query = query.startAfter(previous);
  }
  const results = await query.get(),
    page = results.docs.slice(0, 50);
  const updates = page.map((doc) =>
    productionProjection({
      ...doc.data(),
      id: doc.id,
    } as PurchaseProductionUpdate),
  );
  return { updates, nextCursor: results.size > 50 ? page.at(-1)!.id : null };
}
export async function receivePurchaseOrder(
  body: Record<string, unknown>,
  staff: Staff,
) {
  bodyKeys(body);
  const input = validate(purchaseReceiptSchema, body.input);
  return inventoryOperation(
    "purchase-receipt",
    input,
    body.operationId,
    staff,
    async (tx, id, now) => {
      const orderRef = collection("purchaseOrders").doc(input.orderId),
        locationRef = collection("stockLocations").doc(input.locationId);
      const stockRef = inventoryBalanceRef(input.variantId, input.locationId);
      const [previous, location, stock, variant] = await Promise.all([
        tx.get(orderRef),
        tx.get(locationRef),
        tx.get(stockRef),
        tx.get(collection("productVariants").doc(input.variantId)),
      ]);
      if (!previous.exists || !variant.exists)
        fail("Order or variant not found.", 404);
      const order = orderProjection(previous),
        site = activeInventoryLocation(location);
      if (!["ordered", "partially_received"].includes(order.status))
        fail("Only outstanding placed orders can receive deliveries.");
      const line = order.lines.find(
        (item) => item.variantId === input.variantId,
      );
      if (!line) fail("This SKU is not on the purchase order.", 400);
      if (previous.data()!.receiptCount >= 500)
        fail("This order has reached its limit of 500 delivery records.");
      let updated: PurchaseLine;
      try {
        updated = receivePurchaseLine(line, input);
      } catch (error) {
        fail(
          error instanceof Error
            ? error.message
            : "Invalid delivery quantities.",
        );
      }
      const before = readInventoryBalance(
          stock,
          input.variantId,
          input.locationId,
        ),
        physical = input.accepted + input.quarantined;
      let after;
      try {
        after = assertStock({
          ...before,
          onHand: before.onHand + physical,
          unavailable: before.unavailable + input.quarantined,
          revision: before.revision + (physical > 0 ? 1 : 0),
        });
      } catch {
        fail("This receipt would exceed the supported stock balance.");
      }
      const lines = order.lines.map((item) =>
        item.variantId === input.variantId ? updated : item,
      );
      tx.update(orderRef, {
        lines,
        status: lines.every((item) => purchaseRemaining(item) === 0)
          ? "received"
          : "partially_received",
        revision: order.revision + 1,
        updatedAt: now,
        updatedBy: staff.uid,
        receiptCount: previous.data()!.receiptCount + 1,
      });
      if (physical > 0) {
        tx.set(stockRef, { ...after, businessId, updatedAt: now });
        tx.update(locationRef, {
          onHandUnits: inventoryTotal(site.onHandUnits ?? 0, physical),
        });
      }
      tx.create(orderRef.collection("receipts").doc(id), {
        ...input,
        businessId,
        orderNumber: order.number,
        sku: line.sku,
        locationName: site.input.name,
        unitCostMinor: line.unitCostMinor,
        actorId: staff.uid,
        createdAt: now,
      });
      tx.create(collection("inventoryMovements").doc(id), {
        businessId,
        variantId: input.variantId,
        locationId: input.locationId,
        kind: "purchase_received",
        sku: line.sku,
        variantName: line.variantName,
        productTitle: line.productTitle,
        locationName: site.input.name,
        otherLocationName: null,
        quantity: physical,
        onHandDelta: physical,
        reason: input.reason,
        reference:
          order.number + (input.reference ? " / " + input.reference : ""),
        unitCostMinor: line.unitCostMinor,
        transferId: null,
        purchaseOrderId: order.id,
        accepted: input.accepted,
        quarantined: input.quarantined,
        rejected: input.rejected,
        before,
        after,
        actorId: staff.uid,
        createdAt: now,
      });
      return { id: order.id };
    },
  );
}
export async function purchaseReceipts(orderId: string, cursor: string | null) {
  const ref = collection("purchaseOrders").doc(inventoryId(orderId));
  if (!(await ref.get()).exists) fail("Purchase order not found.", 404);
  let query = ref.collection("receipts").orderBy("createdAt", "desc").limit(51);
  if (cursor) {
    const previous = await ref
      .collection("receipts")
      .doc(inventoryId(cursor))
      .get();
    if (!previous.exists) fail("Invalid receipt cursor.", 400);
    query = query.startAfter(previous);
  }
  const results = await query.get(),
    page = results.docs.slice(0, 50);
  const receipts: PurchaseReceipt[] = page.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      orderId,
      variantId: d.variantId,
      locationId: d.locationId,
      accepted: d.accepted,
      quarantined: d.quarantined,
      rejected: d.rejected,
      reason: d.reason,
      reference: d.reference,
      orderNumber: d.orderNumber,
      sku: d.sku,
      locationName: d.locationName,
      unitCostMinor: d.unitCostMinor,
      actorId: d.actorId,
      createdAt: d.createdAt,
    };
  });
  return { receipts, nextCursor: results.size > 50 ? page.at(-1)!.id : null };
}
