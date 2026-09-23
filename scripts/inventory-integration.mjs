import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

export async function inventoryChecks({ request, csrf, ownerCookie, legalCookie, identity, signIn, session, db, check, origin }) {
  const collection = name => db.collection("businesses/sadboi/" + name);
  const read = (url, cookie = ownerCookie) => request(url, { headers: { Cookie: cookie } });
  async function write(action, input, { cookie = ownerCookie, operationId = randomUUID(), id, revision } = {}) {
    const proof = await csrf();
    return request("/api/inventory?action=" + action, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie + "; " + proof.cookie, "X-CSRF-Token": proof.token },
      body: JSON.stringify({ input, operationId, ...(id ? { id, revision } : {}) }),
    });
  }
  async function created(action, input, options) {
    const response = await write(action, input, options);
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()).id;
  }
  async function catalog(cookie) {
    const response = await read("/api/inventory", cookie);
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /no-store/);
    return response.json();
  }
  async function stock(variantId) {
    const response = await read("/api/inventory/stock?variant=" + variantId);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  const accounting = await identity("inventory-accounting@example.test", true, "accounting");
  const accountingCookie = session(await signIn(accounting));
  const otherOwner = await identity("inventory-owner@example.test", true, "super_admin");
  const otherCookie = session(await signIn(otherOwner));
  assert.equal((await request("/api/inventory")).status, 401);
  assert.equal((await request("/api/inventory/stock?variant=" + "a".repeat(64))).status, 401);
  assert.equal((await read("/api/inventory", legalCookie)).status, 403);
  assert.equal((await read("/api/inventory/stock?variant=" + "a".repeat(64), legalCookie)).status, 403);
  check("inventory denies anonymous and legal reads");
  assert.equal((await read("/admin/inventory", legalCookie)).status, 307);
  check("legal cannot render the inventory dashboard");
  assert.equal((await write("products", {}, { cookie: accountingCookie })).status, 403);
  assert.equal((await write("products", {}, { cookie: legalCookie })).status, 403);
  check("accounting and legal cannot mutate inventory");
  const proof = await csrf();
  const csrfHeaders = { "Content-Type": "application/json", Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  assert.equal((await request("/api/inventory?action=products", { method: "POST", headers: { ...csrfHeaders, Origin: "https://attacker.example" }, body: "{}" })).status, 403);
  assert.equal((await request("/api/inventory?action=products", { method: "POST", headers: { ...csrfHeaders, Origin: origin, "X-CSRF-Token": "f".repeat(64) }, body: "{}" })).status, 403);
  check("inventory writes enforce origin and CSRF");

  const artProof = await csrf();
  const artworkResponse = await request("/api/artworks", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + artProof.cookie, "X-CSRF-Token": artProof.token },
    body: JSON.stringify({ operationId: randomUUID(), input: { title: "Inventory original", series: "Test", year: 2026, medium: "Digital", description: "Emulator only", status: "draft", rights: "owned", tags: [], pixelWidth: null, pixelHeight: null, colorProfile: "", internalNotes: "Never expose through inventory" } }),
  });
  assert.equal(artworkResponse.status, 201, await artworkResponse.clone().text());
  const artworkId = (await artworkResponse.json()).artwork.id;
  const product = { artworkId, title: "Studio print", kind: "print", description: "Archival edition", status: "active" };
  const productOp = randomUUID();
  const productId = await created("products", product, { operationId: productOp });
  assert.equal(await created("products", product, { operationId: productOp }), productId);
  assert.equal((await collection("products").get()).size, 1);
  assert.equal((await write("products", { ...product, title: "Changed" }, { operationId: productOp })).status, 409);
  check("product creation is shared and retries are idempotent");
  assert.equal((await write("products", { ...product, businessId: "other" })).status, 400);
  assert.equal((await write("products", { ...product, artworkId: "f".repeat(64) })).status, 400);
  assert.equal((await write("products", product, { id: productId, revision: 1.5 })).status, 400);
  check("product validation rejects ownership injection, missing artwork, and invalid revisions");
  const edits = await Promise.all([
    write("products", { ...product, title: "Print A" }, { id: productId, revision: 1 }),
    write("products", { ...product, title: "Print B" }, { id: productId, revision: 1, cookie: otherCookie }),
  ]);
  assert.deepEqual(edits.map(response => response.status).sort(), [200, 409]);
  check("concurrent metadata edits cannot overwrite each other");
  const variant = { productId, sku: "print-a3", name: "A3 print", size: "A3", color: "", material: "Archival paper", finish: "Matte", priceMinor: 4500, currency: "USD", weightGrams: 100, fulfillment: "stocked", status: "active" };
  const variantId = await created("variants", variant);
  assert.equal((await catalog()).variants[0].sku, "PRINT-A3");
  assert.equal((await write("variants", { ...variant, sku: "PRINT-A3" })).status, 409);
  assert.equal((await write("variants", { ...variant, sku: "NEW-SKU" }, { id: variantId, revision: 1 })).status, 409);
  assert.equal((await write("variants", { ...variant, priceMinor: 1.5 })).status, 400);
  check("variant SKUs are unique, case-normalized, permanent, and use integer prices");
  const raceSku = await Promise.all([write("variants", { ...variant, sku: "race-sku" }), write("variants", { ...variant, sku: "RACE-SKU" }, { cookie: otherCookie })]);
  assert.deepEqual(raceSku.map(response => response.status).sort(), [201, 409]);
  check("simultaneous SKU claims create only one variant");
  const site = { name: "Studio", kind: "studio", status: "active", onlineEligible: true };
  const studio = await created("locations", site);
  const gallery = await created("locations", { ...site, name: "Gallery", kind: "gallery", onlineEligible: false });
  const event = await created("locations", { ...site, name: "Convention", kind: "event", onlineEligible: false });
  assert.equal((await write("locations", { ...site, kind: "transit" })).status, 400);
  check("locations distinguish online fulfillment and reject sellable transit locations");
  const secondView = await catalog(otherCookie);
  assert.equal(secondView.variants.find(item => item.id === variantId).sku, "PRINT-A3");
  const accountantView = await catalog(accountingCookie);
  assert.equal(accountantView.products.length, 1);
  assert.equal(JSON.stringify(accountantView).includes("Never expose"), false);
  check("second admin and accounting share product metadata without private artwork notes");
  const movement = (kind, quantity, expectedRevision = null, locationId = studio) => ({ variantId, locationId, kind, quantity, expectedRevision, reason: "Integration inventory check", reference: "TEST-001", unitCostMinor: null });
  const receivedOp = randomUUID();
  const receivedId = await created("movement", { ...movement("receive", 20), unitCostMinor: 1250 }, { operationId: receivedOp });
  assert.equal(await created("movement", { ...movement("receive", 20), unitCostMinor: 1250 }, { operationId: receivedOp }), receivedId);
  let data = await stock(variantId);
  assert.equal(data.balances[0].onHand, 20);
  assert.equal(data.movements.length, 1);
  assert.equal(data.movements[0].unitCostMinor, 1250);
  check("receiving retry adds stock and cost history exactly once");
  assert.equal((await write("movement", movement("adjust", -1, 0))).status, 409);
  assert.equal((await write("movement", movement("adjust", -21, 1))).status, 409);
  assert.equal((await write("movement", movement("receive", 0))).status, 400);
  check("stale adjustments, negative balances, and zero quantities are rejected");
  await created("movement", movement("quarantine", 5, 1));
  data = await stock(variantId);
  assert.equal(data.balances[0].unavailable, 5);
  assert.equal(data.balances[0].onHand, 20);
  assert.equal((await write("movement", movement("adjust", -16, 2))).status, 409);
  await created("movement", movement("release", 2, 2));
  await created("movement", movement("discard", 3, 3));
  data = await stock(variantId);
  assert.equal(data.balances[0].onHand, 17);
  assert.equal(data.balances[0].unavailable, 0);
  assert.equal((await write("movement", movement("discard", 1, 4))).status, 409);
  check("quarantine, approval, and discard preserve physical and available stock");
  await created("movement", { ...movement("receive_quarantined", 3), unitCostMinor: 900 });
  data = await stock(variantId);
  assert.equal(data.balances[0].onHand, 20);
  assert.equal(data.balances[0].unavailable, 3);
  check("damaged receiving never increases available stock");
  const dispatch = (quantity, toId = gallery) => ({ variantId, fromId: studio, toId, quantity, reason: "Gallery transfer", reference: "TRANSFER-01" });
  const dispatchOp = randomUUID();
  const transferId = await created("dispatch", dispatch(10), { operationId: dispatchOp });
  assert.equal(await created("dispatch", dispatch(10), { operationId: dispatchOp }), transferId);
  data = await stock(variantId);
  assert.equal(data.balances.find(balance => balance.locationId === studio).onHand, 10);
  assert.equal(data.balances.some(balance => balance.locationId === gallery), false);
  assert.equal(data.transfers[0].remaining, 10);
  check("dispatch retry removes units once and keeps transit out of destination stock");
  assert.equal((await write("locations", { ...site, status: "archived" }, { id: studio, revision: 1 })).status, 409);
  assert.equal((await write("locations", { ...site, name: "Gallery", kind: "gallery", onlineEligible: false, status: "archived" }, { id: gallery, revision: 1 })).status, 409);
  check("locations with stock or pending transfers cannot be archived");
  const receipt = (kind, quantity) => ({ transferId, kind, quantity, reason: "Delivery reconciliation" });
  const receiptOp = randomUUID();
  const receiptId = await created("receipt", receipt("receive", 4), { operationId: receiptOp });
  assert.equal(await created("receipt", receipt("receive", 4), { operationId: receiptOp }), receiptId);
  data = await stock(variantId);
  assert.equal(data.transfers[0].remaining, 6);
  assert.equal(data.balances.find(balance => balance.locationId === gallery).onHand, 4);
  check("partial transfer receipts are retry-safe");
  await created("receipt", receipt("receive_quarantined", 2));
  data = await stock(variantId);
  assert.equal(data.balances.find(balance => balance.locationId === gallery).unavailable, 2);
  await created("receipt", receipt("loss", 4));
  data = await stock(variantId);
  assert.equal(data.transfers.length, 0);
  const closed = (await collection("stockTransfers").doc(transferId).get()).data();
  assert.equal(closed.status, "closed_with_loss");
  assert.equal(closed.received, 6);
  assert.equal(closed.lost, 4);
  assert.equal((await write("receipt", receipt("receive", 1))).status, 409);
  check("damaged transfer receipts quarantine units and losses close transit without adding stock");
  const race = await Promise.all([write("dispatch", dispatch(7)), write("dispatch", dispatch(7, event), { cookie: otherCookie })]);
  assert.deepEqual(race.map(response => response.status).sort(), [201, 409]);
  data = await stock(variantId);
  assert.equal(data.balances.find(balance => balance.locationId === studio).onHand, 3);
  check("competing transfers cannot dispatch the last available units twice");
  const racingTransfer = data.transfers[0];
  const receipts = await Promise.all([
    write("receipt", { transferId: racingTransfer.id, kind: "receive", quantity: 7, reason: "First arrival" }),
    write("receipt", { transferId: racingTransfer.id, kind: "receive", quantity: 7, reason: "Second arrival" }, { cookie: otherCookie }),
  ]);
  assert.deepEqual(receipts.map(response => response.status).sort(), [201, 409]);
  check("competing receipts cannot receive the same transit units twice");
  const totals = await collection("stockLocations").get();
  data = await stock(variantId);
  for (const location of totals.docs) {
    const record = location.data();
    assert.equal(record.incomingUnits, 0);
    assert.equal(record.outgoingUnits, 0);
    assert.equal(record.onHandUnits, data.balances.filter(balance => balance.locationId === location.id).reduce((sum, balance) => sum + balance.onHand, 0));
  }
  assert.equal((await collection("productVariants").doc(variantId).get()).data().openTransferCount, 0);
  check("location totals and transfer counters reconcile with balances");

  const reservedVariantId = await created("variants", { ...variant, sku: "reserved-test" });
  const reservedId = createHash("sha256").update(reservedVariantId + ":" + studio).digest("hex");
  await collection("stockBalances").doc(reservedId).set({ businessId: "sadboi", variantId: reservedVariantId, locationId: studio, onHand: 10, reserved: 4, allocated: 3, unavailable: 1, revision: 1 });
  const oldStudio = (await collection("stockLocations").doc(studio).get()).data();
  await collection("stockLocations").doc(studio).update({ onHandUnits: oldStudio.onHandUnits + 10 });
  assert.equal((await write("dispatch", { ...dispatch(3), variantId: reservedVariantId })).status, 409);
  assert.equal((await write("movement", { ...movement("quarantine", 3, 1), variantId: reservedVariantId })).status, 409);
  check("reserved and allocated stock cannot be consumed by movements or transfers");
  const sameOperation = randomUUID();
  const repeated = await Promise.all([
    write("movement", movement("receive", 1), { operationId: sameOperation }),
    write("movement", movement("receive", 1), { operationId: sameOperation }),
  ]);
  assert.deepEqual(repeated.map(response => response.status), [201, 201]);
  assert.equal((await repeated[0].json()).id, (await repeated[1].json()).id);
  check("simultaneous identical operation retries commit only once");
  const beforeArchive = (await catalog()).variants.find(item => item.id === variantId);
  assert.equal((await write("variants", { ...variant, status: "archived" }, { id: variantId, revision: beforeArchive.revision })).status, 200);
  assert.equal((await write("movement", movement("receive", 1))).status, 409);
  assert.equal((await write("variants", { ...variant, sku: "PRINT-A3" })).status, 409);
  check("archived variants stop new receiving and retain their SKU claim");
  const empty = await created("locations", { ...site, name: "Empty location" });
  assert.equal((await write("locations", { ...site, name: "Empty location", status: "archived" }, { id: empty, revision: 1 })).status, 200);
  assert.equal((await write("dispatch", { ...dispatch(1), toId: empty })).status, 409);
  check("empty locations can archive and cannot receive transfers afterward");
  assert.equal((await read("/api/inventory/stock?variant=invalid/path")).status, 400);
  assert.equal((await read("/api/inventory/stock?variant=" + "e".repeat(64))).status, 404);
  assert.equal((await read("/api/inventory/stock?variant=" + variantId + "&cursor=" + "f".repeat(64))).status, 400);
  check("inventory reads reject malformed IDs, missing variants, and invalid cursors");
  const accountingStock = await read("/api/inventory/stock?variant=" + variantId, accountingCookie);
  assert.equal(accountingStock.status, 200);
  assert.ok((await accountingStock.json()).movements.some(item => item.unitCostMinor === 1250));
  check("accounting can read balances and receiving costs");
  const ownerPage = await read("/admin/inventory");
  assert.equal(ownerPage.status, 200);
  assert.match(await ownerPage.text(), /From artwork to object/);
  const accountingPage = await read("/admin/inventory", accountingCookie);
  assert.equal(accountingPage.status, 200);
  const accountingHtml = await accountingPage.text();
  assert.match(accountingHtml, /Accounting access/);
  assert.equal(accountingHtml.includes(">Add product<"), false);
  check("inventory dashboard renders admin and read-only accounting views");
  const audit = await collection("inventoryAudit").where("recordId", "==", productId).get();
  assert.equal(audit.size, 2);
  const operations = await collection("inventoryOperations").get();
  const movements = await collection("inventoryMovements").get();
  const allAudit = await collection("inventoryAudit").get();
  assert.equal(operations.size, movements.size + allAudit.size);
  check("every successful operation has one movement or metadata audit event");
  const template = movements.docs.find(doc => doc.data().variantId === variantId).data();
  const batch = db.batch();
  for (let index = 0; index < 55; index++) batch.create(collection("inventoryMovements").doc(createHash("sha256").update("inventory-page-" + index).digest("hex")), { ...template, createdAt: "2020-01-01T00:00:00.000Z" });
  await batch.commit();
  const first = await stock(variantId);
  assert.equal(first.movements.length, 50);
  assert.ok(first.nextCursor);
  const nextResponse = await read("/api/inventory/stock?variant=" + variantId + "&cursor=" + first.nextCursor);
  assert.equal(nextResponse.status, 200);
  const next = await nextResponse.json();
  assert.equal(next.nextCursor, null);
  const combined = [...first.movements, ...next.movements];
  assert.equal(new Set(combined.map(item => item.id)).size, combined.length);
  assert.equal(combined.length, (await collection("inventoryMovements").where("variantId", "==", variantId).get()).size);
  check("movement pagination preserves rows with identical timestamps");
  const { stockPlanningChecks } = await import("./inventory-planning-integration.mjs");
  await stockPlanningChecks({ request, write, created, read, stock, collection, check, variant, site, reservedVariantId, studio, accountingCookie, legalCookie, otherCookie });
  await db.doc("businesses/sadboi/memberships/" + otherOwner.uid).update({ status: "revoked" });
  assert.equal((await read("/api/inventory", otherCookie)).status, 401);
  assert.equal((await write("products", product, { cookie: otherCookie })).status, 401);
  check("revoked staff immediately lose inventory read and write access");
}
