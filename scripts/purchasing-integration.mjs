import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function purchasingChecks({ request, csrf, ownerCookie, legalCookie, identity, signIn, session, db, check, origin }) {
  const collection = name => db.collection("businesses/sadboi/" + name);
  const read = (url, cookie = ownerCookie) => request(url, { headers: { Cookie: cookie } });
  async function mutate(url, body, { cookie = ownerCookie, method = "POST" } = {}) {
    const proof = await csrf();
    return request(url, { method, headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie + "; " + proof.cookie, "X-CSRF-Token": proof.token }, body: JSON.stringify(body) });
  }
  const write = (action, input, options = {}) => mutate("/api/purchasing?action=" + action,
    { input, operationId: options.operationId ?? randomUUID(), ...(options.id ? { id: options.id, revision: options.revision } : {}) }, { ...options, method: options.id ? "PATCH" : "POST" });
  async function create(action, input, options) {
    const response = await write(action, input, options);
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()).id;
  }
  async function inventory(action, input, options = {}) {
    const response = await mutate("/api/inventory?action=" + action, { input, operationId: randomUUID(), ...(options.id ? { id: options.id, revision: options.revision } : {}) }, { method: options.id ? "PATCH" : "POST" });
    assert.equal(response.status, options.id ? 200 : 201, await response.clone().text());
    return (await response.json()).id;
  }
  async function catalog(cookie) { const response = await read("/api/purchasing", cookie); assert.equal(response.status, 200, await response.clone().text()); assert.match(response.headers.get("cache-control"), /no-store/); return response.json(); }
  async function order(id) { return (await catalog()).orders.find(item => item.id === id); }
  async function stock(id) { const response = await read("/api/inventory/stock?variant=" + id); assert.equal(response.status, 200); return response.json(); }
  const accountant = await identity("purchasing-accounting@example.test", true, "accounting");
  const accountingCookie = session(await signIn(accountant));
  const secondOwner = await identity("purchasing-owner@example.test", true, "super_admin");
  const secondCookie = session(await signIn(secondOwner));
  assert.equal((await request("/api/purchasing")).status, 401);
  assert.equal((await read("/api/purchasing", legalCookie)).status, 403);
  assert.equal((await read("/admin/purchasing", legalCookie)).status, 307);
  for (const action of ["supplier", "order", "status", "receipt", "production"]) assert.equal((await write(action, {}, { cookie: accountingCookie })).status, 403);
  check("purchasing enforces staff read and mutation permissions");
  assert.equal((await request("/api/purchasing?action=supplier", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example", Cookie: ownerCookie }, body: "{}" })).status, 403);
  check("purchasing requires origin and CSRF proof");
  const supplier = { name: "Emulator Print Shop", contactName: "Printer", email: "printer@example.test", phone: "", address: "Test only", capabilities: "Archival printing", leadTimeDays: 10, notes: "Purchasing fixture", status: "active" };
  const supplierOp = randomUUID(), supplierId = await create("supplier", supplier, { operationId: supplierOp });
  assert.equal(await create("supplier", supplier, { operationId: supplierOp }), supplierId);
  assert.equal((await collection("suppliers").get()).size, 1);
  assert.equal((await write("supplier", { ...supplier, name: "Different" }, { operationId: supplierOp })).status, 409);
  assert.equal((await write("supplier", { ...supplier, businessId: "other" })).status, 400);
  check("supplier creation is idempotent and rejects ownership injection");
  const supplierEdits = await Promise.all([write("supplier", supplier, { id: supplierId, revision: 1 }), write("supplier", supplier, { id: supplierId, revision: 1, cookie: secondCookie })]);
  assert.deepEqual(supplierEdits.map(response => response.status).sort(), [200, 409]);
  check("supplier revisions protect simultaneous edits");
  const artResponse = await mutate("/api/artworks", { operationId: randomUUID(), input: { title: "Purchasing art", series: "Test", year: 2026, medium: "Digital", description: "Emulator only", status: "draft", rights: "owned", tags: [], pixelWidth: null, pixelHeight: null, colorProfile: "", internalNotes: "Private purchasing artwork notes" } });
  assert.equal(artResponse.status, 201);
  const artId = (await artResponse.json()).artwork.id;
  const productId = await inventory("products", { artworkId: artId, title: "Purchasing print", kind: "print", description: "", status: "active" });
  const variantInput = { productId, sku: "PO-A", name: "A3 print", size: "A3", color: "", material: "Paper", finish: "Matte", priceMinor: 4500, currency: "USD", weightGrams: 100, fulfillment: "stocked", status: "active" };
  const a = await inventory("variants", variantInput), b = await inventory("variants", { ...variantInput, sku: "PO-B" }), c = await inventory("variants", { ...variantInput, sku: "PO-C" });
  const locationInput = { name: "Purchasing studio", kind: "studio", onlineEligible: true, status: "active" };
  const location = await inventory("locations", locationInput);
  const input = { supplierId, reference: "QUOTE-01", expectedDate: "2026-10-01", notes: "Reviewed specification", currency: "USD",
    lines: [{ variantId: a, quantity: 10, unitCostMinor: 1250, specification: "A3 matte, approved file v1" }, { variantId: b, quantity: 5, unitCostMinor: 2000, specification: "A3 gloss, approved file v2" }] };
  const orderOp = randomUUID(), orderId = await create("order", input, { operationId: orderOp });
  assert.equal(await create("order", input, { operationId: orderOp }), orderId);
  let current = await order(orderId);
  assert.equal(current.number, "PO-000001"); assert.equal(current.subtotalMinor, 22500); assert.equal(current.status, "draft");
  assert.equal((await stock(a)).balances.length, 0);
  check("draft orders calculate server subtotals and retries do not duplicate commitments or stock");
  for (const patch of [{ lines: [] }, { lines: [input.lines[0], input.lines[0]] }, { currency: "OTHER" }, { businessId: "other" }, { expectedDate: "2026-02-30" }]) assert.equal((await write("order", { ...input, ...patch })).status, 400);
  assert.equal((await write("order", { ...input, supplierId: "f".repeat(64) })).status, 409);
  assert.equal((await write("order", { ...input, lines: [{ ...input.lines[0], variantId: "f".repeat(64) }] })).status, 409);
  check("orders validate suppliers, SKUs, quantities, dates, and ownership");
  const draftEdits = await Promise.all([write("order", input, { id: orderId, revision: 1 }), write("order", input, { id: orderId, revision: 1, cookie: secondCookie })]);
  assert.deepEqual(draftEdits.map(response => response.status).sort(), [200, 409]);
  check("concurrent draft edits cannot silently replace order lines");
  const receipt = { orderId, variantId: a, locationId: location, accepted: 4, quarantined: 2, rejected: 1, reason: "Inspected delivery", reference: "DEL-01" };
  assert.equal((await write("receipt", receipt)).status, 409);
  const place = { orderId, expectedRevision: 2, action: "place", reason: "Confirmed with supplier" }, placeOp = randomUUID();
  await create("status", place, { operationId: placeOp });
  await create("status", place, { operationId: placeOp });
  current = await order(orderId); assert.equal(current.revision, 3); assert.equal(current.status, "ordered");
  assert.equal((await write("order", input, { id: orderId, revision: 3 })).status, 409);
  check("drafts cannot receive deliveries and placed orders freeze their reviewed lines");
  assert.equal((await write("supplier", { ...supplier, name: "Renamed printer" }, { id: supplierId, revision: 2 })).status, 200);
  await inventory("variants", { ...variantInput, name: "Renamed A3", priceMinor: 9999 }, { id: a, revision: 1 });
  current = await order(orderId);
  assert.equal(current.supplier.name, supplier.name); assert.equal(current.lines[0].variantName, "A3 print"); assert.equal(current.lines[0].unitCostMinor, 1250);
  check("supplier and catalog edits preserve placed order snapshots and agreed costs");
  const receiptOp = randomUUID();
  await create("receipt", receipt, { operationId: receiptOp }); await create("receipt", receipt, { operationId: receiptOp });
  let aStock = await stock(a), balance = aStock.balances.find(item => item.locationId === location);
  assert.equal(balance.onHand, 6); assert.equal(balance.unavailable, 2); assert.equal(aStock.movements.length, 1);
  assert.equal(aStock.movements[0].purchaseDelivery.rejected, 1); assert.equal(aStock.movements[0].unitCostMinor, 1250);
  current = await order(orderId); assert.equal(current.status, "partially_received"); assert.equal(current.lines[0].accepted, 4);
  check("partial deliveries atomically add accepted and quarantined stock once while excluding rejected units");
  assert.equal((await write("receipt", { ...receipt, accepted: 5 }, { operationId: receiptOp })).status, 409);
  assert.equal((await write("receipt", { ...receipt, accepted: 4, quarantined: 0, rejected: 0 })).status, 409);
  assert.equal((await write("receipt", { ...receipt, variantId: c })).status, 400);
  assert.equal((await write("receipt", { ...receipt, accepted: 0, quarantined: 0, rejected: 0 })).status, 400);
  check("receipts reject overdelivery, changed retries, unordered SKUs, and empty outcomes");
  const finalA = { ...receipt, accepted: 3, quarantined: 0, rejected: 0 };
  const racingReceipts = await Promise.all([write("receipt", finalA), write("receipt", finalA, { cookie: secondCookie })]);
  assert.deepEqual(racingReceipts.map(response => response.status).sort(), [201, 409]);
  assert.equal((await stock(a)).balances[0].onHand, 9);
  check("competing deliveries cannot exceed the same outstanding order quantity");
  await create("receipt", { ...receipt, variantId: b, accepted: 0, quarantined: 0, rejected: 5 });
  assert.equal((await stock(b)).balances.length, 0);
  current = await order(orderId); assert.equal(current.status, "received");
  assert.equal((await write("receipt", finalA)).status, 409);
  assert.equal((await collection("stockLocations").doc(location).get()).data().onHandUnits, 9);
  check("fully rejected deliveries close their commitment without creating physical inventory");
  const historyResponse = await read("/api/purchasing?order=" + orderId, accountingCookie);
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json(); assert.equal(history.receipts.length, 3);
  assert.equal((await read("/api/purchasing?order=" + orderId, legalCookie)).status, 403);
  assert.equal((await read("/api/purchasing?order=" + orderId + "&cursor=" + "f".repeat(64))).status, 400);
  check("delivery history is scoped, paginated, and readable by accounting");
  await create("status", { orderId, expectedRevision: current.revision, action: "close", reason: "Supplier delivery reconciled" });
  assert.equal((await order(orderId)).status, "closed");
  const simultaneousOrders = await Promise.all([create("order", input), create("order", input, { cookie: secondCookie })]);
  const numbers = await Promise.all(simultaneousOrders.map(async id => (await order(id)).number));
  assert.equal(new Set(numbers).size, 2);
  check("simultaneously created orders receive unique sequential numbers");
  const cancelId = simultaneousOrders[0];
  await create("status", { orderId: cancelId, expectedRevision: 1, action: "close", reason: "Cancelled before confirmation" });
  const cancelled = await order(cancelId); assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.lines[0].cancelled, 10);
  assert.equal((await write("status", { orderId: cancelId, expectedRevision: 2, action: "place", reason: "Try reopening" })).status, 409);
  check("cancelled drafts retain lines and cannot be reopened or received");
  const pendingId = simultaneousOrders[1];
  await create("status", { orderId: pendingId, expectedRevision: 1, action: "place", reason: "Confirmed before archiving supplier" });
  assert.equal((await write("supplier", { ...supplier, status: "archived" }, { id: supplierId, revision: 3 })).status, 200);
  assert.equal((await write("order", input)).status, 409);
  await inventory("variants", { ...variantInput, status: "archived" }, { id: a, revision: 2 });
  await create("receipt", { ...receipt, orderId: pendingId, accepted: 1, quarantined: 0, rejected: 0 });
  assert.equal((await stock(a)).balances[0].onHand, 10);
  check("archiving prevents new orders but allows existing commitments to be received");
  const inactiveLocation = await inventory("locations", { ...locationInput, name: "Inactive receiving", status: "archived" });
  assert.equal((await write("receipt", { ...receipt, orderId: pendingId, locationId: inactiveLocation, accepted: 1, quarantined: 0, rejected: 0 })).status, 409);
  check("receiving requires an active location");
  current = await order(pendingId);
  await create("status", { orderId: pendingId, expectedRevision: current.revision, action: "close", reason: "Cancel remaining supplier commitment" });
  current = await order(pendingId); assert.equal(current.status, "closed"); assert.equal(current.lines[0].accepted, 1); assert.equal(current.lines[0].cancelled, 9); assert.equal(current.lines[1].cancelled, 5);
  assert.equal((await stock(a)).balances[0].onHand, 10);
  check("closing a partially received order cancels only outstanding quantities and preserves stock");
  const accountingCatalog = await catalog(accountingCookie);
  assert.equal(accountingCatalog.orders.length, 3); assert.equal(JSON.stringify(accountingCatalog).includes("Private purchasing artwork notes"), false);
  const ownerPage = await read("/admin/purchasing"); assert.equal(ownerPage.status, 200); assert.match(await ownerPage.text(), /From print shop to studio/);
  const accountingPage = await read("/admin/purchasing", accountingCookie); assert.equal(accountingPage.status, 200); const html = await accountingPage.text(); assert.match(html, /Accounting access/); assert.equal(html.includes(">Create purchase order<"), false);
  check("purchasing renders admin and accounting views without private artwork notes");
  const receipts = await collection("purchaseOrders").doc(orderId).collection("receipts").get();
  for (const receiptDoc of receipts.docs) {
    assert.equal((await collection("inventoryOperations").doc(receiptDoc.id).get()).exists, true);
    assert.equal((await collection("inventoryMovements").doc(receiptDoc.id).get()).data().purchaseOrderId, orderId);
  }
  const audit = await collection("inventoryAudit").where("recordId", "==", orderId).get(); assert.equal(audit.size, 4);
  check("receipts, inventory movements, operations, and order audit records remain linked without retry duplicates");
  const { productionChecks } = await import("./purchasing-production-integration.mjs");
  await productionChecks({ read, write, create, order, stock, collection, check, supplier, input, b, c, a, location, accountingCookie, legalCookie, secondCookie, request, ownerCookie, origin });
  await db.doc("businesses/sadboi/memberships/" + secondOwner.uid).update({ status: "revoked" });
  assert.equal((await read("/api/purchasing", secondCookie)).status, 401);
  assert.equal((await write("supplier", supplier, { cookie: secondCookie })).status, 401);
  assert.equal((await write("production", {}, { cookie: secondCookie })).status, 401);
  check("revoked staff lose purchasing read and write access");
}
