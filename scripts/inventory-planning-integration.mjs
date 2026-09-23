import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function stockPlanningChecks({ request, write, created, read, stock, collection, check, variant, site, reservedVariantId, studio, accountingCookie, legalCookie, otherCookie }) {
  const variantId = await created("variants", { ...variant, sku: "COUNT-TEST", name: "Counted print" });
  const locationId = await created("locations", { ...site, name: "Counting room" });
  const destinationId = await created("locations", { ...site, name: "Receiving bay" });
  async function current(at = locationId, sku = variantId) {
    return (await stock(sku)).balances.find(item => item.locationId === at) ?? { onHand: 0, unavailable: 0, reserved: 0, allocated: 0, revision: 0 };
  }
  async function count(total, options = {}) {
    return write("stocktake", { variantId, locationId, countedOnHand: total, expectedRevision: (await current()).revision, reason: "Physical shelf count", reference: "COUNT-001", ...options.input }, options);
  }
  async function move(kind, quantity) {
    return created("movement", { variantId, locationId, kind, quantity, expectedRevision: (await current()).revision, reason: "Planning check", reference: "", unitCostMinor: null });
  }
  const policy = { variantId, locationId, minimum: 3, target: 10, enabled: true, expectedRevision: 0 };
  async function queue(cookie) {
    const response = await read("/api/inventory/replenishment", cookie);
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /no-store/);
    return response.json();
  }
  assert.equal((await request("/api/inventory/replenishment")).status, 401);
  assert.equal((await read("/api/inventory/replenishment", legalCookie)).status, 403);
  for (const cookie of [accountingCookie, legalCookie]) {
    assert.equal((await count(0, { cookie })).status, 403);
    assert.equal((await write("stock-policy", policy, { cookie })).status, 403);
  }
  check("stock counts and thresholds enforce role permissions, including replenishment reads");
  const zero = await count(0);
  assert.equal(zero.status, 201, await zero.clone().text());
  let balance = await current();
  assert.equal(balance.onHand, 0);
  assert.equal(balance.revision, 1);
  let history = (await stock(variantId)).movements;
  assert.equal(history[0].kind, "stocktake");
  assert.equal(history[0].quantity, 0);
  assert.equal(history[0].countedOnHand, 0);
  check("zero opening counts record an observation without inventing stock");
  const operationId = randomUUID();
  const input = { variantId, locationId, countedOnHand: 10, expectedRevision: 1, reason: "Opening shelf count", reference: "COUNT-002" };
  const id = await created("stocktake", input, { operationId });
  assert.equal(await created("stocktake", input, { operationId }), id);
  balance = await current();
  assert.equal(balance.onHand, 10);
  assert.equal(balance.revision, 2);
  assert.equal((await write("stocktake", { ...input, countedOnHand: 11 }, { operationId })).status, 409);
  history = (await stock(variantId)).movements;
  assert.equal(history.find(item => item.id === id).before.onHand, 0);
  assert.equal(history.find(item => item.id === id).after.onHand, 10);
  check("count retries retain a single before/after history record and reject changed payloads");
  assert.equal((await count(6)).status, 201);
  balance = await current();
  assert.equal(balance.onHand, 6);
  assert.equal((await stock(variantId)).movements[0].onHandDelta, -4);
  const matching = await count(6);
  assert.equal(matching.status, 201);
  assert.equal((await current()).revision, 4);
  assert.equal((await collection("stockLocations").doc(locationId).get()).data().onHandUnits, 6);
  check("shortages and matching counts reconcile location totals and preserve observations");
  const observed = await current();
  await move("receive", 1);
  assert.equal((await count(6, { input: { expectedRevision: observed.revision } })).status, 409);
  assert.equal((await current()).onHand, 7);
  check("a count started before receiving cannot overwrite the new receipt");
  const baseline = await current();
  const contenders = await Promise.all([
    count(8, { input: { expectedRevision: baseline.revision } }),
    count(9, { input: { expectedRevision: baseline.revision }, cookie: otherCookie }),
  ]);
  assert.deepEqual(contenders.map(response => response.status).sort(), [201, 409]);
  check("two staff counts of the same balance cannot silently overwrite each other");
  assert.equal((await count(7, { input: { variantId: reservedVariantId, locationId: studio, expectedRevision: 1 } })).status, 409);
  for (const extra of [{ countedOnHand: -1 }, { countedOnHand: 1.5 }, { reason: "" }, { businessId: "other" }, { quantity: 1 }]) {
    assert.equal((await count(1, { input: extra })).status, 400);
  }
  check("physical counts reject invalid fields and shortages below committed or quarantined units");
  const policyOperation = randomUUID();
  const policyId = await created("stock-policy", policy, { operationId: policyOperation });
  assert.equal(await created("stock-policy", policy, { operationId: policyOperation }), policyId);
  assert.equal((await stock(variantId)).policies[0].revision, 1);
  assert.equal((await collection("stockPolicies").get()).size, 1);
  assert.equal((await write("stock-policy", { ...policy, target: 11 }, { operationId: policyOperation })).status, 409);
  assert.equal((await write("stock-policy", { ...policy, target: 3, expectedRevision: 1 })).status, 400);
  assert.equal((await write("stock-policy", { ...policy, minimum: -1, expectedRevision: 1 })).status, 400);
  assert.equal((await write("stock-policy", { ...policy, businessId: "other" })).status, 400);
  check("thresholds validate target levels, reject ownership injection, and support retry-safe saves");
  const edits = await Promise.all([
    write("stock-policy", { ...policy, expectedRevision: 1 }),
    write("stock-policy", { ...policy, expectedRevision: 1 }, { cookie: otherCookie }),
  ]);
  assert.deepEqual(edits.map(response => response.status).sort(), [201, 409]);
  check("threshold revisions prevent two staff edits from overwriting each other");
  assert.equal((await count(6)).status, 201);
  assert.equal((await queue()).items.length, 0);
  await move("quarantine", 3);
  let row = (await queue()).items.find(item => item.locationId === locationId);
  assert.equal(row.available, 3);
  assert.equal(row.suggested, 7);
  await move("receive_quarantined", 2);
  row = (await queue()).items.find(item => item.locationId === locationId);
  assert.equal(row.available, 3);
  await move("receive", 1);
  assert.equal((await queue()).items.length, 0);
  check("low-stock alerts use available units at the threshold, exclude quarantine, and clear after accepted receiving");
  const destinationPolicy = { ...policy, locationId: destinationId, minimum: 0 };
  const creates = await Promise.all([write("stock-policy", destinationPolicy), write("stock-policy", destinationPolicy, { cookie: otherCookie })]);
  assert.deepEqual(creates.map(response => response.status).sort(), [201, 409]);
  row = (await queue()).items.find(item => item.locationId === destinationId);
  assert.equal(row.available, 0);
  assert.equal(row.suggested, 10);
  check("concurrent threshold creation has one winner and monitors never-stocked locations");
  const transferId = await created("dispatch", { variantId, fromId: locationId, toId: destinationId, quantity: 1, reason: "Planning transfer", reference: "" });
  row = (await queue()).items.find(item => item.locationId === destinationId);
  assert.equal(row.available, 0);
  await created("receipt", { transferId, kind: "receive", quantity: 1, reason: "Accepted arrival" });
  assert.equal((await queue()).items.some(item => item.locationId === destinationId), false);
  check("in-transit units do not clear an empty-location alert before accepted receipt");
  const accountingQueue = await queue(accountingCookie);
  assert.equal(accountingQueue.items.length, 1);
  assert.equal(accountingQueue.enabledPolicies, 2);
  assert.equal(JSON.stringify(accountingQueue).includes("internalNotes"), false);
  check("accounting sees replenishment without private artwork fields");
  const sourcePolicy = (await stock(variantId)).policies.find(item => item.locationId === locationId);
  await created("stock-policy", { ...policy, expectedRevision: sourcePolicy.revision, enabled: false });
  assert.equal((await queue()).items.length, 0);
  check("disabled thresholds leave the replenishment queue immediately");
  const transit = await created("locations", { ...site, name: "Transit", kind: "transit", onlineEligible: false });
  assert.equal((await write("stock-policy", { ...policy, locationId: transit })).status, 409);
  const madeToOrder = await created("variants", { ...variant, sku: "COUNT-MTO", fulfillment: "made_to_order" });
  assert.equal((await write("stock-policy", { ...policy, variantId: madeToOrder })).status, 409);
  assert.equal((await write("stock-policy", { ...policy, locationId: "f".repeat(64) })).status, 404);
  check("thresholds reject transit, made-to-order variants, and missing locations");
  assert.equal((await write("variants", { ...variant, sku: "COUNT-TEST", name: "Counted print", status: "archived" }, { id: variantId, revision: 1 })).status, 200);
  assert.equal((await queue()).enabledPolicies, 0);
  assert.equal((await write("stock-policy", { ...policy, expectedRevision: sourcePolicy.revision + 1 })).status, 409);
  assert.equal((await count((await current()).onHand)).status, 201);
  check("archived variants leave replenishment but retain physical count reconciliation");
  const destinationSavedPolicy = (await stock(variantId)).policies.find(item => item.locationId === destinationId);
  await created("stock-policy", { ...destinationPolicy, expectedRevision: destinationSavedPolicy.revision, enabled: false });
  assert.equal((await stock(variantId)).policies.every(item => !item.enabled), true);
  check("thresholds can be disabled after their variant is archived");
  const inactive = await created("locations", { ...site, name: "Archived shelves", status: "archived" });
  assert.equal((await count(0, { input: { locationId: inactive, expectedRevision: 0 } })).status, 409);
  check("counts cannot introduce physical stock at archived locations");
  const operations = await collection("inventoryOperations").get();
  const counts = await collection("inventoryMovements").where("variantId", "==", variantId).get();
  const audits = await collection("inventoryAudit").get();
  const operationIds = new Set(operations.docs.map(doc => doc.id));
  for (const movement of counts.docs) assert.ok(operationIds.has(movement.id));
  const policyAudits = audits.docs.filter(doc => doc.data().resource === "stockPolicies");
  for (const audit of policyAudits) assert.ok(operationIds.has(audit.id));
  assert.equal(policyAudits.length, 5);
  const expectedTotal = (await collection("stockBalances").where("locationId", "==", locationId).get()).docs.reduce((sum, doc) => sum + doc.data().onHand, 0);
  assert.equal((await collection("stockLocations").doc(locationId).get()).data().onHandUnits, expectedTotal);
  check("counts and threshold changes retain operation-linked history and balanced location totals");
}
