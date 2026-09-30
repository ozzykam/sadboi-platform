import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function fulfillmentEmailChecks({ create, post, ok, history, processEmails, c, check, email, paymentSecret }) {
  const rows = async id => (await c("orderEmails").where("orderId", "==", id).get()).docs;
  const notices = async id => (await rows(id)).filter(doc => doc.data().fulfillmentEvent);
  async function paid() {
    const order = await create();
    await ok(post(`/api/store/orders/${order.id}/payment-confirmation`, {
      orderId: order.id, eventId: "evt_" + randomUUID(), provider: "stripe", paymentId: "pi_" + randomUUID(), amountMinor: 3000, currency: "USD", status: "succeeded",
    }, { "x-sadboi-payment-secret": paymentSecret }));
    return order;
  }
  const details = id => ({ orderId: id, recipientName: "Email Test Buyer", address1: "123 Test Street", address2: "", city: "Test City", region: "IL", postalCode: "60601", country: "US", method: "pickup", status: "packed", trackingNumber: "", notes: "PRIVATE STAFF NOTES" });
  const body = (input, expectedRevision) => ({ input, expectedRevision, operationId: randomUUID() });
  const save = request => ok(post("/api/store/fulfillment", request), 201);
  const guest = order => ok(post(`/api/store/order-access/${order.id}`, { action: "status", token: order.managementToken }));
  async function drain(id) { for (let i = 0; i < 4; i++) await processEmails(id); }

  const pickup = await paid(), pickupInput = details(pickup.id), packed = body(pickupInput, 0);
  const responses = await Promise.all([save(packed), save(packed)]); assert.deepEqual(...responses);
  assert.equal((await notices(pickup.id)).length, 1);
  await save(body({ ...pickupInput, notes: "PRIVATE NOTES CHANGED" }, 1));
  assert.equal((await notices(pickup.id)).length, 1);
  const privateStatus = await guest(pickup);
  assert.equal(privateStatus.fulfillment.status, "packed"); assert.equal(privateStatus.fulfillment.method, "pickup");
  for (const secret of ["PRIVATE", "123 Test Street", "recipientName", "notificationRevision", "emailAccessOperationId"]) assert.ok(!JSON.stringify(privateStatus).includes(secret));
  assert.equal((await post(`/api/store/order-access/${pickup.id}`, { action: "status", token: "0".repeat(64) })).status, 404);
  const preview = (await history(pickup.id)).emails.find(row => row.kind === "pickup_ready");
  assert.match(preview.preview, /Confirm the pickup time and location/); assert.ok(!preview.preview.includes("PRIVATE STAFF"));
  assert.ok(!preview.preview.includes(pickup.managementToken));
  await drain(pickup.id);
  const pickupMessage = (await notices(pickup.id))[0].data();
  assert.equal(pickupMessage.status, email ? "accepted" : "disabled");
  if (email) assert.equal(pickupMessage.attempts, 1); else assert.equal(pickupMessage.attempts, 0);
  check("pickup readiness queues atomically once, note edits do not duplicate it, and private status exposes only customer-safe details");

  const shipping = await paid(), shippingInput = { ...details(shipping.id), method: "standard" };
  await save(body(shippingInput, 0)); assert.equal((await notices(shipping.id)).length, 0);
  const shipped = { ...shippingInput, status: "shipped", trackingNumber: "TRACK-OLD" };
  const dispatch = body(shipped, 1);
  await Promise.all([save(dispatch), save(dispatch)]);
  const corrected = { ...shipped, trackingNumber: '<img src=x onerror="x">TRACK-NEW' };
  await save(body(corrected, 2));
  const beforeStale = await notices(shipping.id);
  assert.equal(beforeStale.length, 2);
  assert.equal((await post("/api/store/fulfillment", body({ ...corrected, trackingNumber: "STALE" }, 2))).status, 409);
  assert.equal((await notices(shipping.id)).length, 2);
  assert.equal((await guest(shipping)).fulfillment.trackingNumber, corrected.trackingNumber);
  await drain(shipping.id);
  const initialShipping = (await notices(shipping.id)).find(row => row.data().kind === "order_shipped").data();
  const tracking = (await notices(shipping.id)).find(row => row.data().kind === "tracking_updated");
  assert.equal(initialShipping.status, email ? "superseded" : "disabled"); assert.equal(initialShipping.attempts, 0);
  assert.equal(tracking.data().status, email ? "accepted" : "disabled");
  if (email) {
    const sent = email.messages.get(`sadboi-order-email/${tracking.id}`).payload;
    assert.ok(sent.html.includes("&lt;img")); assert.ok(!sent.html.includes("<img")); assert.ok(!sent.text.includes("PRIVATE STAFF"));
    assert.ok(sent.text.includes(shipping.managementToken));
  }
  check("shipping and tracking corrections create distinct events; stale saves and obsolete unattempted shipping notices cannot send");

  const dispatched = await paid(), dispatchedInput = { ...details(dispatched.id), method: "standard" };
  await save(body(dispatchedInput, 0));
  await save(body({ ...dispatchedInput, status: "shipped" }, 1)); await drain(dispatched.id);
  const shipmentNotice = (await notices(dispatched.id))[0];
  assert.equal(shipmentNotice.data().status, email ? "accepted" : "disabled");
  if (email) assert.match(email.messages.get(`sadboi-order-email/${shipmentNotice.id}`).payload.text, /No tracking number/);
  await save(body({ ...dispatchedInput, status: "delivered" }, 2));
  const delivered = await guest(dispatched);
  assert.equal(delivered.status, "fulfilled"); assert.equal(delivered.fulfillment.status, "delivered");
  assert.equal((await notices(dispatched.id)).length, 1);
  check("shipment notices work without tracking, and delivery updates private status without inventing an extra email");

  for (const end of ["cancelled", "delivered", "method_changed"]) {
    const order = await paid(), input = details(order.id);
    await save(body(input, 0));
    const next = end === "method_changed" ? { ...input, method: "standard" } : { ...input, status: end };
    await save(body(next, 1)); await drain(order.id);
    const notice = (await notices(order.id))[0].data();
    assert.equal(notice.status, email ? "superseded" : "disabled"); assert.equal(notice.attempts, 0);
  }
  const unpaid = await create();
  assert.equal((await post("/api/store/fulfillment", body(details(unpaid.id), 0))).status, 409);
  assert.equal((await notices(unpaid.id)).length, 0);
  const historical = await paid(); await c("storeOrders").doc(historical.id).update({ emailAccessOperationId: null });
  await save(body(details(historical.id), 0)); assert.equal((await notices(historical.id)).length, 0);
  check("cancelled, collected and changed-method orders suppress unattempted readiness notices; unpaid and legacy orders create no fulfillment email");

  const competing = await paid(), competingInput = details(competing.id);
  const race = await Promise.all([post("/api/store/fulfillment", body(competingInput, 0)), post("/api/store/fulfillment", body({ ...competingInput, status: "cancelled" }, 0))]);
  assert.deepEqual(race.map(response => response.status).sort(), [201, 409]);
  const savedStatus = (await c("fulfillments").doc(competing.id).get()).data().input.status;
  assert.equal((await notices(competing.id)).length, savedStatus === "packed" ? 1 : 0);
  check("competing readiness and cancellation commit only the winning fulfillment and its matching notification");

  // History remains bounded and selects recent records, rather than silently
  // hiding tracking corrections behind older message IDs.
  const archive = await paid(), seed = (await rows(archive.id))[0].data();
  await Promise.all(Array.from({ length: 55 }, (_, i) => c("orderEmails").doc(`${archive.id}_tracking_updated_${i + 1}`).set({ ...seed,
    kind: "tracking_updated", status: "disabled", active: false, createdAt: new Date(Date.now() + (i + 1) * 1000).toISOString(),
  })));
  const recent = await history(archive.id);
  assert.equal(recent.emails.length, 50); assert.equal(recent.hasOlder, true);
  assert.ok(recent.emails.some(row => row.id === `${archive.id}_tracking_updated_55`));
  check("email history shows the most recent 50 records and signals retained older history");

  if (email) {
    // Process receipt/payment first so the simulated lost response belongs only to readiness.
    const uncertain = await paid(); await drain(uncertain.id);
    await save(body(details(uncertain.id), 0)); email.setMode("lost-response"); await processEmails(uncertain.id); email.setMode("ok");
    const message = (await notices(uncertain.id))[0], original = email.messages.get(`sadboi-order-email/${message.id}`).payload;
    assert.equal(message.data().status, "retry");
    await save(body({ ...details(uncertain.id), status: "delivered" }, 1));
    await message.ref.update({ nextAttemptAt: new Date(Date.now() - 1000).toISOString() });
    const count = email.messages.size; await processEmails(uncertain.id);
    assert.equal(email.messages.size, count); assert.deepEqual(email.calls.at(-1).payload, original);
    assert.equal((await message.ref.get()).data().status, "accepted");
    check("an uncertain fulfillment send retries its identical payload after collection without a duplicate or unsafe suppression");

    await save(body({ ...corrected, trackingNumber: "" }, 3));
    email.setMode("rejected"); await drain(shipping.id); email.setMode("ok");
    const rejected = (await notices(shipping.id)).find(doc => doc.data().fulfillmentEvent.revision === 4);
    assert.equal(rejected.data().status, "failed");
    const retry = { action: "retry", orderId: shipping.id, id: rejected.id, expectedRevision: rejected.data().revision };
    await ok(post("/api/store/order-emails", retry));
    assert.equal((await rejected.ref.get()).data().status, "accepted");
    assert.equal((await post("/api/store/order-emails", retry)).status, 409);
    assert.match(email.messages.get(`sadboi-order-email/${rejected.id}`).payload.text, /No tracking number/);
    check("tracking removal is explicit and fulfillment delivery failures support revision-protected staff retry");
  }
  return { pickup: { id: pickup.id, token: pickup.managementToken, orderNumber: privateStatus.orderNumber }, shipping: { id: shipping.id, token: shipping.managementToken, orderNumber: (await guest(shipping)).orderNumber } };
}
