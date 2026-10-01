import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { access, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
export async function shipmentCaseChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session }) {
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = value => createHash("sha256").update(value).digest("hex");
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (route, body, extra = {}) => request(`/api/store/${route}`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (response, status = 200) => { const r = await response; assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  const history = f => ok(request(`/api/store/shipment-cases?orderId=${f.id}`, { headers: { Cookie: ownerCookie } }));
  async function fixture(label, method = "standard", dispatch = true) {
    const id = hash("shipment-" + label).slice(0, 32), locationId = hash(label + "shipment-location"), token = hash(label + "shipment-token"), order = c("storeOrders").doc(id);
    const lines = [0, 1, 2].map(index => ({ variantId: hash(label + "shipment-variant-" + index), quantity: index === 0 ? 3 : index === 1 ? 2 : 1, sku: "SHIP-" + label + "-" + index,
      name: "Test print " + index, productTitle: "Shipment test artwork", fulfillment: index === 2 ? "made_to_order" : "stocked", allocations: index === 2 ? [] : [{ locationId, quantity: index === 0 ? 3 : 2 }], unitPriceMinor: 2500 }));
    await c("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: "Shipment test studio " + label, kind: "studio", status: "active", onlineEligible: true }, revision: 1, onHandUnits: 18 });
    const stocks = lines.slice(0, 2).map(line => c("stockBalances").doc(hash(line.variantId + ":" + locationId)));
    for (const [index, stock] of stocks.entries()) await stock.set({ businessId: "sadboi", variantId: lines[index].variantId, locationId, onHand: index === 0 ? 10 : 8, allocated: lines[index].quantity, reserved: 1, unavailable: 1, revision: 1 });
    const address = { line1: "100 Test Street", line2: "", city: "Chicago", region: "IL", postalCode: "60601", country: "US" };
    await order.set({ businessId: "sadboi", orderNumber: "SHIPMENT-" + label, status: "paid", totalMinor: 15000, allocationState: "held", lifecycleRevision: 0,
      managementTokenHash: hash(token), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lines,
      input: { customerName: "Shipment Test Buyer", customerEmail: "shipment@example.test", notes: "", fulfillmentMethod: method === "pickup" ? "pickup" : "shipping", ...(method === "pickup" ? {} : { shippingService: "standard", shippingAddress: address }), lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) } });
    let revision = 0;
    const fulfill = async status => { const result = await ok(post("fulfillment", { input: { orderId: id, recipientName: "Shipment Test Buyer", address1: address.line1, address2: "", city: address.city, region: "IL", postalCode: "60601", country: "US", method, trackingNumber: "ORIGINAL-" + label, status, notes: "Original staff-only note" }, expectedRevision: revision, operationId: randomUUID() }), 201); revision = result.revision; };
    if (dispatch) { await fulfill("packed"); await fulfill(method === "pickup" ? "delivered" : "shipped"); }
    return { id, order, token, locationId, lines, stocks, fulfill };
  }
  const body = (f, overrides = {}) => ({ orderId: f.id, operationId: randomUUID(), expectedRevision: 0, input: { kind: "damaged", status: "open", items: f.lines.map(line => ({ variantId: line.variantId, quantity: 1 })), carrier: "Test carrier", claimReference: "CASE-TEST", evidence: "Private photo reference test", note: "Customer reported a damaged package", resolution: null, refundId: null, returnId: null, ...overrides } });
  const save = value => post("shipment-cases", value);
  const update = async (f, changes) => { const h = await history(f); return { orderId: f.id, operationId: randomUUID(), expectedRevision: h.current.revision, input: { ...h.current.input, note: "Test investigation update", ...changes } }; };
  const prepare = async f => ({ action: "prepare", orderId: f.id, operationId: randomUUID(), expectedCaseRevision: (await history(f)).current.revision, items: (await history(f)).current.input.items.map(item => ({ ...item, locationId: f.lines.find(line => line.variantId === item.variantId).fulfillment === "stocked" ? f.locationId : null })), note: "Prepare test replacement" });
  const replacementUpdate = async (f, id, status, trackingNumber = "REPLACEMENT-TEST") => { const r = (await history(f)).replacements.find(row => row.id === id); return { action: "update", orderId: f.id, operationId: randomUUID(), replacementId: id, expectedRevision: r.revision, status, trackingNumber, note: "Test replacement status update" }; };
  const rp = input => post("replacements", input);
  const stockState = async f => Promise.all(f.stocks.map(async ref => (await ref.get()).data()));
  const f = await fixture("main"), initialStock = await stockState(f), accountant = await identity("shipment-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accountant));
  for (const [cookie, expected] of [["", 401], [legalCookie, 403], [accountingCookie, 200]]) assert.equal((await request(`/api/store/shipment-cases?orderId=${f.id}`, { headers: { Cookie: cookie } })).status, expected);
  const create = body(f);
  for (const route of ["shipment-cases", "replacements"]) {
    assert.equal((await post(route, create, { Cookie: accountingCookie + "; " + proof.cookie })).status, 403);
    assert.equal((await post(route, create, { "X-CSRF-Token": "wrong" })).status, 403);
    assert.equal((await post(route, create, { Origin: "https://attacker.example" })).status, 403);
  }
  assert.equal((await save({ ...create, extra: "injected" })).status, 400);
  assert.equal((await save(body(f, { items: [{ variantId: f.lines[0].variantId, quantity: 0.5 }] }))).status, 400);
  assert.equal((await save(body(f, { items: [{ variantId: hash("foreign"), quantity: 1 }] }))).status, 409);
  assert.equal((await save(body(f, { items: [{ variantId: f.lines[0].variantId, quantity: 4 }] }))).status, 409);
  const pickup = await fixture("pickup", "pickup"), unshipped = await fixture("unshipped", "standard", false);
  assert.equal((await save(body(pickup))).status, 409); assert.equal((await save(body(unshipped))).status, 409);
  check("shipment cases enforce staff roles, CSRF, strict inputs, dispatched quantities and shipping-only eligibility");

  const results = await Promise.all([save(create), save(create)]); for (const r of results) assert.equal(r.status, 201, await r.clone().text());
  assert.equal((await history(f)).history.length, 1); assert.deepEqual(await stockState(f), initialStock);
  assert.equal((await save({ ...create, input: { ...create.input, note: "changed request" } })).status, 409);
  assert.equal((await save({ ...create, operationId: randomUUID() })).status, 409);
  await ok(save(await update(f, { status: "investigating" })), 201);
  assert.equal((await ok(save(create), 201)).revision, 1);
  assert.equal((await f.order.get()).data().shipmentIssueStatus, "investigating");
  check("case retries recover once, stale edits fail and investigation history never changes money or stock");

  const foreignRefund = hash("foreign-refund"), localRefund = hash("case-refund");
  const refundData = { businessId: "sadboi", orderId: f.id, status: "pending", providerId: "re_shipment", amountMinor: 2500, reason: "Test case refund", createdAt: new Date().toISOString() };
  await c("storeOrderRefunds").doc(foreignRefund).set({ ...refundData, orderId: pickup.id, status: "succeeded" });
  await c("storeOrderRefunds").doc(localRefund).set(refundData);
  assert.equal((await save(await update(f, { status: "resolved", resolution: "refund", refundId: foreignRefund }))).status, 409);
  assert.equal((await save(await update(f, { status: "resolved", resolution: "refund", refundId: localRefund }))).status, 409);
  await c("storeOrderRefunds").doc(localRefund).update({ status: "succeeded" });
  assert.equal((await save(await update(f, { status: "resolved", resolution: "refund", refundId: localRefund }))).status, 409);
  await f.order.update({ refundState: { revision: 1, activeId: null, refundedMinor: 2500, pendingMinor: 0, checkedAt: new Date().toISOString(), refunds: [{ id: "re_shipment", status: "succeeded", amountMinor: 2500 }] } });
  const closed = await update(f, { status: "resolved", resolution: "refund", refundId: localRefund }); await ok(save(closed), 201);
  assert.equal((await save(await update(f, { note: "Cannot silently rewrite resolution" }))).status, 409);
  await ok(save(await update(f, { status: "investigating", resolution: null, refundId: null })), 201);
  assert.equal((await save(await update(f, { status: "resolved", resolution: "replacement" }))).status, 409);
  assert.deepEqual(await stockState(f), initialStock);
  check("refund resolutions require matching confirmed order refunds and resolved cases require an explicit audited reopen");

  const prepareBody = await prepare(f);
  const beforeShortage = await stockState(f);
  await f.stocks[1].update({ onHand: 2 });
  assert.equal((await rp(prepareBody)).status, 409);
  assert.deepEqual((await f.stocks[0].get()).data(), beforeShortage[0]);
  assert.equal((await history(f)).replacements.length, 0);
  await f.stocks[1].set(beforeShortage[1]);
  assert.equal((await rp({ ...prepareBody, items: prepareBody.items.slice(0, 1) })).status, 409);
  assert.equal((await rp({ ...prepareBody, items: prepareBody.items.map((item, i) => i === 2 ? { ...item, locationId: f.locationId } : item) })).status, 409);
  await f.order.update({ paymentReviewRequired: true }); assert.equal((await rp(prepareBody)).status, 409); await f.order.update({ paymentReviewRequired: false });
  const preparations = await Promise.all([rp(prepareBody), rp(prepareBody)]); for (const r of preparations) assert.equal(r.status, 201, await r.clone().text());
  let h = await history(f), replacement = h.replacements[0]; assert.equal(h.replacements.length, 1);
  let stock = await stockState(f); assert.equal(stock[0].onHand, 7); assert.equal(stock[0].allocated, 1); assert.equal(stock[1].allocated, 1);
  assert.equal((await c("stockLocations").doc(f.locationId).get()).data().onHandUnits, 13);
  assert.equal((await rp({ ...prepareBody, operationId: randomUUID() })).status, 409);
  assert.equal((await save(await update(f, { items: [{ variantId: f.lines[0].variantId, quantity: 2 }] }))).status, 409);
  assert.equal((await save(await update(f, { status: "resolved", resolution: "no_refund" }))).status, 409);
  check("replacement preparation atomically reserves all affected stock once, rejects shortages and locks case quantities");

  const cancel = await replacementUpdate(f, replacement.id, "cancelled", "");
  await c("orderReplacements").doc(replacement.id).update({ stockDisposition: "consumed" });
  assert.equal((await rp(cancel)).status, 409); assert.deepEqual(await stockState(f), stock);
  await c("orderReplacements").doc(replacement.id).update({ stockDisposition: "held" });
  const savedRefundState = (await f.order.get()).data().refundState;
  await f.order.update({ "refundState.pendingMinor": 100, "refundState.activeId": hash("pending-refund") });
  assert.equal((await rp(await replacementUpdate(f, replacement.id, "shipped"))).status, 409);
  await ok(rp(cancel), 201); await ok(rp(cancel), 201);
  await f.order.update({ refundState: savedRefundState });
  stock = await stockState(f); assert.equal(stock[0].onHand, 7); assert.equal(stock[0].allocated, 0); assert.equal(stock[1].allocated, 0);
  assert.equal((await ok(rp(prepareBody), 201)).id, replacement.id); assert.equal((await history(f)).replacements.length, 1);
  const reprepare = await prepare(f), prepared = await ok(rp(reprepare), 201);
  assert.notEqual(prepared.id, replacement.id);
  const noTracking = await replacementUpdate(f, prepared.id, "shipped", ""); assert.equal((await rp(noTracking)).status, 409);
  const ship = await replacementUpdate(f, prepared.id, "shipped");
  await c("stockLocations").doc(f.locationId).update({ onHandUnits: 0 }); assert.equal((await rp(ship)).status, 409);
  assert.equal((await f.stocks[0].get()).data().allocated, 1);
  await c("stockLocations").doc(f.locationId).update({ onHandUnits: 13, "input.status": "archived" });
  const ships = await Promise.all([rp(ship), rp(ship)]); for (const r of ships) assert.equal(r.status, 201, await r.clone().text());
  stock = await stockState(f); assert.equal(stock[0].onHand, 6); assert.equal(stock[1].onHand, 5); assert.equal(stock[0].allocated, 0); assert.equal(stock[0].reserved, 1); assert.equal(stock[0].unavailable, 1);
  assert.equal((await c("stockLocations").doc(f.locationId).get()).data().onHandUnits, 11);
  await ok(rp(await replacementUpdate(f, prepared.id, "shipped", "CORRECTED-TRACKING")), 201);
  assert.equal((await rp(await replacementUpdate(f, prepared.id, "cancelled"))).status, 409);
  await ok(rp(await replacementUpdate(f, prepared.id, "delivered", "CORRECTED-TRACKING")), 201);
  assert.deepEqual(await stockState(f), stock);
  assert.equal((await rp(await replacementUpdate(f, prepared.id, "shipped"))).status, 409);
  await ok(save(await update(f, { status: "resolved", resolution: "replacement" })), 201);
  assert.equal((await f.order.get()).data().totalMinor, 15000); assert.equal((await f.order.get()).data().refundState.refundedMinor, 2500);
  assert.equal((await c("fulfillments").doc(f.id).get()).data().input.trackingNumber, "ORIGINAL-main");
  assert.equal((await c("inventoryMovements").where("replacementId", "==", prepared.id).where("kind", "==", "replacement_consume").get()).size, 2);
  check("replacement cancellation releases only its allocation; dispatch consumes once and tracking/delivery preserve original totals and stock buckets");

  const customer = await ok(post(`order-access/${f.id}`, { action: "status", token: f.token }));
  assert.equal(customer.replacement.status, "delivered"); assert.equal(customer.replacement.trackingNumber, "CORRECTED-TRACKING");
  for (const hidden of ["Private photo reference test", "CASE-TEST", "Customer reported", "Prepare test replacement", f.locationId]) assert.ok(!JSON.stringify(customer).includes(hidden));
  assert.equal((await post(`order-access/${f.id}`, { action: "status", token: "0".repeat(64) })).status, 404);
  const orders = await ok(request("/api/store/orders", { headers: { Cookie: ownerCookie } })); assert.equal(orders.orders.find(order => order.id === f.id).shipmentIssueStatus, "resolved");
  const help = await request("/admin/how-to", { headers: { Cookie: accountingCookie } }); assert.match(await help.text(), /id="shipment-cases"/);
  check("customers see only safe replacement tracking, staff lists show case status and accounting can access instructions");

  const race = await fixture("race"); await ok(save(body(race, { kind: "lost" })), 201);
  const contenders = [await prepare(race), await prepare(race)]; assert.deepEqual((await Promise.all(contenders.map(rp))).map(r => r.status).sort(), [201, 409]);
  const racer = (await history(race)).replacements[0], beforeRace = await stockState(race);
  const commands = [await replacementUpdate(race, racer.id, "shipped"), await replacementUpdate(race, racer.id, "cancelled", "")];
  assert.deepEqual((await Promise.all(commands.map(rp))).map(r => r.status).sort(), [201, 409]);
  const winner = (await history(race)).replacements[0];
  const afterRace = await stockState(race); assert.equal(afterRace[0].allocated, 0); assert.equal(afterRace[0].onHand, beforeRace[0].onHand - (winner.status === "shipped" ? 1 : 0));
  assert.equal((await rp({ ...commands[0], orderId: f.id, operationId: randomUUID() })).status, 409);
  check("competing replacement preparations and ship/cancel commands commit one outcome; cross-order references fail");

  const receiptCase = await fixture("receipt"); await ok(save(body(receiptCase)), 201);
  const receive = await ok(post("after-sales", { action: "receive", orderId: receiptCase.id, operationId: randomUUID(), expectedRevision: 0, variantId: receiptCase.lines[0].variantId, quantity: 1, disposition: "quarantine", locationId: receiptCase.locationId, notes: "Shipment inspection private" }), 201);
  assert.equal((await save(await update(race, { returnId: receive.id }))).status, 409);
  await ok(save(await update(receiptCase, { returnId: receive.id, status: "investigating" })), 201);
  assert.equal((await receiptCase.stocks[0].get()).data().onHand, 8); assert.equal((await receiptCase.stocks[0].get()).data().unavailable, 2);
  const beforeReturnLink = await stockState(receiptCase); await ok(save(await update(receiptCase, { note: "Receipt link does not restock twice" })), 201); assert.deepEqual(await stockState(receiptCase), beforeReturnLink);
  check("case receipt links require same-order affected items and never repeat physical return stock effects");

  const preview = await fixture("browser");
  if (process.argv.includes("--shipment-preview")) {
    const marker = "web-app/.next-auth-test/shipment-preview.done"; try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/shipment-preview.ready", JSON.stringify({ orderId: preview.id, url: `${origin}/orders/${preview.id}#${preview.token}` }));
    console.log("Shipment browser preview ready at " + origin + "/admin/orders");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
