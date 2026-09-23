import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function productionChecks({ read, write, create, order, stock, collection, check, supplier, input, b, c, a, location, accountingCookie, legalCookie, secondCookie, request, ownerCookie, origin }) {
  const supplierId = await create("supplier", { ...supplier, name: "Production test supplier" });
  const orderInput = { ...input, supplierId, lines: [{ ...input.lines[0], variantId: b, quantity: 10 }, { ...input.lines[0], variantId: c, quantity: 10 }] };
  const orderId = await create("order", orderInput);
  const update = { orderId, variantId: b, expectedRevision: 1, stage: "in_production", expectedDate: "2026-10-08", note: "Printer confirmed production", reference: "CONF-PROD" };
  const history = async (id = orderId, cookie = ownerCookie, cursor = "") => {
    const response = await read("/api/purchasing?history=production&order=" + id + (cursor ? "&cursor=" + cursor : ""), cookie);
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /no-store/);
    return response.json();
  };
  assert.equal((await write("production", update)).status, 409);
  assert.equal((await write("production", { ...update, orderId: "f".repeat(64) })).status, 404);
  assert.equal((await write("production", update, { cookie: accountingCookie })).status, 403);
  assert.equal((await write("production", update, { cookie: legalCookie })).status, 403);
  assert.equal((await request("/api/purchasing?action=production", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie }, body: JSON.stringify({ input: update, operationId: randomUUID() }) })).status, 403);
  check("production updates require writable staff access, CSRF proof, and a placed order");

  await create("status", { orderId, expectedRevision: 1, action: "place", reason: "Supplier confirmed order" });
  // Simulate an existing order written before production fields were introduced.
  const ref = collection("purchaseOrders").doc(orderId), legacy = (await ref.get()).data();
  delete legacy.production; delete legacy.productionCount; await ref.set(legacy);
  assert.deepEqual((await order(orderId)).production, []);
  assert.deepEqual((await history()).updates, []);
  const beforeStock = await stock(b), op = randomUUID(), first = { ...update, expectedRevision: 2 };
  await create("production", first, { operationId: op });
  await create("production", first, { operationId: op });
  let current = await order(orderId);
  assert.equal(current.revision, 3); assert.equal(current.production.length, 1); assert.equal(current.production[0].stage, "in_production");
  assert.equal(current.expectedDate, input.expectedDate); assert.equal(current.subtotalMinor, 25000); assert.equal(current.status, "ordered");
  assert.deepEqual(current.lines.map(line => [line.quantity, line.accepted, line.quarantined, line.rejected]), [[10, 0, 0, 0], [10, 0, 0, 0]]);
  assert.deepEqual(await stock(b), beforeStock);
  assert.equal((await history()).updates.length, 1);
  check("legacy orders accept idempotent production updates without changing stock or agreed order details");

  assert.equal((await write("production", { ...first, stage: "on_hold" }, { operationId: op })).status, 409);
  assert.equal((await write("production", first)).status, 409);
  assert.equal((await write("production", { ...first, expectedRevision: 3, variantId: a })).status, 400);
  for (const patch of [{ stage: "approved" }, { actorId: "forged" }, { expectedDate: "2026-02-30" }, { note: "" }, { expectedRevision: 0 }]) {
    assert.equal((await write("production", { ...first, ...patch })).status, 400);
  }
  check("production rejects stale revisions, changed retries, unrelated SKUs, and forged or invalid fields");

  const racing = await Promise.all([
    write("production", { ...first, expectedRevision: 3, stage: "shipped" }),
    write("production", { ...first, expectedRevision: 3, stage: "on_hold" }, { cookie: secondCookie }),
  ]);
  assert.deepEqual(racing.map(response => response.status).sort(), [201, 409]);
  assert.equal((await order(orderId)).revision, 4);
  assert.equal((await history()).updates.length, 2);
  check("simultaneous production reports cannot overwrite each other silently");

  await create("production", { ...first, expectedRevision: 4, stage: "on_hold", expectedDate: "", note: "Corrected supplier report; delivery date unknown" });
  current = await order(orderId);
  assert.equal(current.production[0].stage, "on_hold"); assert.equal(current.production[0].expectedDate, "");
  assert.equal(current.expectedDate, input.expectedDate);
  const older = (await history()).updates.find(item => item.note === first.note);
  assert.equal(older.expectedDate, "2026-10-08");
  await create("production", { ...first, expectedRevision: 5, variantId: c, stage: "proofing" });
  current = await order(orderId); assert.equal(current.production.length, 2);
  assert.equal(current.production.find(item => item.variantId === b).stage, "on_hold");
  check("corrections preserve history, unknown dates, and independent progress for other SKUs");

  const receipt = { orderId, variantId: b, locationId: location, accepted: 4, quarantined: 1, rejected: 1, reason: "Inspected first production delivery", reference: "PROD-DEL-1" };
  const raceRevision = current.revision;
  const receiveRace = await Promise.all([
    write("receipt", receipt),
    write("production", { ...first, expectedRevision: raceRevision, stage: "ready" }),
  ]);
  assert.equal(receiveRace[0].status, 201); assert.ok([201, 409].includes(receiveRace[1].status));
  current = await order(orderId);
  assert.equal(current.status, "partially_received"); assert.equal(current.lines[0].accepted, 4); assert.equal(current.lines[0].quarantined, 1); assert.equal(current.lines[0].rejected, 1);
  assert.equal((await stock(b)).balances.find(item => item.locationId === location).onHand, 5);
  await create("production", { ...first, expectedRevision: current.revision, stage: "in_production", note: "Working on the remaining four units" });
  await create("receipt", { ...receipt, accepted: 4, quarantined: 0, rejected: 0 });
  current = await order(orderId);
  assert.equal((await write("production", { ...first, expectedRevision: current.revision })).status, 409);
  check("racing deliveries preserve quantities and completed SKU lines reject further production updates");

  assert.equal((await write("supplier", { ...supplier, status: "archived" }, { id: supplierId, revision: 1 })).status, 200);
  await create("production", { ...first, variantId: c, expectedRevision: current.revision, stage: "shipped" });
  current = await order(orderId);
  assert.equal(current.production.find(item => item.variantId === c).stage, "shipped");
  assert.equal(current.status, "partially_received");
  check("archived suppliers can finish existing commitments and shipped progress does not receive stock");

  const accountHistory = await history(orderId, accountingCookie);
  assert.ok(accountHistory.updates.length >= 6);
  assert.equal((await read("/api/purchasing?history=production&order=" + orderId, legalCookie)).status, 403);
  assert.equal((await request("/api/purchasing?history=production&order=" + orderId)).status, 401);
  assert.equal((await read("/api/purchasing?history=production")).status, 400);
  assert.equal((await read("/api/purchasing?history=unknown&order=" + orderId)).status, 400);
  assert.equal((await read("/api/purchasing?history=production&order=" + orderId + "&cursor=" + "f".repeat(64))).status, 400);
  assert.equal((await read("/api/purchasing?history=production&order=" + "f".repeat(64))).status, 404);
  check("production history enforces read scope, valid views, parent existence, and scoped cursors");

  await create("receipt", { ...receipt, variantId: c, accepted: 0, quarantined: 10, rejected: 0 });
  current = await order(orderId); assert.equal(current.status, "received");
  assert.equal((await write("production", { ...first, variantId: c, expectedRevision: current.revision })).status, 409);
  const countBeforeClose = (await history()).updates.length;
  await create("status", { orderId, expectedRevision: current.revision, action: "close", reason: "Order outcomes reconciled" });
  current = await order(orderId);
  assert.equal((await write("production", { ...first, expectedRevision: current.revision })).status, 409);
  assert.equal((await history()).updates.length, countBeforeClose);
  check("received and closed orders reject new progress while retaining its history");

  const activeSupplier = await create("supplier", supplier);
  const secondOrder = await create("order", { ...orderInput, supplierId: activeSupplier });
  await create("status", { orderId: secondOrder, expectedRevision: 1, action: "place", reason: "Second confirmed order" });
  await create("production", { ...first, orderId: secondOrder, expectedRevision: 2 });
  const otherCursor = (await history(secondOrder)).updates[0].id;
  assert.equal((await read("/api/purchasing?history=production&order=" + orderId + "&cursor=" + otherCursor)).status, 400);
  await collection("purchaseOrders").doc(secondOrder).update({ productionCount: 500 });
  assert.equal((await write("production", { ...first, orderId: secondOrder, expectedRevision: 3 })).status, 409);
  await create("status", { orderId: secondOrder, expectedRevision: 3, action: "close", reason: "Cancel remaining commitment" });
  assert.equal((await write("production", { ...first, orderId: secondOrder, expectedRevision: 4 })).status, 409);
  check("production histories cannot cross orders and update limits and cancellation are enforced");

  const actualUpdates = await ref.collection("productionUpdates").get();
  for (const doc of actualUpdates.docs) {
    assert.equal((await collection("inventoryOperations").doc(doc.id).get()).exists, true);
    const audit = (await collection("inventoryAudit").doc(doc.id).get()).data();
    assert.equal(audit.kind, "production"); assert.equal(audit.recordId, orderId); assert.equal(audit.after.actorId, doc.data().actorId);
    assert.equal((await collection("inventoryMovements").doc(doc.id).get()).exists, false);
  }
  check("production reports retain actor-linked audit and operations without inventory movements");

  // Exercise pagination with equal timestamps, including the document-ID tiebreaker.
  const seed = actualUpdates.docs[0].data();
  const batch = collection("purchaseOrders").firestore.batch();
  for (let i = 0; i < 55; i++) {
    const id = i.toString(16).padStart(64, "0");
    batch.set(ref.collection("productionUpdates").doc(id), { ...seed, id, createdAt: "2026-09-01T00:00:00.000Z" });
  }
  await batch.commit();
  const page1 = await history(), page2 = await history(orderId, accountingCookie, page1.nextCursor);
  assert.equal(page1.updates.length, 50); assert.equal(page2.nextCursor, null);
  assert.equal(new Set([...page1.updates, ...page2.updates].map(item => item.id)).size, countBeforeClose + 55);
  check("production history pagination retains every update without overlap at equal timestamps");

  const howto = await read("/admin/how-to"); assert.equal(howto.status, 200);
  const howtoHtml = await howto.text(); assert.match(howtoHtml, /id="production"/); assert.match(howtoHtml, /Save production update/); assert.match(howtoHtml, /Retry same entry/);
  assert.equal((await read("/admin/how-to", accountingCookie)).status, 200);
  assert.equal((await read("/admin/how-to", legalCookie)).status, 307);
  assert.equal((await request("/admin/how-to")).status, 307);
  const purchasingPage = await read("/admin/purchasing", accountingCookie);
  assert.match(await purchasingPage.text(), />Production</);
  check("production is discoverable and its how-to renders for authorized roles only");
}
