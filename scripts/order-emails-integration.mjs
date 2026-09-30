import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { access, writeFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import path from "node:path";

export async function orderEmailChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, paymentSecret, expirySecret, email, stripe }) {
  const c = name => db.collection(`businesses/sadboi/${name}`), hash = s => createHash("sha256").update(s).digest("hex");
  const productId = hash("email-product"), variantId = hash("email-variant");
  await c("products").doc(productId).set({ input: { title: 'Test <script>alert("x")</script> print', status: "active", publication: "public" } });
  await c("productVariants").doc(variantId).set({ input: { productId, sku: "EMAIL-TEST", name: "A&B print", size: "", color: "", material: "", finish: "", priceMinor: 3000, currency: "USD", weightGrams: null, fulfillment: "made_to_order", status: "active", publication: "public" } });
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (url, body, extra = {}) => request(url, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (result, code = 200) => { const r = await result; assert.equal(r.status, code, await r.clone().text()); return r.json(); };
  const input = { customerName: "Email Test Buyer", customerEmail: "email-test@example.test", notes: "Disposable emulator email test", fulfillmentMethod: "pickup", lines: [{ variantId, quantity: 1 }] };
  async function create(extra = {}) { return ok(post("/api/store/orders", { operationId: randomUUID(), input: { ...input, ...extra } }), 201); }
  const history = id => ok(request(`/api/store/order-emails?orderId=${id}`, { headers: { Cookie: ownerCookie } }));
  const processEmails = id => ok(post("/api/store/order-emails", { action: "process", orderId: id }));
  const queue = (id, kind = "order_received") => c("orderEmails").doc(`${id}_${kind}`);
  const due = ref => ref.update({ nextAttemptAt: new Date(Date.now() - 1000).toISOString(), leaseUntil: null });
  const creation = { operationId: randomUUID(), input };
  const [first, again] = await Promise.all([ok(post("/api/store/orders", creation), 201), ok(post("/api/store/orders", creation), 201)]);
  assert.deepEqual(first, again);
  assert.equal((await c("orderEmails").where("orderId", "==", first.id).get()).size, 1);
  const pay = { orderId: first.id, eventId: "evt_email_paid", provider: "stripe", paymentId: "pi_email_paid", amountMinor: 3000, currency: "USD", status: "succeeded" };
  await Promise.all([ok(post(`/api/store/orders/${first.id}/payment-confirmation`, pay, { "x-sadboi-payment-secret": paymentSecret })), ok(post(`/api/store/orders/${first.id}/payment-confirmation`, { ...pay, eventId: "evt_email_paid_other" }, { "x-sadboi-payment-secret": paymentSecret }))]);
  assert.equal((await c("orderEmails").where("orderId", "==", first.id).get()).size, 2);
  check("order creation and competing payment events queue one email per event type atomically");
  const privateHistory = await history(first.id);
  assert.ok(!JSON.stringify(privateHistory).includes(first.managementToken)); assert.ok(!JSON.stringify(privateHistory).includes("accessOperationId"));
  assert.match(privateHistory.emails[0].preview, /Private order link/);
  assert.equal((await request(`/api/store/order-emails?orderId=${first.id}`)).status, 401);
  assert.equal((await request(`/api/store/order-emails?orderId=${first.id}`, { headers: { Cookie: legalCookie } })).status, 403);
  const accountant = await identity("email-accounting@example.test", true, "accounting"), accountantCookie = session(await signIn(accountant));
  assert.equal((await request(`/api/store/order-emails?orderId=${first.id}`, { headers: { Cookie: accountantCookie } })).status, 200);
  assert.equal((await post("/api/store/order-emails", { action: "process", orderId: first.id }, { Cookie: accountantCookie + "; " + proof.cookie })).status, 403);
  assert.equal((await post("/api/store/order-emails", { action: "process", orderId: first.id }, { Origin: "https://attacker.example" })).status, 403);
  check("email history hides capabilities, enforces staff roles, and protects sending with CSRF");
  const { fulfillmentEmailChecks } = await import("./fulfillment-emails-integration.mjs");
  const previewOrders = await fulfillmentEmailChecks({ create, post, ok, history, processEmails, c, check, email, paymentSecret });
  if (!email) {
    assert.equal(privateHistory.configuration, "disabled"); assert.ok(privateHistory.emails.every(item => item.status === "disabled"));
    assert.equal((await processEmails(first.id)).status, "disabled");
    assert.ok((await c("orderEmails").where("orderId", "==", first.id).get()).docs.every(doc => doc.data().attempts === 0 && !doc.data().active));
    check("disabled mode creates previews without sending, scheduling or later automatic activation");
    return;
  }
  await Promise.all([processEmails(first.id), processEmails(first.id)]);
  for (const kind of ["order_received", "payment_confirmed"]) {
    const row = (await queue(first.id, kind).get()).data(); assert.equal(row.status, "accepted"); assert.equal(row.attempts, 1);
    const saved = email.messages.get(`sadboi-order-email/${first.id}_${kind}`); assert.ok(saved);
    assert.ok(!saved.payload.html.includes("<script>")); assert.match(saved.payload.subject, /^\[TEST\]/);
    const link = saved.payload.text.match(/http[^\s]+\/orders\/[^\s]+/)[0];
    const url = new URL(link); assert.equal(url.origin, origin); assert.equal(url.hash.slice(1), first.managementToken);
    const freshProof = await csrf();
    const guest = { "Content-Type": "application/json", Origin: origin, Cookie: freshProof.cookie, "X-CSRF-Token": freshProof.token };
    const result = await ok(post(`/api/store/order-access/${first.id}`, { action: "status", token: url.hash.slice(1) }, guest));
    assert.equal(result.status, "paid");
    assert.equal((await post(`/api/store/order-access/${first.id}`, { action: "status", token: "0".repeat(64) }, guest)).status, 404);
  }
  await processEmails(first.id); assert.equal((await queue(first.id).get()).data().attempts, 1);
  check("parallel workers submit once; private email links authorize a new guest session without exposing HTML or allowing forged access");
  const lost = await create(); email.setMode("lost-response"); await processEmails(lost.id);
  assert.equal((await queue(lost.id).get()).data().status, "retry");
  const acceptedCount = email.messages.size, originalPayload = email.messages.get(`sadboi-order-email/${lost.id}_order_received`).payload;
  await due(queue(lost.id)); email.setMode("ok"); await processEmails(lost.id);
  assert.equal(email.messages.size, acceptedCount); assert.equal((await queue(lost.id).get()).data().status, "accepted");
  assert.deepEqual(email.calls.at(-1).payload, originalPayload);
  check("lost provider acceptance response retries identical content and key without duplicate email");
  const crash = await create(); await queue(crash.id).update({ status: "sending", leaseId: "crashed-worker", leaseUntil: new Date(Date.now() + 60000).toISOString() });
  const count = email.calls.length; await processEmails(crash.id); assert.equal(email.calls.length, count);
  await due(queue(crash.id)); await processEmails(crash.id); assert.equal((await queue(crash.id).get()).data().status, "accepted");
  const old = await create(); await queue(old.id).update({ status: "retry", attempts: 1, firstAttemptAt: new Date(Date.now() - 23 * 3600000).toISOString() });
  const beforeOld = email.calls.length; await processEmails(old.id); assert.equal(email.calls.length, beforeOld); assert.equal((await queue(old.id).get()).data().status, "needs_review");
  check("leases prevent competing sends, crashed workers recover, and old uncertain sends stop before deduplication expires");
  const outside = await create({ customerEmail: "not-approved@example.test" }); const beforeOutside = email.calls.length;
  await processEmails(outside.id); assert.equal(email.calls.length, beforeOutside); assert.equal((await queue(outside.id).get()).data().lastError, "recipient_not_approved");
  const rejected = await create(); email.setMode("rejected"); await processEmails(rejected.id);
  const rejectedRow = (await queue(rejected.id).get()).data(); assert.equal(rejectedRow.status, "failed");
  email.setMode("ok");
  const retry = { action: "retry", orderId: rejected.id, id: queue(rejected.id).id, expectedRevision: rejectedRow.revision };
  await ok(post("/api/store/order-emails", retry)); assert.equal((await queue(rejected.id).get()).data().status, "accepted");
  assert.equal((await post("/api/store/order-emails", retry)).status, 409);
  check("unapproved recipients never reach the provider and staff retries are revision-protected");
  const corrupt = await create(); await c("storeOrderOperations").doc((await c("storeOrders").doc(corrupt.id).get()).data().emailAccessOperationId).update({ "result.managementToken": "0".repeat(64) });
  await processEmails(corrupt.id); assert.equal((await queue(corrupt.id).get()).data().status, "needs_review");
  check("invalid stored order capabilities stop email delivery without changing the order");
  const outage = await create(); email.setMode("outage"); await processEmails(outage.id);
  const outageRow = (await queue(outage.id).get()).data(); assert.equal(outageRow.status, "retry"); assert.ok(Date.parse(outageRow.nextAttemptAt) > Date.now());
  assert.equal((await c("storeOrders").doc(outage.id).get()).data().status, "pending_payment"); email.setMode("ok");
  assert.equal((await request("/api/cron/order-expiry", { method: "POST" })).status, 401);
  const sweep = await ok(request("/api/cron/order-expiry", { method: "POST", headers: { Authorization: "Bearer " + expirySecret } }));
  assert.equal(sweep.email.status, "checked");
  check("provider outages retain retry state without reversing orders; authenticated scheduler includes email work");
  if (stripe) {
    const late = await create();
    await ok(post("/api/store/checkout", { orderId: late.id, token: late.managementToken }));
    await ok(post("/api/store/order-cancel", { orderId: late.id, operationId: randomUUID(), reason: "Emulator late-payment email test" }));
    const checkout = stripe.pay((await c("storeOrders").doc(late.id).get()).data().stripeCheckout.sessionId);
    const Stripe = createRequire(path.join(process.cwd(), "web-app/package.json"))("stripe");
    const eventId = "evt_email_late", payload = JSON.stringify({ id: eventId, object: "event", type: "checkout.session.completed", livemode: false, data: { object: checkout } });
    const signature = new Stripe("sk_test_fixture").webhooks.generateTestHeaderString({ payload, secret: stripe.secret });
    await ok(request(`/api/stripe/webhook/${stripe.accountId}`, { method: "POST", headers: { "Stripe-Signature": signature, "Content-Type": "application/json" }, body: payload }));
    assert.equal((await queue(late.id, "payment_confirmed").get()).exists, false);
    const resolution = { orderId: late.id, eventId: `stripe:${stripe.accountId}:test:${eventId}`, expectedRevision: 0, operationId: randomUUID(), action: "accept_payment", reference: "", notes: "Verified disposable test payment accepted" };
    await ok(post("/api/store/payment-review", resolution)); await ok(post("/api/store/payment-review", resolution));
    assert.equal((await queue(late.id, "payment_confirmed").get()).exists, true);
    assert.equal((await c("orderEmails").where("orderId", "==", late.id).get()).size, 2);
    check("late payment queues no confirmation until verified staff acceptance; resolution replay creates no duplicate");
  }
  if (process.argv.includes("--email-preview")) {
    const marker = "web-app/.next-auth-test/email-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/email-preview.ready", JSON.stringify({ orderId: first.id, url: `${origin}/orders/${first.id}#${first.managementToken}`, fulfillment: previewOrders }));
    console.log("Email browser preview ready at " + origin + "/admin/orders");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
