import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { access as fileAccess, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const Stripe = createRequire(path.join(process.cwd(), "web-app/package.json"))("stripe");
export async function orderLifecycleChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, stripe, expirySecret, paymentSecret }) {
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = value => createHash("sha256").update(value).digest("hex");
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (url, body, overrides = {}) => request(url, { method: "POST", headers: { ...headers, ...overrides }, body: JSON.stringify(body) });
  async function ok(response, code = 200) { const r = await response; assert.equal(r.status, code, await r.clone().text()); return r.json(); }
  async function fixture(label, due = false) {
    const id = hash("lifecycle-" + label).slice(0,32), variantId = hash(label + "variant"), locationId = hash(label + "location"), token = hash(label + "token");
    const stock = c("stockBalances").doc(hash(variantId + ":" + locationId)), order = c("storeOrders").doc(id);
    await c("stockLocations").doc(locationId).set({ businessId: "sadboi", input: { name: "Test studio " + label, status: "active", onlineEligible: true }, revision: 1, onHandUnits: 10, incomingUnits: 0, outgoingUnits: 0 });
    await stock.set({ businessId: "sadboi", variantId, locationId, onHand: 10, allocated: 4, reserved: 1, unavailable: 1, revision: 1 });
    const lines = [{ variantId, quantity: 2, allocations: [{ locationId, quantity: 2 }], fulfillment: "stocked", sku: "TEST-" + label, name: "Print", productTitle: "Emulator art", unitCostMinor: 2500 }];
    await order.set({ businessId: "sadboi", orderNumber: "LIFECYCLE-" + label, status: "pending_payment", totalMinor: 5000, allocationState: "held", lifecycleRevision: 0,
      managementTokenHash: hash(token), expiresAt: new Date(Date.now() + (due ? -60000 : 1800000)).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lines,
      input: { customerName: "Lifecycle Buyer", customerEmail: "lifecycle@example.test", notes: "Disposable emulator fixture", fulfillmentMethod: "pickup", lines: [{ variantId, quantity: 2 }] } });
    return { id, token, order, stock, locationId, cancel: { orderId: id, operationId: randomUUID(), reason: "Customer changed their plans" } };
  }
  const cancel = f => post("/api/store/order-cancel", f.cancel);
  const access = (f, changes = {}) => post("/api/store/order-access/" + f.id, { token: f.token, action: "status", ...changes });
  const start = f => post("/api/store/checkout", { orderId: f.id, token: f.token });
  const review = body => post("/api/store/payment-review", body);
  const sdk = new Stripe("sk_test_fixture");
  const webhook = async (s, eventId = "evt_" + randomUUID().replaceAll("-", ""), type = "checkout.session.completed", changes = {}) => {
    const payload = JSON.stringify({ id: eventId, object: "event", type, livemode: false, data: { object: s }, ...changes });
    return request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": sdk.webhooks.generateTestHeaderString({ payload, secret: stripe.secret }) }, body: payload });
  };
  const accountant = await identity("lifecycle-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accountant));
  const f = await fixture("cancel");
  for (const cookie of [legalCookie, accountingCookie]) {
    for (const url of ["/api/store/order-cancel", "/api/store/order-expiry", "/api/store/payment-review"]) assert.equal((await post(url, f.cancel, { Cookie: cookie + "; " + proof.cookie })).status, 403);
  }
  assert.equal((await access(f, { token: "a".repeat(64) })).status,404);
  const publicData = await ok(access(f)); assert.equal(publicData.totalMinor, 5000); assert.equal(publicData.input, undefined); assert.equal(publicData.managementTokenHash, undefined);
  assert.equal((await post("/api/store/order-cancel", f.cancel, { Origin: "https://attacker.example" })).status,403);
  const closed = await ok(cancel(f)); assert.equal(closed.status, "cancelled");
  assert.deepEqual(await ok(cancel(f)),closed); assert.equal((await f.stock.get()).data().allocated,2); assert.equal((await f.stock.get()).data().onHand,10);
  assert.equal((await post("/api/store/order-cancel", {...f.cancel, reason: "Different reason"})).status,409);
  check("pending cancellation enforces roles, CSRF and private access, releases exact stock, and recovers retries");
  const corrupt = await fixture("corrupt",true); await corrupt.stock.update({ allocated: 1 });
  assert.equal((await cancel(corrupt)).status,409); assert.equal((await corrupt.order.get()).data().status,"pending_payment");
  const due = await fixture("due",true), future = await fixture("future"), legacy = await fixture("legacy"); await legacy.order.update({ expiresAt: null });
  assert.equal((await request("/api/cron/order-expiry", {method:"POST",body:"{}"})).status,401);
  const sweep = await ok(request("/api/cron/order-expiry", {method:"POST",headers:{Authorization:"Bearer " + expirySecret},body:"{}"}));
  assert.ok(sweep.results.some(r => r.id===corrupt.id && r.status==="order-stock-review"));
  assert.equal((await due.order.get()).data().status,"expired"); assert.equal((await due.stock.get()).data().allocated,2);
  assert.equal((await future.order.get()).data().status,"pending_payment"); assert.equal((await legacy.order.get()).data().status,"pending_payment");
  check("scheduler authentication, deadline enforcement, legacy holds, and corrupt allocation rollback");
  const pay = await fixture("pay"), count = stripe.creates();
  const [checkout1, checkout2] = await Promise.all([ok(start(pay)),ok(start(pay))]); assert.deepEqual(checkout1,checkout2); assert.equal(stripe.creates(),count+1);
  const prepared = (await pay.order.get()).data(), s = stripe.pay(prepared.stripeCheckout.sessionId);
  assert.equal(s.amount_total,5000); assert.equal(s.metadata.accountId,stripe.accountId);
  assert.equal((await request(`/api/stripe/webhook/${stripe.accountId}`, {method:"POST",headers:{"Stripe-Signature":"invalid"},body:"{}"})).status,400);
  assert.equal((await webhook(s,undefined,undefined,{livemode:true})).status,400);
  assert.equal((await post(`/api/store/orders/${pay.id}/payment-confirmation`, {eventId:"evt_fake_raw",orderId:pay.id,provider:"stripe",paymentId:"pi_fake",amountMinor:5000,currency:"USD",status:"succeeded"},{"x-sadboi-payment-secret":paymentSecret})).status,403);
  const evt = "evt_success_fixture"; assert.equal((await ok(webhook(s,evt))).outcome,"applied"); assert.equal((await ok(webhook(s,evt))).duplicate,true);
  assert.equal((await pay.order.get()).data().status,"paid"); assert.equal((await cancel(pay)).status,409); assert.equal((await pay.stock.get()).data().allocated,4);
  check("Stripe session idempotency, server pricing, account binding, signatures, test mode and verified payment confirmation");
  const recovered = await fixture("missing-webhook"); await ok(start(recovered));
  const recoveredId = (await recovered.order.get()).data().stripeCheckout.sessionId;
  assert.equal((await ok(access(recovered))).status, "pending_payment");
  stripe.sessions.get(recoveredId).status = "complete";
  const processing = await ok(access(recovered));
  assert.equal(processing.status, "pending_payment"); assert.equal(processing.checkoutState, "processing");
  assert.equal((await access(recovered, { action: "cancel", operationId: randomUUID() })).status, 409);
  const recoveredSession = stripe.pay(recoveredId), readsBefore = stripe.reads();
  assert.equal((await access(recovered, { token: "0".repeat(64) })).status, 404);
  assert.equal(stripe.reads(), readsBefore);
  const results = await Promise.all([ok(access(recovered)), ok(access(recovered))]);
  for (const result of results) { assert.equal(result.status, "paid"); assert.equal(result.checkoutState, "paid"); }
  const receipts = await c("storePaymentEvents").where("input.orderId", "==", recovered.id).get();
  assert.equal(receipts.size, 1); assert.equal(receipts.docs[0].data().verification, "stripe_lookup");
  assert.equal((await ok(webhook(recoveredSession, "evt_after_lookup"))).reason, "already_paid");
  assert.equal((await recovered.stock.get()).data().allocated, 4); assert.equal((await recovered.stock.get()).data().onHand, 10);
  assert.equal((await recovered.order.get()).data().paymentReviewRequired, undefined);
  check("missed webhook recovers from canonical Stripe status; private access, duplicate refreshes and later webhooks preserve one stock outcome");
  const lookupRace = await fixture("lookup-webhook-race"); await ok(start(lookupRace));
  const raceSession = stripe.pay((await lookupRace.order.get()).data().stripeCheckout.sessionId);
  await Promise.all([ok(access(lookupRace)), ok(webhook(raceSession, "evt_lookup_race"))]);
  assert.equal((await lookupRace.order.get()).data().status, "paid");
  assert.equal((await lookupRace.order.get()).data().paymentReviewRequired, undefined);
  assert.equal((await lookupRace.stock.get()).data().allocated, 4);
  const mismatch = await fixture("lookup-mismatch"); await ok(start(mismatch));
  const mismatchSession = stripe.pay((await mismatch.order.get()).data().stripeCheckout.sessionId);
  for (const [key, value] of [["amount_total", 1], ["client_reference_id", recovered.id], ["livemode", true], ["currency", "eur"], ["metadata", { ...mismatchSession.metadata, accountId: "acct_other" }]]) {
    const previous = mismatchSession[key]; mismatchSession[key] = value;
    assert.equal((await ok(access(mismatch))).checkoutState, "unavailable");
    assert.equal((await mismatch.order.get()).data().status, "pending_payment");
    mismatchSession[key] = previous;
  }
  stripe.setUnavailable(true);
  try {
    assert.equal((await ok(access(mismatch))).checkoutState, "unavailable");
    assert.equal((await access(mismatch, { action: "cancel", operationId: randomUUID() })).status, 409);
    assert.equal((await mismatch.stock.get()).data().allocated, 4);
  } finally { stripe.setUnavailable(false); }
  assert.equal((await ok(access(mismatch))).status, "paid");
  check("webhook/lookup races are idempotent; mismatched Sessions and outages cannot confirm payment or cancel an uncertain payment");
  const lookupLate = await fixture("lookup-late"); await ok(start(lookupLate));
  stripe.pay((await lookupLate.order.get()).data().stripeCheckout.sessionId);
  await lookupLate.order.update({ expiresAt: new Date(Date.now() - 1).toISOString() });
  const lateLookup = await ok(access(lookupLate));
  assert.equal(lateLookup.status, "expired"); assert.equal(lateLookup.paymentReviewRequired, true); assert.equal(lateLookup.checkoutState, "paid");
  await ok(access(lookupLate)); assert.equal((await lookupLate.stock.get()).data().allocated, 2);
  check("payment discovered after the deadline enters review, releases the expired hold once, and never reopens stock automatically");
  const late = await fixture("late"); await ok(start(late)); const lateId=(await late.order.get()).data().stripeCheckout.sessionId;
  await ok(cancel(late)); const lateSession=stripe.pay(lateId), lateEvent="evt_late_fixture";
  assert.equal((await ok(webhook(lateSession,lateEvent))).reason,"late_success");
  assert.equal((await late.order.get()).data().status,"cancelled"); assert.equal((await late.order.get()).data().paymentReviewRequired,true);
  const resolution={ orderId:late.id, eventId:`stripe:${stripe.accountId}:test:${lateEvent}`, expectedRevision:0, operationId:randomUUID(), action:"accept_payment", reference:"", notes:"Customer confirmed they still want the print." };
  await late.stock.update({onHand:4}); assert.equal((await review(resolution)).status,409); assert.equal((await late.stock.get()).data().allocated,2);
  await late.stock.update({onHand:10}); assert.equal((await ok(review(resolution))).status,"paid");
  await ok(review(resolution)); assert.equal((await late.stock.get()).data().allocated,4); assert.equal((await late.order.get()).data().paymentReviewRequired,false);
  assert.equal((await late.order.get()).data().stripeExpiryPending,false);
  assert.equal((await review({...resolution,operationId:randomUUID()})).status,409);
  assert.equal((await review({...resolution,notes:"Changed retry details"})).status,409);
  check("late-payment acceptance verifies Stripe, rejects shortages and stale reviews, reserves stock atomically, and recovers retries");
  const refund=await fixture("refund"); await ok(start(refund)); await ok(cancel(refund)); const rs=stripe.pay((await refund.order.get()).data().stripeCheckout.sessionId);
  await ok(webhook(rs,"evt_refund_fixture"));
  const refundBody={...resolution,orderId:refund.id,eventId:`stripe:${stripe.accountId}:test:evt_refund_fixture`,operationId:randomUUID(),action:"record_refund",reference:"re_fixture",notes:"Completed the full refund in the Stripe test dashboard."};
  stripe.refunds.set("re_fixture",{id:"re_fixture",status:"pending",amount:5000,currency:"usd",payment_intent:rs.payment_intent});
  assert.equal((await review(refundBody)).status,409);
  stripe.refunds.get("re_fixture").status="succeeded"; await ok(review(refundBody)); await ok(review(refundBody));
  assert.equal((await refund.order.get()).data().paymentReviewRequired,false); assert.equal((await refund.order.get()).data().status,"cancelled"); assert.equal((await refund.stock.get()).data().allocated,2);
  assert.equal((await ok(webhook(rs,"evt_after_refund"))).reason,"refunded_payment");
  check("completed full refunds are verified and audited, flags clear, and refunded payment events cannot reopen orders");
  const expiring = await fixture("stripe-expire"); await ok(start(expiring)); const sessionId=(await expiring.order.get()).data().stripeCheckout.sessionId;
  await expiring.order.update({expiresAt:new Date(Date.now()-60000).toISOString()}); await ok(post("/api/store/order-expiry",{}));
  assert.equal(stripe.sessions.get(sessionId).status,"expired"); assert.equal((await expiring.order.get()).data().stripeExpiryPending,false);
  assert.equal((await start(expiring)).status,409);
  const customer=await fixture("customer"); const body={action:"cancel",operationId:randomUUID()};
  await ok(access(customer,body)); await ok(access(customer,body)); assert.equal((await customer.stock.get()).data().allocated,2);
  check("worker closes remote checkout and private customer cancellation releases stock only once");
  const racing = await fixture("payment-cancel-race"); await ok(start(racing));
  const racingSession = stripe.pay((await racing.order.get()).data().stripeCheckout.sessionId);
  const [cancelResponse,paymentResponse] = await Promise.all([cancel(racing),webhook(racingSession,"evt_cancel_race")]);
  const racePayment = await ok(paymentResponse), raceOrder = (await racing.order.get()).data();
  if (raceOrder.status === "paid") {
    assert.equal(cancelResponse.status,409); assert.equal(racePayment.outcome,"applied"); assert.equal((await racing.stock.get()).data().allocated,4);
  } else {
    assert.equal(cancelResponse.status,200); assert.equal(raceOrder.status,"cancelled"); assert.equal(racePayment.outcome,"review"); assert.equal((await racing.stock.get()).data().allocated,2);
  }
  const boundary = await fixture("deadline-payment"); await ok(start(boundary));
  await boundary.order.update({expiresAt:new Date(Date.now()-1).toISOString()});
  const boundaryPayment = stripe.pay((await boundary.order.get()).data().stripeCheckout.sessionId);
  assert.equal((await ok(webhook(boundaryPayment,"evt_deadline_payment"))).reason,"late_success");
  assert.equal((await boundary.order.get()).data().status,"pending_payment");
  const boundaryResolution = { ...refundBody, orderId:boundary.id, eventId:`stripe:${stripe.accountId}:test:evt_deadline_payment`, operationId:randomUUID(), reference:"re_boundary" };
  stripe.refunds.set("re_boundary",{id:"re_boundary",status:"succeeded",amount:5000,currency:"usd",payment_intent:boundaryPayment.payment_intent});
  await ok(review(boundaryResolution));
  assert.equal((await ok(webhook(boundaryPayment,"evt_refunded_before_expiry_sweep"))).reason,"refunded_payment");
  assert.equal((await boundary.order.get()).data().paymentReviewRequired,false);
  await ok(access(boundary)); assert.equal((await boundary.order.get()).data().status,"expired");
  check("concurrent payment/cancellation has one stock outcome and deadline enforcement does not depend on the scheduled worker");
  if (process.argv.includes("--lifecycle-preview")) {
    const preview = await fixture("browser-pending"), browserLate = await fixture("browser-late");
    const browserReturn = await fixture("browser-return"); await ok(start(browserReturn));
    stripe.pay((await browserReturn.order.get()).data().stripeCheckout.sessionId);
    await ok(start(browserLate)); await ok(cancel(browserLate));
    await ok(webhook(stripe.pay((await browserLate.order.get()).data().stripeCheckout.sessionId), "evt_browser_late"));
    const marker = "web-app/.next-auth-test/lifecycle-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/lifecycle-preview.ready", JSON.stringify({ url:origin+"/orders/"+preview.id+"#"+preview.token, returnUrl:origin+"/orders/"+browserReturn.id+"?checkout=returned#"+browserReturn.token }));
    console.log("Lifecycle browser preview ready at " + origin + "/admin/orders");
    for (let i=0;i<1200;i++) { try { await fileAccess(marker); break; } catch {} await delay(500); }
  }
}
