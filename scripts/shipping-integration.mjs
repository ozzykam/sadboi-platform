import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { access, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function shippingChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, stripe }) {
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = value => createHash("sha256").update(value).digest("hex");
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (url, body, extra = {}) => request(url, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (response, status = 200) => { const result = await response; assert.equal(result.status, status, await result.clone().text()); return result.json(); };
  const settings = () => ok(request("/api/store/shipping", { headers: { Cookie: ownerCookie } }));
  const policy = { standard: { enabled: true, amountMinor: 750 }, express: { enabled: true, amountMinor: 1500 }, regions: ["IL", "WI"] };
  let current = await settings(); assert.equal(current.revision, 0);
  const accounting = await identity("shipping-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accounting));
  for (const [cookie, expected] of [["", 401], [legalCookie, 403]]) assert.equal((await request("/api/store/shipping", { headers: { Cookie: cookie } })).status, expected);
  assert.equal((await request("/api/store/shipping", { headers: { Cookie: accountingCookie } })).status, 200);
  const initialSave = { input: policy, operationId: randomUUID(), expectedRevision: 0 };
  assert.equal((await post("/api/store/shipping", initialSave, { Cookie: accountingCookie + "; " + proof.cookie })).status, 403);
  assert.equal((await post("/api/store/shipping", initialSave, { Origin: "https://attacker.example" })).status, 403);
  assert.equal((await post("/api/store/shipping", { ...initialSave, input: { ...policy, standard: { enabled: true, amountMinor: -1 } } })).status, 400);
  assert.equal((await settings()).revision, 0);
  check("shipping settings enforce staff/accounting roles, CSRF and integer nonnegative rate validation");

  const productId = hash("shipping-product"), variantId = hash("shipping-variant"), locationId = hash("shipping-location"), stockRef = c("stockBalances").doc(hash(variantId + ":" + locationId));
  await c("products").doc(productId).set({ businessId: "sadboi", input: { artworkId: hash("shipping-art"), title: "Shipping test print", kind: "print", description: "Disposable emulator artwork for shipping checkout", status: "active", publication: "public" } });
  await c("productVariants").doc(variantId).set({ businessId: "sadboi", input: { productId, sku: "SHIPPING-TEST", name: "Shipping edition", size: "", color: "", material: "", finish: "", priceMinor: 2500, currency: "USD", weightGrams: null, fulfillment: "stocked", status: "active", publication: "public" } });
  await c("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: "Shipping test studio", kind: "studio", status: "active", onlineEligible: true }, onHandUnits: 20, revision: 1 });
  await stockRef.set({ businessId: "sadboi", variantId, locationId, onHand: 20, allocated: 0, reserved: 0, unavailable: 0, revision: 1 });
  const input = { customerName: "Shipping Test Buyer", customerEmail: "email-test@example.test", notes: "Emulator checkout", fulfillmentMethod: "shipping", shippingService: "standard",
    shippingAddress: { line1: "1 Test Street", line2: "", city: "Chicago", region: "IL", postalCode: "60601", country: "US" }, lines: [{ variantId, quantity: 2 }] };
  const pickup = { ...input, fulfillmentMethod: "pickup", shippingService: undefined, shippingAddress: null };
  const quote = value => ok(post("/api/store/quote", value));
  const before = async () => ({ stock: (await stockRef.get()).data(), counter: (await c("inventoryState").doc("store").get()).data() ?? null, orders: (await c("storeOrders").get()).size, operations: (await c("storeOrderOperations").get()).size });
  const baseline = await before();
  assert.equal((await post("/api/store/quote", input)).status, 409);
  assert.equal((await quote(pickup)).totals.totalMinor, 5000); assert.deepEqual(await before(), baseline);
  check("default settings leave shipping unavailable, pickup free, and quote requests do not reserve stock or create orders");
  const [one, two] = await Promise.all([ok(post("/api/store/shipping", initialSave)), ok(post("/api/store/shipping", initialSave))]);
  assert.deepEqual(one, two); current = one; assert.equal(current.revision, 1);
  assert.equal((await post("/api/store/shipping", { ...initialSave, operationId: randomUUID() })).status, 409);
  assert.equal((await post("/api/store/shipping", { ...initialSave, input: { ...policy, regions: ["IL"] } })).status, 409);
  assert.equal((await c("inventoryAudit").where("resource", "==", "shipping").get()).size, 1);
  async function save(input) { current = await ok(post("/api/store/shipping", { input, expectedRevision: current.revision, operationId: randomUUID() })); }
  const standard = await quote(input), express = await quote({ ...input, shippingService: "express" });
  assert.deepEqual({ subtotal: standard.totals.subtotalMinor, shipping: standard.totals.shippingMinor, total: standard.totals.totalMinor, tax: standard.totals.taxMinor }, { subtotal: 5000, shipping: 750, total: 5750, tax: null });
  assert.equal(express.totals.totalMinor, 6500);
  for (const change of [{ country: "CA" }, { region: "PR" }, { region: "NY" }, { postalCode: "wrong" }]) assert.equal((await post("/api/store/quote", { ...input, shippingAddress: { ...input.shippingAddress, ...change } })).status, 409);
  assert.equal((await post("/api/store/quote", { ...input, totalMinor: 1 })).status, 400);
  assert.equal((await post("/api/store/quote", input, { Origin: "https://attacker.example" })).status, 403);
  assert.deepEqual(await before(), baseline);
  check("configured standard/express rates apply once per order; settings retry once, stale edits fail, and unsupported or injected quotes are rejected");

  assert.equal((await post("/api/store/orders", { input, operationId: randomUUID() })).status, 400);
  assert.equal((await post("/api/store/orders", { input, operationId: randomUUID(), quoteId: "0".repeat(64) })).status, 409);
  await c("productVariants").doc(variantId).update({ "input.priceMinor": 3000 });
  assert.equal((await post("/api/store/orders", { input, operationId: randomUUID(), quoteId: standard.id })).status, 409);
  assert.equal((await quote(input)).totals.totalMinor, 6750);
  await c("productVariants").doc(variantId).update({ "input.priceMinor": 2500 });
  await save({ ...policy, standard: { enabled: true, amountMinor: 950 } });
  assert.equal((await post("/api/store/orders", { input, operationId: randomUUID(), quoteId: standard.id })).status, 409);
  assert.deepEqual(await before(), baseline);
  const reviewed = await quote(input), create = { input, quoteId: reviewed.id, operationId: randomUUID() };
  assert.equal(reviewed.totals.totalMinor, 5950);
  const [order, recovered] = await Promise.all([ok(post("/api/store/orders", create), 201), ok(post("/api/store/orders", create), 201)]);
  assert.deepEqual(order, recovered); assert.equal(order.totalMinor, 5950); assert.equal((await stockRef.get()).data().allocated, 2);
  const savedOrder = (await c("storeOrders").doc(order.id).get()).data();
  assert.deepEqual(savedOrder.pricing, reviewed.totals);
  const mail = (await c("orderEmails").doc(`${order.id}_order_received`).get()).data();
  assert.match(mail.template.text, /Standard shipping: \$9\.50 USD/); assert.match(mail.template.html, /Tax: not calculated/);
  check("missing, forged, price-stale and rate-stale quotes create no partial writes; concurrent accepted requests freeze one total and allocation");

  await save({ ...policy, standard: { enabled: false, amountMinor: 1000 }, express: { enabled: false, amountMinor: 1500 } });
  await c("productVariants").doc(variantId).update({ "input.priceMinor": 3000 });
  assert.deepEqual(await ok(post("/api/store/orders", { input, operationId: create.operationId }), 201), order);
  assert.equal((await post("/api/store/quote", input)).status, 409);
  const accessOrder = () => ok(post(`/api/store/order-access/${order.id}`, { action: "status", token: order.managementToken }));
  const customer = await accessOrder(); assert.deepEqual(customer.pricing, reviewed.totals);
  assert.equal((await ok(request("/api/store/orders", { headers: { Cookie: accountingCookie } }))).orders.find(row => row.id === order.id).pricing.totalMinor, 5950);
  await ok(post("/api/store/checkout", { orderId: order.id, token: order.managementToken }));
  const checkout = (await c("storeOrders").doc(order.id).get()).data().stripeCheckout;
  assert.equal(checkout.params.line_items.length, 2);
  assert.equal(checkout.params.line_items[0].price_data.unit_amount, 5000); assert.equal(checkout.params.line_items[1].price_data.unit_amount, 950);
  assert.equal(stripe.sessions.get(checkout.sessionId).amount_total, 5950);
  stripe.pay(checkout.sessionId); assert.equal((await accessOrder()).status, "paid");
  assert.equal((await stockRef.get()).data().allocated, 2);
  assert.equal((await c("orderEmails").doc(`${order.id}_payment_confirmed`).get()).data().template.text.includes("Total: $59.50 USD"), true);
  check("saved orders and recovery retain original prices after disabling shipping; Stripe, private/staff totals and payment emails agree");

  const legacyId = hash("shipping-legacy").slice(0, 32), legacyToken = hash("shipping-legacy-token");
  await c("storeOrders").doc(legacyId).set({ ...savedOrder, orderNumber: "SHIPPING-LEGACY", pricing: null, status: "paid", totalMinor: 1234, managementTokenHash: hash(legacyToken) });
  const legacy = await ok(post(`/api/store/order-access/${legacyId}`, { action: "status", token: legacyToken }));
  assert.equal(legacy.totalMinor, 1234); assert.equal(legacy.pricing, null);
  const help = await okPage("/admin/how-to", ownerCookie); assert.match(help, /id="shipping-rates"/);
  assert.match(await okPage("/admin/shipping", accountingCookie), /Accounting can review/);
  assert.equal((await request("/admin/shipping", { headers: { Cookie: legalCookie } })).status, 307);
  check("historical totals are not repriced or assigned invented shipping/tax, accounting is read-only, and shipping help is discoverable");
  async function okPage(url, cookie) { const response = await request(url, { headers: { Cookie: cookie } }); assert.equal(response.status, 200); return response.text(); }

  // Leave explicit fictional rates and a valid public catalog for browser QA.
  await save(policy); await c("productVariants").doc(variantId).update({ "input.priceMinor": 2500 });
  if (process.argv.includes("--shipping-preview")) {
    // Earlier suites seed partial catalog documents for API edge cases. Keep
    // this browser fixture focused on the fully populated shipping test print.
    const otherProducts = await c("products").where("input.publication", "==", "public").get();
    await Promise.all(otherProducts.docs.filter(doc => doc.id !== productId).map(doc => doc.ref.update({ "input.publication": "private" })));
    const marker = "web-app/.next-auth-test/shipping-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/shipping-preview.ready", JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber, productId, url: `${origin}/orders/${order.id}#${order.managementToken}` }));
    console.log("Shipping browser preview ready at " + origin + "/shop");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
