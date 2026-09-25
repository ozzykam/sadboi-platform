import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile, access, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function fulfillmentChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session }) {
  const collection = name => db.collection(`businesses/sadboi/${name}`);
  const hash = value => createHash("sha256").update(value).digest("hex");
  const proof = await csrf();
  const headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (body, overrides = {}) => request("/api/store/fulfillment", { method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body) });
  const balance = (variant, location) => collection("stockBalances").doc(hash(variant + ":" + location));
  const accountant = await identity("fulfillment-accounting@example.test", true, "accounting");
  const accountingCookie = session(await signIn(accountant));
  async function fixture(label, madeOnly = false) {
    const orderId = hash("fulfillment-order-" + label).slice(0, 32);
    const [a, b, other] = ["a", "b", "other"].map(name => hash(label + "-location-" + name));
    const [one, two, made] = ["one", "two", "made"].map(name => hash(label + "-variant-" + name));
    const line = (variantId, quantity, allocations, fulfillment = "stocked") => ({ variantId, quantity, allocations, fulfillment, sku: label + "-" + variantId.slice(0, 4), name: "Test print", productTitle: "Emulator art", unitCostMinor: 2500 });
    const lines = madeOnly ? [line(made, 1, [], "made_to_order")] : [line(one, 2, [{ locationId: a, quantity: 2 }]), line(two, 3, [{ locationId: a, quantity: 1 }, { locationId: b, quantity: 2 }]), line(made, 1, [], "made_to_order")];
    if (!madeOnly) {
      for (const locationId of [a, b, other]) {
        await collection("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: label + " " + locationId.slice(0, 4), status: "archived", onlineEligible: false }, revision: 1, onHandUnits: 40, incomingUnits: 0, outgoingUnits: 0 });
        for (const variantId of [one, two]) await balance(variantId, locationId).set({ businessId: "sadboi", variantId, locationId, onHand: 20, allocated: 6, reserved: 2, unavailable: 1, revision: 1 });
      }
    }
    const input = { customerName: "Fulfillment Buyer", customerEmail: "buyer@example.test", notes: "Disposable emulator order", fulfillmentMethod: "shipping", shippingAddress: { line1: "1 Main", line2: "Unit 2", city: "Chicago", region: "IL", postalCode: "60601", country: "US" }, lines: lines.map(({ variantId, quantity }) => ({ variantId, quantity })) };
    await collection("storeOrders").doc(orderId).set({ businessId: "sadboi", input, lines, status: "paid", paymentId: "emulator-payment", orderNumber: "TEST-" + label, totalMinor: 15000, createdAt: "2026-09-25T10:00:00.000Z", updatedAt: "2026-09-25T10:00:00.000Z" });
    const details = { orderId, recipientName: input.customerName, address1: "1 Main", address2: "Unit 2", city: "Chicago", region: "IL", postalCode: "60601", country: "US", method: "standard", trackingNumber: "", status: "packed", notes: "Emulator only" };
    const body = (status, expectedRevision, changes = {}) => ({ operationId: randomUUID(), expectedRevision, input: { ...details, status, ...changes } });
    return { orderId, a, b, other, one, two, made, body };
  }
  async function snapshot(f) {
    return { order: (await collection("storeOrders").doc(f.orderId).get()).data(), fulfillment: (await collection("fulfillments").doc(f.orderId).get()).data(),
      balances: await Promise.all([f.a, f.b, f.other].flatMap(location => [f.one, f.two].map(async variant => (await balance(variant, location).get()).data()))),
      locations: await Promise.all([f.a, f.b, f.other].map(async location => (await collection("stockLocations").doc(location).get()).data())),
      movements: (await collection("inventoryMovements").where("orderId", "==", f.orderId).get()).docs.map(doc => doc.data()),
      audit: (await collection("inventoryAudit").where("recordId", "==", f.orderId).get()).docs.map(doc => doc.data()),
      operations: (await collection("fulfillmentOperations").get()).size };
  }
  async function success(body) { const res = await post(body); assert.equal(res.status, 201, await res.clone().text()); return res.json(); }
  const f = await fixture("shipping");
  const clean = await snapshot(f);
  for (const [cookie, expected] of [[proof.cookie, 401], [legalCookie + "; " + proof.cookie, 403], [accountingCookie + "; " + proof.cookie, 403]])
    assert.equal((await post(f.body("packed", 0), { Cookie: cookie })).status, expected);
  assert.equal((await post(f.body("packed", 0), { "X-CSRF-Token": "0".repeat(64) })).status, 403);
  assert.equal((await post(f.body("packed", 0), { Origin: "https://attacker.example" })).status, 403);
  for (const invalid of [{ input: f.body("packed", 0).input }, f.body("packed", 0, { orderId: "../bad" }), f.body("packed", 0, { address1: "" })]) assert.equal((await post(invalid)).status, 400);
  assert.deepEqual(await snapshot(f), clean);
  check("fulfillment enforces roles, CSRF, safe IDs, address validation, and request identity");
  await collection("storeOrders").doc(f.orderId).update({ status: "pending_payment" });
  assert.equal((await post(f.body("packed", 0))).status, 409);
  await collection("storeOrders").doc(f.orderId).update({ status: "paid" });
  assert.equal((await post(f.body("shipped", 0))).status, 409);
  assert.equal((await post(f.body("delivered", 0))).status, 409);
  check("unpaid orders and dispatch or delivery before packing are rejected");
  await success(f.body("packed", 0));
  const packed = await snapshot(f);
  assert.deepEqual(packed.balances, clean.balances);
  assert.equal((await post(f.body("packed", 0, { notes: "stale tab" }))).status, 409);
  const dispatch = f.body("shipped", 1, { trackingNumber: "TEST-TRACKING" });
  const results = await Promise.all([success(dispatch), success(dispatch)]);
  assert.deepEqual(results[0], results[1]);
  const shipped = await snapshot(f);
  assert.equal(shipped.balances[0].onHand, 18); assert.equal(shipped.balances[0].allocated, 4);
  assert.equal(shipped.balances[1].onHand, 19); assert.equal(shipped.balances[1].allocated, 5);
  assert.deepEqual(shipped.balances[2], clean.balances[2]);
  assert.equal(shipped.balances[3].onHand, 18); assert.equal(shipped.balances[3].allocated, 4);
  assert.deepEqual(shipped.balances.slice(4), clean.balances.slice(4));
  assert.equal(shipped.locations[0].onHandUnits, 37); assert.equal(shipped.locations[1].onHandUnits, 38);
  assert.equal(shipped.movements.length, 3); assert.equal(shipped.audit.length, 2);
  assert.equal(shipped.order.status, "paid"); assert.equal(shipped.order.paymentId, "emulator-payment");
  assert.equal((await post({ ...dispatch, input: { ...dispatch.input, notes: "changed request" } })).status, 409);
  assert.equal((await post(f.body("cancelled", 2))).status, 409);
  assert.equal((await post(f.body("delivered", 2, { recipientName: "Different" }))).status, 409);
  assert.deepEqual(await snapshot(f), shipped);
  check("multi-line dispatch consumes exact original locations once, preserving other orders, stock buckets, and location totals");
  const delivered = f.body("delivered", 2, { trackingNumber: "TEST-TRACKING" });
  const deliveredResult = await success(delivered);
  const completed = await snapshot(f);
  assert.equal(completed.order.status, "fulfilled");
  assert.deepEqual(completed.balances, shipped.balances); assert.deepEqual(completed.locations, shipped.locations);
  assert.equal(completed.movements.length, 3);
  assert.deepEqual(await success(delivered), deliveredResult);
  assert.deepEqual(await success(dispatch), results[0]);
  for (const status of ["packed", "delivered", "cancelled"]) assert.equal((await post(f.body(status, 3))).status, 409);
  assert.deepEqual(await snapshot(f), completed);
  check("delivery does not deduct again, terminal orders cannot reopen, and old retries recover without effects");
  const cancelled = await fixture("cancelled");
  const beforeCancel = await snapshot(cancelled), cancel = cancelled.body("cancelled", 0);
  const cancelResult = await success(cancel), afterCancel = await snapshot(cancelled);
  assert.equal(afterCancel.order.status, "cancelled"); assert.equal(afterCancel.order.paymentId, "emulator-payment");
  assert.equal(afterCancel.balances[0].allocated, 4); assert.equal(afterCancel.balances[1].allocated, 5); assert.equal(afterCancel.balances[3].allocated, 4);
  assert.deepEqual(afterCancel.balances.map(b => b.onHand), beforeCancel.balances.map(b => b.onHand));
  assert.deepEqual(afterCancel.locations, beforeCancel.locations);
  assert.deepEqual(await success(cancel), cancelResult);
  assert.equal((await post(cancelled.body("cancelled", 1))).status, 409);
  assert.deepEqual(await snapshot(cancelled), afterCancel);
  check("pre-dispatch cancellation releases only this order, preserves physical stock and payment, and cannot repeat");
  for (const madeOnly of [false, true]) {
    const pickup = await fixture(madeOnly ? "made-only" : "pickup", madeOnly);
    const overrides = { method: "pickup", address1: "", address2: "", city: "", region: "", postalCode: "" };
    await success(pickup.body("packed", 0, overrides));
    assert.equal((await post(pickup.body("shipped", 1, overrides))).status, 400);
    await success(pickup.body("delivered", 1, overrides));
    const state = await snapshot(pickup);
    assert.equal(state.order.status, "fulfilled"); assert.equal(state.movements.length, madeOnly ? 0 : 3);
  }
  check("pickup needs no postal address; mixed and made-to-order-only orders complete without inventing stock");
  const competing = await fixture("competing");
  await success(competing.body("packed", 0));
  const race = await Promise.all([post(competing.body("shipped", 1)), post(competing.body("cancelled", 1))]);
  assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
  assert.equal((await snapshot(competing)).movements.length, 3);
  check("competing dispatch and cancellation commit only one outcome");
  for (const defect of ["shortage", "missing-balance", "rollup", "legacy-order", "legacy-fulfillment", "inconsistent-disposition"]) {
    const broken = await fixture(defect);
    await success(broken.body("packed", 0));
    if (defect === "shortage") await balance(broken.two, broken.b).update({ allocated: 1 });
    if (defect === "missing-balance") await balance(broken.two, broken.b).delete();
    if (defect === "rollup") await collection("stockLocations").doc(broken.b).update({ onHandUnits: 0 });
    if (defect === "legacy-order") { const doc = (await collection("storeOrders").doc(broken.orderId).get()).data(); await collection("storeOrders").doc(broken.orderId).update({ lines: doc.lines.map(({ allocations, ...line }) => line) }); }
    if (defect === "legacy-fulfillment") await collection("fulfillments").doc(broken.orderId).update({ schemaVersion: 0 });
    if (defect === "inconsistent-disposition") await collection("fulfillments").doc(broken.orderId).update({ stockDisposition: "consumed" });
    const before = await snapshot(broken);
    assert.equal((await post(broken.body("shipped", 1))).status, 409, defect);
    assert.deepEqual(await snapshot(broken), before, defect);
  }
  check("shortages, missing stock, bad rollups, and untrustworthy history reject without partial writes");
  // Exercise the actual checkout snapshot format, not only seeded paid orders.
  const bridge = await fixture("checkout-bridge"), productId = hash("fulfillment-bridge-product");
  await collection("stockLocations").doc(bridge.a).update({ "input.status": "active", "input.onlineEligible": true });
  await collection("products").doc(productId).set({ input: { title: "Checkout bridge", status: "active", publication: "public" } });
  for (const [variantId, fulfillment] of [[bridge.one, "stocked"], [bridge.made, "made_to_order"]])
    await collection("productVariants").doc(variantId).set({ input: { productId, sku: "BRIDGE-" + variantId.slice(0, 4), name: "Bridge print", size: "", color: "", material: "", finish: "", priceMinor: 2500, currency: "USD", weightGrams: null, fulfillment, status: "active", publication: "public" } });
  const checkout = await request("/api/store/orders", { method: "POST", headers, body: JSON.stringify({ operationId: randomUUID(), input: {
    customerName: "Bridge Buyer", customerEmail: "bridge@example.test", notes: "", fulfillmentMethod: "pickup", lines: [{ variantId: bridge.one, quantity: 2 }, { variantId: bridge.made, quantity: 1 }],
  } }) });
  assert.equal(checkout.status, 201, await checkout.clone().text());
  const actualOrder = await checkout.json();
  await collection("storeOrders").doc(actualOrder.id).update({ status: "paid" }); // Payment integration is a separate slice.
  await collection("productVariants").doc(bridge.one).update({ "input.fulfillment": "made_to_order", "input.status": "archived" });
  await collection("productVariants").doc(bridge.made).update({ "input.fulfillment": "stocked", "input.status": "archived" });
  await collection("stockLocations").doc(bridge.a).update({ "input.status": "archived", "input.onlineEligible": false });
  const beforeBridge = (await balance(bridge.one, bridge.a).get()).data();
  await success(bridge.body("packed", 0, { orderId: actualOrder.id, method: "pickup" }));
  await success(bridge.body("delivered", 1, { orderId: actualOrder.id, method: "pickup" }));
  const afterBridge = (await balance(bridge.one, bridge.a).get()).data();
  assert.equal(afterBridge.onHand, beforeBridge.onHand - 2); assert.equal(afterBridge.allocated, beforeBridge.allocated - 2);
  assert.equal(afterBridge.reserved, beforeBridge.reserved); assert.equal(afterBridge.unavailable, beforeBridge.unavailable);
  assert.equal((await collection("inventoryMovements").where("orderId", "==", actualOrder.id).get()).size, 1);
  check("real checkout snapshots fulfill correctly after catalog policies and location eligibility change");
  const catalog = await request("/api/store/orders", { headers: { Cookie: accountingCookie } });
  assert.equal(catalog.status, 200);
  const orders = (await catalog.json()).orders;
  assert.equal(orders.find(o => o.id === f.orderId).fulfillment.input.trackingNumber, "TEST-TRACKING");
  assert.ok(orders.find(o => o.orderNumber === "TEST-legacy-order").reviewReason);
  assert.equal((await request("/api/store/orders", { headers: { Cookie: legalCookie } })).status, 403);
  for (const [cookie, readOnly] of [[ownerCookie, false], [accountingCookie, true]]) {
    const page = await request("/admin/orders", { headers: { Cookie: cookie } });
    assert.equal(page.status, 200); const html = await page.text();
    assert.match(html, /How to fulfill shop orders/);
    if (readOnly) assert.match(html, /Accounting can review orders/);
  }
  const help = await request("/admin/how-to", { headers: { Cookie: ownerCookie } });
  assert.match(await help.text(), /id="fulfillment"/);
  check("staff catalog retains saved tracking and review warnings, accounting is read-only, and fulfillment help is linked");
  if (process.argv.includes("--fulfillment-preview")) {
    await fixture("BROWSER-SHIPPING"); await fixture("BROWSER-PICKUP", true);
    const marker = "web-app/.next-auth-test/fulfillment-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/fulfillment-preview.ready", "ready");
    console.log("Fulfillment browser preview ready: " + origin + "/admin/orders (owner@example.test / Emulator-password-123!)");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
