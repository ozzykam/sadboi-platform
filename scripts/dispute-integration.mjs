import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { access, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
const Stripe = createRequire(path.join(process.cwd(), "web-app/package.json"))("stripe");
export async function disputeChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, stripe, expirySecret }) {
  const originalRefundCreates = stripe.refundCreates();
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = text => createHash("sha256").update(text).digest("hex");
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (route, body, extra = {}) => request(`/api/store/${route}`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (response, status = 200) => { const r = await response; assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  const history = f => ok(request(`/api/store/disputes?orderId=${f.id}`, { headers: { Cookie: ownerCookie } }));
  const refresh = f => post("disputes", { action: "refresh", orderId: f.id });
  const webhook = (row, type = "charge.dispute.updated", changes = {}) => {
    const payload = JSON.stringify({ id: "evt_dispute_" + randomUUID().replaceAll("-", ""), object: "event", type, livemode: false, data: { object: { ...row, ...changes } } });
    return request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: stripe.secret }) }, body: payload });
  };
  async function fixture(label, shipped = false) {
    const id = hash("dispute-" + label).slice(0, 32), variantId = hash("dispute-variant-" + label), locationId = hash("dispute-location-" + label), token = hash("dispute-token-" + label);
    const order = c("storeOrders").doc(id), stock = c("stockBalances").doc(hash(variantId + ":" + locationId));
    const address = { line1: "100 Test Street", line2: "", city: "Chicago", region: "IL", postalCode: "60601", country: "US" };
    await c("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: "Dispute test studio " + label, status: "active", kind: "studio", onlineEligible: true }, revision: 1, onHandUnits: 10 });
    await stock.set({ businessId: "sadboi", variantId, locationId, onHand: 10, allocated: 1, reserved: 1, unavailable: 1, revision: 1 });
    await order.set({ businessId: "sadboi", orderNumber: "DISPUTE-" + label, status: "pending_payment", totalMinor: 3500, allocationState: "held", lifecycleRevision: 0,
      managementTokenHash: hash(token), expiresAt: new Date(Date.now() + 1800000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      lines: [{ variantId, quantity: 1, allocations: [{ locationId, quantity: 1 }], fulfillment: "stocked", sku: "DISPUTE-" + label, name: "Test print", productTitle: "Dispute test artwork", unitPriceMinor: 3500 }],
      input: { customerName: "Dispute Test Buyer", customerEmail: "dispute@example.test", notes: "", fulfillmentMethod: "shipping", shippingService: "standard", shippingAddress: address, lines: [{ variantId, quantity: 1 }] } });
    await ok(post("checkout", { orderId: id, token }));
    stripe.pay((await order.get()).data().stripeCheckout.sessionId);
    const customer = () => ok(post(`order-access/${id}`, { action: "status", token }));
    await customer();
    let revision = 0;
    const fulfill = async status => {
      const response = await post("fulfillment", { input: { orderId: id, recipientName: "Dispute Test Buyer", address1: address.line1, address2: "", city: address.city, region: address.region, postalCode: address.postalCode, country: "US", method: "standard", trackingNumber: "DISPUTE-TRACKING", status, notes: "Test fulfillment" }, expectedRevision: revision, operationId: randomUUID() });
      if (response.status === 201) revision = (await response.clone().json()).revision;
      return response;
    };
    if (shipped) { await ok(fulfill("packed"), 201); await ok(fulfill("shipped"), 201); }
    const paymentId = (await order.get()).data().paymentId;
    const dispute = { id: "du_fixture" + hash(label).slice(0, 12), object: "dispute", livemode: false, payment_intent: paymentId,
      charge: stripe.payments.get(paymentId).latest_charge.id, amount: 3500, currency: "usd", status: "needs_response", reason: "product_not_received",
      created: Math.floor(Date.now() / 1000), is_charge_refundable: false, evidence_details: { due_by: Math.floor(Date.now() / 1000) + 86400 * 7, has_evidence: false, past_due: false, submission_count: 0 }, evidence: { uncategorized_text: "Provider private evidence" } };
    return { id, order, stock, variantId, locationId, token, customer, fulfill, paymentId, dispute };
  }
  const f = await fixture("main"), accounting = await identity("dispute-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accounting));
  for (const [cookie, expected] of [["", 401], [legalCookie, 403], [accountingCookie, 200]]) assert.equal((await request(`/api/store/disputes?orderId=${f.id}`, { headers: { Cookie: cookie } })).status, expected);
  for (const extra of [{ Cookie: accountingCookie + "; " + proof.cookie }, { "X-CSRF-Token": "wrong" }, { Origin: "https://attacker.example" }]) assert.equal((await post("disputes", { action: "refresh", orderId: f.id }, extra)).status, 403);
  assert.equal((await post("disputes", { action: "refresh", orderId: f.id, paymentId: "pi_injected" })).status, 400);
  assert.equal((await history(f)).checkedAt, null); await ok(refresh(f)); assert.equal((await history(f)).rows.length, 0); assert.ok((await history(f)).checkedAt);
  check("dispute access enforces roles, CSRF, strict commands and distinguishes unchecked orders from empty provider history");

  const originalStock = (await f.stock.get()).data(), originalOrder = (await f.order.get()).data();
  stripe.disputes.set(f.dispute.id, f.dispute);
  await ok(webhook(f.dispute, "charge.dispute.created", { status: "won", amount: 1 }));
  let h = await history(f), row = h.rows[0];
  assert.equal(row.snapshot.status, "needs_response"); assert.equal(row.snapshot.amountMinor, 3500); assert.equal(h.held, true);
  await ok(webhook(f.dispute)); await ok(refresh(f));
  h = await history(f); assert.equal(h.rows[0].events.length, 1);
  assert.deepEqual((await f.stock.get()).data(), originalStock); assert.equal((await f.order.get()).data().status, originalOrder.status);
  assert.equal((await f.order.get()).data().totalMinor, 3500);
  assert.equal((await request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "stripe-signature": "invalid" }, body: "{}" })).status, 400);
  check("signed dispute webhooks use canonical Stripe details, deduplicate status history and never move money or stock");

  const note = { action: "note", orderId: f.id, id: row.id, expectedRevision: 0, operationId: randomUUID(), input: { plan: "challenge", evidence: "PRIVATE delivery evidence reference", note: "PRIVATE bank response preparation" } };
  const saves = await Promise.all([post("disputes", note), post("disputes", note)]); for (const response of saves) assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await history(f)).rows[0].notes.length, 1);
  assert.equal((await post("disputes", { ...note, input: { ...note.input, plan: "accept" } })).status, 409);
  assert.equal((await post("disputes", { ...note, operationId: randomUUID() })).status, 409);
  assert.equal((await post("disputes", { ...note, input: { ...note.input, status: "won" } })).status, 400);
  const nextNote = { ...note, expectedRevision: 1, operationId: randomUUID(), input: { ...note.input, plan: "accept", note: "PRIVATE plan only, not submitted" } };
  await ok(post("disputes", nextNote), 201); assert.equal((await ok(post("disputes", note), 201)).revision, 1);
  assert.equal(stripe.disputes.get(f.dispute.id).status, "needs_response"); assert.equal(stripe.disputeWrites(), 0);
  check("private dispute plans have immutable note history, exact retry recovery and stale-edit protection without bank submission");

  assert.equal((await f.fulfill("packed")).status, 409); assert.deepEqual((await f.stock.get()).data(), originalStock);
  const customer = await f.customer();
  for (const hidden of [f.dispute.id, "PRIVATE", "Provider private evidence", "disputeState", "product_not_received"]) assert.ok(!JSON.stringify(customer).includes(hidden));
  const listed = await ok(request("/api/store/orders", { headers: { Cookie: ownerCookie } })); assert.equal(listed.orders.find(order => order.id === f.id).disputeHold, true);
  await ok(f.fulfill("cancelled"), 201); assert.equal((await f.stock.get()).data().allocated, 0); assert.equal((await f.stock.get()).data().onHand, 10);
  assert.equal((await post("after-sales", { action: "refund", orderId: f.id, operationId: randomUUID(), expectedRevision: 0, amountMinor: 3500, reason: "Test disputed refund" })).status, 409);
  check("known dispute holds prevent new fulfillment/refunds while cancellation releases allocations and customers cannot read private dispute data");

  const savedState = (await f.order.get()).data().disputeState;
  stripe.setUnavailable(true); assert.equal((await refresh(f)).status, 503); stripe.setUnavailable(false);
  assert.deepEqual((await f.order.get()).data().disputeState, savedState);
  for (const change of [{ livemode: true }, { charge: "ch_wrong" }, { currency: "eur" }, { status: "unknown_status" }]) {
    stripe.disputes.set(f.dispute.id, { ...f.dispute, ...change }); assert.equal((await refresh(f)).status, 409);
  }
  stripe.disputes.set(f.dispute.id, f.dispute);
  const metadata = stripe.payments.get(f.paymentId).metadata;
  stripe.payments.get(f.paymentId).metadata = { ...metadata, orderId: "f".repeat(32) }; assert.equal((await refresh(f)).status, 409); stripe.payments.get(f.paymentId).metadata = metadata;
  stripe.setDisputeListLimit(true); assert.equal((await refresh(f)).status, 409); stripe.setDisputeListLimit(false);
  stripe.disputes.delete(f.dispute.id); assert.equal((await refresh(f)).status, 409); stripe.disputes.set(f.dispute.id, f.dispute);
  assert.deepEqual((await f.order.get()).data().disputeState, savedState);
  check("outages, live or mismatched disputes, unknown states and incomplete lists preserve prior dispute history and holds");

  f.dispute.status = "under_review"; f.dispute.evidence_details = { ...f.dispute.evidence_details, has_evidence: true, submission_count: 1 };
  await ok(webhook(f.dispute)); assert.equal((await history(f)).rows[0].snapshot.submissionCount, 1);
  f.dispute.status = "won";
  const worker = await ok(request("/api/cron/order-expiry", { method: "POST", headers: { Authorization: "Bearer " + expirySecret } }));
  assert.ok(worker.disputes.results.some(result => result.orderId === f.id && result.status === "checked"));
  h = await history(f); assert.equal(h.held, false); assert.equal(h.rows[0].snapshot.status, "won"); assert.equal(h.rows[0].notes.length, 2);
  await ok(webhook(f.dispute, "charge.dispute.closed", { status: "needs_response" })); assert.equal((await history(f)).rows[0].snapshot.status, "won");
  assert.equal((await c("storeDisputes").doc(row.id).get()).data().needsSync, false);
  check("the scheduler reconciles known open disputes and stale webhook payloads cannot regress canonical outcomes or erase staff notes");

  const shipped = await fixture("shipped", true);
  await ok(post("shipment-cases", { orderId: shipped.id, operationId: randomUUID(), expectedRevision: 0,
    input: { kind: "lost", status: "open", items: [{ variantId: shipped.variantId, quantity: 1 }], carrier: "", claimReference: "", evidence: "Test shipment reference", note: "Test lost shipment", resolution: null, refundId: null, returnId: null } }), 201);
  const prep = () => ({ action: "prepare", orderId: shipped.id, operationId: randomUUID(), expectedCaseRevision: 1,
    items: [{ variantId: shipped.variantId, quantity: 1, locationId: shipped.locationId }], note: "Test replacement" });
  const replacement = await ok(post("replacements", prep()), 201);
  stripe.disputes.set(shipped.dispute.id, shipped.dispute); await ok(refresh(shipped));
  const update = status => ({ action: "update", orderId: shipped.id, replacementId: replacement.id, expectedRevision: 1, operationId: randomUUID(), status, trackingNumber: "REPLACEMENT-TEST", note: "Test replacement state" });
  assert.equal((await post("replacements", update("shipped"))).status, 409);
  await ok(post("replacements", update("cancelled")), 201); assert.equal((await shipped.stock.get()).data().allocated, 0);
  assert.equal((await post("replacements", prep())).status, 409);
  await ok(shipped.fulfill("delivered"), 201); assert.equal((await shipped.stock.get()).data().onHand, 9);
  shipped.dispute.status = "lost"; await ok(refresh(shipped)); assert.equal((await history(shipped)).held, true);
  shipped.dispute.status = "won"; await ok(refresh(shipped)); await ok(post("replacements", prep()), 201);
  check("disputes hold replacement preparation/dispatch but allow cancellation and already-shipped delivery; a verified win lifts only the dispute hold");

  const other = await fixture("other"); assert.equal((await post("disputes", { ...nextNote, orderId: other.id, operationId: randomUUID() })).status, 404);
  other.dispute.status = "warning_needs_response"; stripe.disputes.set(other.dispute.id, other.dispute); await ok(refresh(other)); assert.equal((await history(other)).held, true);
  for (const status of ["warning_closed", "prevented"]) { other.dispute.status = status; await ok(refresh(other)); assert.equal((await history(other)).held, false); }
  const help = await request("/admin/how-to", { headers: { Cookie: accountingCookie } }); assert.match(await help.text(), /id="payment-disputes"/);
  assert.equal(stripe.disputeWrites(), 0); assert.equal(stripe.refundCreates(), originalRefundCreates);
  check("cross-order notes are rejected, inquiries/prevented disputes use their own outcomes, and role-appropriate help explains the workflow");

  if (process.argv.includes("--dispute-preview")) {
    other.dispute.status = "needs_response"; await ok(refresh(other));
    const marker = "web-app/.next-auth-test/dispute-preview.done"; try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/dispute-preview.ready", JSON.stringify({ orderId: other.id, orderNumber: "DISPUTE-other", url: `${origin}/orders/${other.id}#${other.token}` }));
    console.log("Dispute browser preview ready at " + origin + "/admin/orders");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
