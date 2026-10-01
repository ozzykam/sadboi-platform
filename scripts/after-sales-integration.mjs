import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { access, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
const Stripe = createRequire(path.join(process.cwd(), "web-app/package.json"))("stripe");
export async function afterSalesChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, stripe, expirySecret }) {
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = value => createHash("sha256").update(value).digest("hex");
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (body, extra = {}) => request("/api/store/after-sales", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (response, status = 200) => { const r = await response; assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  const history = id => ok(request(`/api/store/after-sales?orderId=${id}`, { headers: { Cookie: ownerCookie } }));
  async function fixture(label, dispatched = true) {
    const id = hash("after-sales-" + label).slice(0, 32), variantId = hash(label + "return-variant"), locationId = hash(label + "return-location"), token = hash(label + "return-token");
    const stock = c("stockBalances").doc(hash(variantId + ":" + locationId)), order = c("storeOrders").doc(id);
    await c("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: "Returns studio " + label, kind: "studio", status: "active", onlineEligible: true }, revision: 1, onHandUnits: 10 });
    await stock.set({ businessId: "sadboi", variantId, locationId, onHand: 10, allocated: 3, reserved: 1, unavailable: 1, revision: 1 });
    await order.set({ businessId: "sadboi", orderNumber: "RETURNS-" + label, status: "pending_payment", totalMinor: 7500, allocationState: "held", lifecycleRevision: 0,
      managementTokenHash: hash(token), expiresAt: new Date(Date.now() + 1800000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      lines: [{ variantId, quantity: 3, allocations: [{ locationId, quantity: 3 }], fulfillment: "stocked", sku: "RETURNS-" + label, name: "Test print", productTitle: "Returns test artwork", unitCostMinor: 2500 }],
      input: { customerName: "Returns Test Buyer", customerEmail: "email-test@example.test", notes: "Private test notes", fulfillmentMethod: "pickup", lines: [{ variantId, quantity: 3 }] } });
    await ok(request("/api/store/checkout", { method: "POST", headers, body: JSON.stringify({ orderId: id, token }) }));
    const sessionId = (await order.get()).data().stripeCheckout.sessionId;
    stripe.pay(sessionId);
    const customer = () => ok(request(`/api/store/order-access/${id}`, { method: "POST", headers, body: JSON.stringify({ action: "status", token }) }));
    assert.equal((await customer()).status, "paid");
    let revision = 0;
    async function fulfill(status) {
      const input = { orderId: id, recipientName: "Returns Test Buyer", address1: "", address2: "", city: "", region: "", postalCode: "", country: "US", method: "pickup", trackingNumber: "", status, notes: "Private fulfillment notes" };
      const result = await ok(request("/api/store/fulfillment", { method: "POST", headers, body: JSON.stringify({ input, expectedRevision: revision, operationId: randomUUID() }) }), 201); revision = result.revision;
    }
    if (dispatched) { await fulfill("packed"); await fulfill("delivered"); }
    return { id, variantId, locationId, token, stock, order, customer, fulfill, paymentId: (await order.get()).data().paymentId };
  }
  const f = await fixture("main"), accountant = await identity("returns-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accountant));
  for (const [cookie, expected] of [["", 401], [legalCookie, 403], [accountingCookie, 200]]) assert.equal((await request(`/api/store/after-sales?orderId=${f.id}`, { headers: { Cookie: cookie } })).status, expected);
  const refundInput = async (target, amountMinor) => ({ action: "refund", orderId: target.id, operationId: randomUUID(), expectedRevision: (await history(target.id)).refundState.revision, amountMinor, reason: "Test customer refund" });
  const first = await refundInput(f, 2500);
  assert.equal((await post(first, { Cookie: accountingCookie + "; " + proof.cookie })).status, 403);
  assert.equal((await post(first, { Origin: "https://attacker.example" })).status, 403);
  assert.equal((await post({ ...first, amountMinor: 0 })).status, 400);
  assert.equal((await post({ ...first, amountMinor: 0.5 })).status, 400);
  assert.equal((await post({ ...first, paymentId: "pi_other" })).status, 400);
  assert.equal((await post({ ...first, amountMinor: 7501 })).status, 409);
  assert.equal(stripe.refundCreates(), 0);
  check("after-sales enforces staff roles, CSRF, exact inputs, integer amounts and the provider refund limit");

  const beforeStock = (await f.stock.get()).data(), creates = stripe.refundCreates();
  const responses = await Promise.all([post(first), post(first)]);
  assert.ok(responses.every(r => [201, 503].includes(r.status)));
  const recovered = await ok(post(first), 201);
  assert.equal(recovered.status, "succeeded"); assert.equal(stripe.refundCreates(), creates + 1);
  assert.equal((await history(f.id)).refundState.refundedMinor, 2500);
  assert.deepEqual((await f.stock.get()).data(), beforeStock);
  assert.equal((await post({ ...first, amountMinor: 2400 })).status, 409);
  assert.equal((await post({ ...first, operationId: randomUUID() })).status, 409);
  check("concurrent refund retries submit once, stale or changed requests fail, and refunding never changes physical stock");

  const pendingRequest = await refundInput(f, 1000); stripe.setRefundStatus("pending");
  const pending = await ok(post(pendingRequest), 201); assert.equal(pending.status, "pending");
  assert.equal((await post(await refundInput(f, 500))).status, 409);
  let h = await history(f.id), providerId = h.refunds.find(row => row.id === pending.id).providerId;
  assert.equal(h.refundState.pendingMinor, 1000);
  stripe.resolveRefund(providerId, "failed");
  const delivered = { id: "evt_refund_failed_fixture", object: "event", type: "refund.failed", livemode: false, data: { object: { ...stripe.refunds.get(providerId), status: "pending" } } };
  const payload = JSON.stringify(delivered), signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: stripe.secret });
  assert.equal((await request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "wrong" }, body: payload })).status, 400);
  const webhook = () => request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": signature }, body: payload });
  await ok(webhook()); await ok(webhook());
  h = await history(f.id); assert.equal(h.refundState.pendingMinor, 0); assert.equal(h.refundState.activeId, null);
  assert.equal(h.refunds.find(row => row.id === pending.id).status, "failed");
  stripe.setRefundStatus("succeeded");
  check("pending refunds block new requests and signed webhook replay uses canonical failed status without regressing totals");

  const lost = await refundInput(f, 1500); stripe.dropRefundResponses(2);
  assert.equal((await post(lost)).status, 503);
  h = await history(f.id); assert.ok(h.refundState.activeId);
  const lostId = h.refundState.activeId, oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await c("storeOrderRefunds").doc(lostId).update({ createdAt: oldDate });
  const beforeRecovery = stripe.refundCreates();
  assert.equal((await ok(post(lost), 201)).status, "succeeded");
  assert.equal(stripe.refundCreates(), beforeRecovery);
  assert.equal((await history(f.id)).refundState.refundedMinor, 4000);
  check("lost refund responses recover by provider metadata even after the retry window, without issuing another refund");

  const wrong = await fixture("ownership");
  const payment = stripe.payments.get(wrong.paymentId), metadata = { ...payment.metadata };
  payment.metadata.orderId = f.id; assert.equal((await post(await refundInput(wrong, 100))).status, 409); payment.metadata = metadata;
  payment.livemode = true; assert.equal((await post(await refundInput(wrong, 100))).status, 409); payment.livemode = false;
  const unshipped = await fixture("unshipped", false);
  assert.equal((await post(await refundInput(unshipped, 7500))).status, 409);
  await unshipped.fulfill("cancelled");
  assert.equal((await ok(post(await refundInput(unshipped, 7500)), 201)).status, "succeeded");
  assert.equal((await unshipped.stock.get()).data().onHand, 10); assert.equal((await unshipped.stock.get()).data().allocated, 0);
  assert.equal((await unshipped.order.get()).data().status, "cancelled");
  check("refunds reject wrong order/live payment mappings and require unshipped cancellation before a full refund");

  const receiveInput = async (target, quantity, disposition, locationId = target.locationId) => ({ action: "receive", orderId: target.id, operationId: randomUUID(), expectedRevision: (await history(target.id)).returnState.revision,
    variantId: target.variantId, quantity, disposition, locationId: disposition === "discard" ? null : locationId, notes: "Test return inspection" });
  const receive = await receiveInput(f, 1, "sellable");
  const returns = await Promise.all([ok(post(receive), 201), ok(post(receive), 201)]); assert.deepEqual(returns[0], returns[1]);
  let stock = (await f.stock.get()).data(); assert.equal(stock.onHand, 8); assert.equal(stock.reserved, 1); assert.equal(stock.unavailable, 1); assert.equal(stock.allocated, 0);
  assert.equal((await c("stockLocations").doc(f.locationId).get()).data().onHandUnits, 8);
  assert.equal((await post({ ...receive, quantity: 2 })).status, 409);
  assert.equal((await post({ ...receive, operationId: randomUUID() })).status, 409);
  await ok(post(await receiveInput(f, 1, "quarantine")), 201);
  stock = (await f.stock.get()).data(); assert.equal(stock.onHand, 9); assert.equal(stock.unavailable, 2);
  await ok(post(await receiveInput(f, 1, "discard")), 201); assert.deepEqual((await f.stock.get()).data(), stock);
  assert.equal((await post(await receiveInput(f, 1, "sellable"))).status, 409);
  assert.equal((await c("inventoryMovements").where("orderId", "==", f.id).where("kind", "==", "order_return").get()).size, 2);
  assert.equal((await history(f.id)).refundState.refundedMinor, 4000);
  check("returns cap cumulative quantities, retry exactly once, update location totals and distinguish sellable, quarantine and discard without refunding");

  const beforeBad = (await wrong.stock.get()).data();
  assert.equal((await post(await receiveInput(unshipped, 1, "sellable"))).status, 409);
  assert.equal((await post(await receiveInput(wrong, 4, "sellable"))).status, 409);
  assert.equal((await post(await receiveInput(wrong, 1, "sellable", hash("missing-location")))).status, 409);
  await c("stockLocations").doc(wrong.locationId).update({ onHandUnits: -1 });
  assert.equal((await post(await receiveInput(wrong, 1, "sellable"))).status, 409);
  await c("stockLocations").doc(wrong.locationId).update({ onHandUnits: 7 });
  assert.deepEqual((await wrong.stock.get()).data(), beforeBad); assert.equal((await history(wrong.id)).returnState.revision, 0);
  const contenders = await Promise.all([receiveInput(wrong, 2, "sellable"), receiveInput(wrong, 2, "sellable")]);
  assert.deepEqual((await Promise.all(contenders.map(post))).map(r => r.status).sort(), [201, 409]);
  check("unshipped, oversized and invalid-location returns roll back; competing receipts cannot exceed dispatched quantities");

  const remaining = await refundInput(f, 3500); await ok(post(remaining), 201);
  assert.equal((await post(await refundInput(f, 1))).status, 409);
  const customer = await f.customer(); assert.equal(customer.afterSales.refundedMinor, 7500); assert.equal(customer.afterSales.returnedUnits, 3); assert.equal(customer.totalMinor, 7500); assert.equal(customer.status, "fulfilled");
  assert.ok(!JSON.stringify(customer).includes("Test return inspection")); assert.ok(!JSON.stringify(customer).includes("Test customer refund"));
  const publicRead = await request(`/api/store/order-access/${f.id}`, { method: "POST", headers, body: JSON.stringify({ action: "status", token: "0".repeat(64) }) }); assert.equal(publicRead.status, 404);
  check("full refunds preserve original order totals and status; private customers see safe refund/return summaries with no staff notes");

  const job = await fixture("worker"); stripe.setRefundStatus("pending");
  const jobRequest = await refundInput(job, 1000), jobResult = await ok(post(jobRequest), 201);
  const jobProvider = (await history(job.id)).refunds.find(row => row.id === jobResult.id).providerId;
  stripe.resolveRefund(jobProvider, "succeeded"); stripe.setRefundStatus("succeeded");
  assert.equal((await request("/api/cron/order-expiry", { method: "POST", headers: { Authorization: "Bearer wrong" } })).status, 401);
  const worker = await ok(request("/api/cron/order-expiry", { method: "POST", headers: { Authorization: "Bearer " + expirySecret } }));
  assert.ok(worker.refunds.results.some(row => row.id === jobResult.id && row.status === "succeeded"));
  stripe.setUnavailable(true); assert.equal((await post({ action: "refresh", orderId: job.id })).status, 503); stripe.setUnavailable(false);
  assert.equal((await history(job.id)).refundState.refundedMinor, 1000);
  const help = await request("/admin/how-to", { headers: { Cookie: ownerCookie } }); assert.match(await help.text(), /id="returns-refunds"/);
  check("the authenticated worker reconciles pending refunds, provider outages preserve saved totals, and staff help is discoverable");

  const oldId = hash("old-uncertain-refund"), oldJob = (await c("storeOrderRefunds").doc(jobResult.id).get()).data();
  const oldParams = { ...oldJob.params, amount: 250, metadata: { ...oldJob.params.metadata, sadboiRefundId: oldId } };
  await c("storeOrderRefunds").doc(oldId).set({ ...oldJob, amountMinor: 250, params: oldParams, key: "sadboi-refund-" + oldId,
    status: "prepared", active: true, providerId: null, createdAt: oldDate });
  await job.order.update({ "refundState.activeId": oldId });
  const countBeforeOld = stripe.refundCreates();
  await c("storeOrderRefunds").doc(oldId).update({ createdAt: new Date().toISOString(), params: { ...oldParams, amount: 500 } });
  assert.equal((await post({ action: "refresh", orderId: job.id })).status, 409);
  assert.equal(stripe.refundCreates(), countBeforeOld);
  await c("storeOrderRefunds").doc(oldId).update({ params: oldParams, key: "changed-refund-key" });
  assert.equal((await post({ action: "refresh", orderId: job.id })).status, 409);
  assert.equal(stripe.refundCreates(), countBeforeOld);
  await c("storeOrderRefunds").doc(oldId).update({ key: "sadboi-refund-" + oldId, createdAt: oldDate });
  check("corrupted saved refund amounts and idempotency keys are rejected before any provider submission");
  assert.equal((await ok(post({ action: "refresh", orderId: job.id }))).status, "needs_review");
  assert.equal(stripe.refundCreates(), countBeforeOld);
  assert.equal((await post(await refundInput(job, 250))).status, 409);
  stripe.refunds.set("re_recoveredOld", { id: "re_recoveredOld", object: "refund", amount: 250, currency: "usd", payment_intent: job.paymentId, status: "succeeded", metadata: oldParams.metadata });
  assert.equal((await ok(post({ action: "refresh", orderId: job.id }))).status, "succeeded");
  assert.equal((await history(job.id)).refundState.refundedMinor, 1250);
  assert.equal(stripe.refundCreates(), countBeforeOld);
  check("old uncertain refunds stop before unsafe resubmission and recover only when a matching provider record is found");

  stripe.refunds.set("re_dashboardPending", { id: "re_dashboardPending", object: "refund", amount: 500, currency: "usd", payment_intent: job.paymentId, status: "pending", metadata: {} });
  assert.equal((await post(await refundInput(job, 100))).status, 409);
  await ok(post({ action: "refresh", orderId: job.id }));
  assert.equal((await history(job.id)).refundState.pendingMinor, 500);
  stripe.resolveRefund("re_dashboardPending", "canceled");
  stripe.refunds.set("re_dashboardSuccess", { id: "re_dashboardSuccess", object: "refund", amount: 250, currency: "usd", payment_intent: job.paymentId, status: "succeeded", metadata: {} });
  await ok(post({ action: "refresh", orderId: job.id }));
  const externalHistory = await history(job.id);
  assert.equal(externalHistory.refundState.refundedMinor, 1500); assert.equal(externalHistory.refundState.pendingMinor, 0);
  assert.ok(externalHistory.refundState.refunds.some(row => row.id === "re_dashboardSuccess"));
  check("dashboard refunds are included in verified totals, external pending amounts block commands and canceled amounts stop reserving funds");

  if (process.argv.includes("--after-sales-preview")) {
    const marker = "web-app/.next-auth-test/after-sales-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/after-sales-preview.ready", JSON.stringify({ orderId: job.id, orderNumber: "RETURNS-worker", url: `${origin}/orders/${job.id}#${job.token}` }));
    console.log("After-sales browser preview ready at " + origin + "/admin/orders");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
