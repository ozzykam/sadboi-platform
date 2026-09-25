import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile, access, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function storePaymentChecks({ request, csrf, db, check, origin, ownerCookie, legalCookie, identity, signIn, session, paymentSecret }) {
  const collection = name => db.collection(`businesses/sadboi/${name}`);
  const hash = label => createHash("sha256").update(label).digest("hex");
  const event = (orderId, changes = {}) => ({ eventId: "evt_" + randomUUID(), orderId, provider: "stripe", paymentId: "pi_" + orderId, amountMinor: 5000, currency: "USD", status: "succeeded", ...changes });
  const post = (input, extra = {}) => request(`/api/store/orders/${input.orderId}/payment-confirmation`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-sadboi-payment-secret": paymentSecret, ...extra }, body: JSON.stringify(input),
  });
  async function accepted(input) { const response = await post(input); assert.equal(response.status, 200, await response.clone().text()); return response.json(); }
  const data = async id => (await collection("storeOrders").doc(id).get()).data();
  const events = async id => (await collection("storePaymentEvents").where("input.orderId", "==", id).get()).docs.map(doc => doc.data());
  async function fixture(label, overrides = {}) {
    const orderId = hash("payment-order-" + label).slice(0, 32), variantId = hash("payment-made-" + label);
    await collection("storeOrders").doc(orderId).set({ businessId: "sadboi", orderNumber: "PAY-" + label, status: "pending_payment", totalMinor: 5000,
      input: { customerName: "Payment Test Buyer", customerEmail: "payment-buyer@example.test", notes: "Disposable emulator data", fulfillmentMethod: "pickup", lines: [{ variantId, quantity: 1 }] },
      lines: [{ variantId, quantity: 1, sku: "PAYMENT-PRINT", name: "Test print", productTitle: "Test art", fulfillment: "made_to_order", allocations: [], unitCostMinor: 5000 }],
      createdAt: "2026-09-25T14:00:00.000Z", updatedAt: "2026-09-25T14:00:00.000Z", ...overrides });
    return orderId;
  }
  const inventoryBefore = (await collection("stockBalances").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const id = await fixture("standard"), payload = event(id), before = await data(id);
  assert.equal((await post(payload, { "x-sadboi-payment-secret": "wrong" })).status, 401);
  assert.equal((await post(payload, { "x-sadboi-payment-secret": "" })).status, 401);
  assert.equal((await post(payload, { "Content-Type": "text/plain" })).status, 415);
  for (const body of ["{bad-json", "null", "[]", JSON.stringify({ ...payload, orderId: "b".repeat(32) })]) {
    const response = await request(`/api/store/orders/${id}/payment-confirmation`, { method: "POST", headers: { "Content-Type": "application/json", "x-sadboi-payment-secret": paymentSecret }, body });
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /SyntaxError|stack|private_key/);
  }
  for (const changes of [{ eventId: "../unsafe" }, { paymentId: "pi/unsafe" }, { currency: "EUR" }, { amountMinor: 0 }, { amountMinor: 1.5 }, { claimedPaid: true }])
    assert.equal((await post({ ...payload, ...changes })).status, 400);
  assert.equal((await post({ ...payload, notes: "x".repeat(33000) })).status, 413);
  assert.equal((await post(event("f".repeat(32)))).status, 404);
  const foreignId = await fixture("wrong-business", { businessId: "another-business" });
  assert.equal((await post(event(foreignId))).status, 404);
  assert.deepEqual(await data(id), before); assert.equal((await events(id)).length, 0);
  check("payment endpoint enforces its secret, JSON bounds, route identity, safe IDs, currency, and amount types");

  const failed = event(id, { status: "failed" });
  assert.equal((await accepted(failed)).reason, "payment_failed");
  assert.deepEqual(await data(id), before);
  const concurrent = await Promise.all([accepted(payload), accepted(payload)]);
  assert.equal(concurrent.filter(r => r.duplicate).length, 1);
  assert.equal(concurrent[0].outcome, "applied");
  const paid = await data(id);
  assert.equal(paid.status, "paid"); assert.equal(paid.paymentEventId, payload.eventId); assert.ok(paid.paidAt);
  const committedCount = (await events(id)).length;
  assert.equal((await accepted(payload)).duplicate, true);
  assert.equal((await events(id)).length, committedCount);
  assert.deepEqual(await data(id), paid);
  check("failed attempts preserve pending orders, concurrent exact successes apply once, and lost responses recover");

  for (const changes of [{ amountMinor: 4999 }, { status: "failed" }, { paymentId: "pi_changed" }])
    assert.equal((await post({ ...payload, ...changes })).status, 409);
  const otherId = await fixture("event-reuse");
  assert.equal((await post({ ...payload, orderId: otherId })).status, 409);
  assert.equal((await data(otherId)).status, "pending_payment");
  assert.deepEqual(await data(id), paid);
  check("reused event IDs reject changed amounts, status, payment identity, and order identity");

  assert.equal((await accepted(event(id, { status: "failed" }))).reason, "late_failure");
  assert.equal((await accepted(event(id, { status: "failed", paymentId: "pi_another_failed" }))).reason, "late_failure");
  assert.equal((await accepted(event(id))).reason, "already_paid");
  assert.deepEqual(await data(id), paid);
  check("late failed events and repeated successful reports never overwrite the paid state or payment reference");

  const proof = await csrf();
  const staffHeaders = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  for (const [status, expectedRevision] of [["packed", 0], ["delivered", 1]]) {
    const response = await request("/api/store/fulfillment", { method: "POST", headers: staffHeaders, body: JSON.stringify({ operationId: randomUUID(), expectedRevision, input: {
      orderId: id, recipientName: "Payment Test Buyer", address1: "", address2: "", city: "", region: "", postalCode: "", country: "US", method: "pickup", trackingNumber: "", status, notes: "Payment integration test",
    } }) });
    assert.equal(response.status, 201, await response.clone().text());
  }
  const fulfilled = await data(id), fulfillmentBefore = (await collection("fulfillments").doc(id).get()).data();
  assert.equal((await accepted(event(id, { status: "failed" }))).reason, "late_failure");
  assert.equal((await accepted(event(id))).reason, "already_paid");
  assert.equal((await accepted(payload)).orderStatus, "paid"); // Immutable original result, not current status.
  assert.deepEqual(await data(id), fulfilled);
  assert.deepEqual((await collection("fulfillments").doc(id).get()).data(), fulfillmentBefore);
  check("payment confirmation connects to fulfillment and cannot regress a completed order");

  const extra = event(id, { paymentId: "pi_second_success" });
  assert.equal((await accepted(extra)).reason, "additional_payment");
  const extraState = await data(id);
  assert.equal(extraState.status, "fulfilled"); assert.equal(extraState.paymentId, payload.paymentId); assert.equal(extraState.paymentReviewRequired, true);
  assert.equal((await accepted(extra)).duplicate, true);
  assert.deepEqual(await data(id), extraState);
  const mismatchId = await fixture("amount-review"), mismatch = event(mismatchId, { amountMinor: 4999 });
  assert.equal((await accepted(mismatch)).reason, "amount_mismatch");
  assert.equal((await data(mismatchId)).status, "pending_payment");
  assert.equal((await data(mismatchId)).paymentReviewRequired, true);
  const cancelledId = await fixture("cancelled", { status: "cancelled" });
  assert.equal((await accepted(event(cancelledId, { status: "failed" }))).reason, "late_failure");
  assert.equal((await accepted(event(cancelledId))).reason, "late_success");
  assert.equal((await data(cancelledId)).status, "cancelled");
  check("extra payments, amount mismatches, and success after cancellation are recorded for review without reopening orders");

  const first = await fixture("identity-first"), second = await fixture("identity-second"), sharedPayment = "pi_shared_race";
  const identityRace = await Promise.all([accepted(event(first, { paymentId: sharedPayment })), accepted(event(second, { paymentId: sharedPayment }))]);
  assert.deepEqual(identityRace.map(r => r.outcome).sort(), ["applied", "review"]);
  assert.deepEqual([(await data(first)).status, (await data(second)).status].sort(), ["paid", "pending_payment"]);
  check("concurrent attempts to reuse a provider payment across two orders pay only one order");

  const competingId = await fixture("two-payments");
  const twoPayments = await Promise.all([accepted(event(competingId, { paymentId: "pi_race_one" })), accepted(event(competingId, { paymentId: "pi_race_two" }))]);
  assert.deepEqual(twoPayments.map(r => r.outcome).sort(), ["applied", "review"]);
  const orderingId = await fixture("ordering");
  const ordering = await Promise.all([accepted(event(orderingId)), accepted(event(orderingId, { status: "failed" }))]);
  assert.equal(ordering.filter(r => r.outcome === "applied").length, 1);
  assert.equal((await data(orderingId)).status, "paid");
  check("competing payment successes surface duplicates and concurrent success/failure always finish paid");

  const historicalId = await fixture("legacy-paid", { status: "paid", paymentId: "pi_legacy", paymentProvider: "stripe", paymentEventId: "evt_legacy_success" });
  const legacyEvent = event(historicalId, { eventId: "evt_legacy_success", paymentId: "pi_legacy" });
  await collection("storePaymentEvents").doc(legacyEvent.eventId).set({ input: legacyEvent, status: "succeeded", createdAt: "2026-09-20T12:00:00.000Z" });
  const historicalBefore = await data(historicalId);
  const legacyReplay = await accepted(legacyEvent);
  assert.equal(legacyReplay.outcome, "legacy"); assert.equal(legacyReplay.duplicate, true);
  assert.equal((await post({ ...legacyEvent, amountMinor: 4999 })).status, 409);
  assert.equal((await accepted(event(historicalId, { status: "failed", paymentId: "pi_legacy" }))).reason, "late_failure");
  assert.deepEqual(await data(historicalId), historicalBefore);
  const reuseLegacy = await fixture("legacy-reuse");
  assert.equal((await accepted(event(reuseLegacy, { paymentId: "pi_legacy" }))).reason, "payment_identity_conflict");
  const regressedId = await fixture("legacy-regressed", { paymentId: "pi_old_failed", paymentEventId: "evt_old_failed", paymentProvider: "stripe" });
  assert.equal((await accepted(event(regressedId))).reason, "legacy_payment");
  assert.equal((await data(regressedId)).status, "pending_payment");
  const missingAnchorId = await fixture("legacy-missing-anchor");
  const oldSuccess = event(missingAnchorId, { eventId: "evt_missing_anchor_old" });
  await collection("storePaymentEvents").doc(oldSuccess.eventId).set({ input: oldSuccess, status: "succeeded", createdAt: "2026-09-20T12:00:00.000Z" });
  assert.equal((await accepted(event(missingAnchorId, { status: "failed" }))).reason, "payment_identity_conflict");
  assert.equal((await data(missingAnchorId)).status, "pending_payment");
  check("historical event replays remain read-only, legacy payment identities cannot be reused, and regressed history needs review");

  const corruptId = await fixture("corrupt-order", { status: "unexpected" });
  assert.equal((await accepted(event(corruptId))).reason, "invalid_order_state");
  assert.equal((await data(corruptId)).status, "unexpected");
  const limitedId = await fixture("identity-limit");
  const batch = db.batch();
  for (let index = 0; index < 101; index++) batch.set(collection("storePaymentEvents").doc("evt_identity_limit_" + index), { input: event(limitedId, { eventId: "evt_identity_limit_" + index, paymentId: "pi_legacy_limit", status: "failed" }), status: "failed", createdAt: "2026-09-20T12:00:00.000Z" });
  await batch.commit();
  const limitedBefore = await data(limitedId);
  const serviceFailure = await post(event(limitedId, { paymentId: "pi_legacy_limit" }));
  assert.equal(serviceFailure.status, 503); assert.equal((await serviceFailure.json()).code, "payment-history-limit");
  assert.deepEqual(await data(limitedId), limitedBefore);
  assert.equal((await events(limitedId)).length, 101);
  check("unknown order states require review and bounded legacy lookup failures commit no partial events");

  const accounting = await identity("payment-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accounting));
  const historyPath = `/api/store/orders/${id}/payment-events`;
  assert.equal((await request(historyPath)).status, 401);
  assert.equal((await request(historyPath, { headers: { Cookie: legalCookie } })).status, 403);
  for (const cookie of [ownerCookie, accountingCookie]) {
    const response = await request(historyPath, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const history = (await response.json()).events;
    assert.ok(history.some(item => item.input.eventId === extra.eventId && item.outcome === "review"));
    assert.ok(history.some(item => item.reason === "late_failure"));
    assert.ok(history.every(item => !item.fingerprint && !item.secret));
  }
  const overLimitId = await fixture("history-limit"), historyBatch = db.batch();
  for (let index = 0; index < 201; index++) historyBatch.set(collection("storePaymentEvents").doc("evt_display_limit_" + index), { input: event(overLimitId, { eventId: "evt_display_limit_" + index }), status: "succeeded", createdAt: "2026-09-20T12:00:00.000Z" });
  await historyBatch.commit();
  const overLimit = await request(`/api/store/orders/${overLimitId}/payment-events`, { headers: { Cookie: ownerCookie } });
  assert.equal(overLimit.status, 503);
  assert.equal((await overLimit.json()).code, "payment-history-limit");
  const catalog = await request("/api/store/orders", { headers: { Cookie: ownerCookie } });
  assert.equal((await catalog.json()).orders.find(order => order.id === id).paymentReviewRequired, true);
  const help = await request("/admin/how-to", { headers: { Cookie: ownerCookie } });
  assert.match(await help.text(), /id="store-payments"/);
  assert.deepEqual((await collection("stockBalances").get()).docs.map(doc => ({ id: doc.id, ...doc.data() })), inventoryBefore);
  check("payment history is staff/accounting-only, review flags and help are visible, and payment events leave inventory unchanged");

  if (process.argv.includes("--payment-preview")) {
    const marker = "web-app/.next-auth-test/payment-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/payment-preview.ready", "ready");
    console.log("Payment preview ready: " + origin + "/admin/orders (owner@example.test / Emulator-password-123!)");
    for (let i = 0; i < 1200; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
