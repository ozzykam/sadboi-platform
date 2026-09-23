import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

export async function storeOrderChecks({
  request,
  csrf,
  db,
  check,
  origin,
  ownerCookie,
}) {
  const collection = (name) => db.collection(`businesses/sadboi/${name}`);
  const id = (label) => createHash("sha256").update(label).digest("hex");
  const productId = id("checkout-product"),
    locationId = id("checkout-studio");
  const first = id("checkout-first"),
    second = id("checkout-second"),
    made = id("checkout-made");
  const balanceRef = (variantId) =>
    collection("stockBalances").doc(id(`${variantId}:${locationId}`));
  await collection("products")
    .doc(productId)
    .set({
      input: {
        title: "Emulator print",
        status: "active",
        publication: "public",
      },
    });
  await collection("stockLocations")
    .doc(locationId)
    .set({ input: { status: "active", onlineEligible: true } });
  for (const [variantId, priceMinor, fulfillment] of [
    [first, 2500, "stocked"],
    [second, 3000, "stocked"],
    [made, 4000, "made_to_order"],
  ]) {
    await collection("productVariants")
      .doc(variantId)
      .set({
        input: {
          productId,
          sku: `SKU-${variantId.slice(0, 8)}`,
          name: "Test print",
          size: "",
          color: "",
          material: "",
          finish: "",
          priceMinor,
          currency: "USD",
          weightGrams: null,
          fulfillment,
          status: "active",
          publication: "public",
        },
      });
    if (fulfillment === "stocked")
      await balanceRef(variantId).set({
        variantId,
        locationId,
        onHand: 20,
        reserved: 2,
        allocated: 0,
        unavailable: 1,
        revision: 1,
      });
  }
  const input = {
    customerName: "Test Buyer",
    customerEmail: "buyer@example.test",
    notes: "Emulator only",
    lines: [
      { variantId: first, quantity: 2 },
      { variantId: second, quantity: 3 },
      { variantId: made, quantity: 1 },
    ],
  };
  const proof = await csrf();
  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
    Cookie: proof.cookie,
    "X-CSRF-Token": proof.token,
  };
  const post = (body, extraHeaders = {}) =>
    request("/api/store/orders", {
      method: "POST",
      headers: { ...headers, ...extraHeaders },
      body: JSON.stringify(body),
    });
  const snapshot = async () => ({
    orders: (await collection("storeOrders").get()).size,
    operations: (await collection("storeOrderOperations").get()).size,
    counter: (await collection("inventoryState").doc("store").get()).data(),
    first: (await balanceRef(first).get()).data(),
    second: (await balanceRef(second).get()).data(),
  });
  const operationId = randomUUID();
  const response = await post({ input, operationId });
  assert.equal(response.status, 201, await response.clone().text());
  const result = await response.json();
  assert.equal(result.totalMinor, 18000);
  let stock = (await balanceRef(first).get()).data();
  assert.equal(stock.allocated, 2);
  assert.equal(stock.onHand, 20);
  assert.equal((await balanceRef(second).get()).data().allocated, 3);
  const order = (await collection("storeOrders").doc(result.id).get()).data();
  assert.equal(order.status, "pending_payment");
  assert.deepEqual(order.lines[0].allocations, [{ locationId, quantity: 2 }]);
  assert.deepEqual(order.lines[2].allocations, []);
  check(
    "multi-line checkout allocates stocked lines atomically and snapshots made-to-order lines",
  );

  const committed = await snapshot();
  const retries = await Promise.all([
    post({ input, operationId }),
    post({ input, operationId }),
  ]);
  for (const retry of retries) {
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), result);
  }
  assert.deepEqual(await snapshot(), committed);
  check(
    "lost-response and concurrent retries recover the same order without new stock or numbering effects",
  );

  assert.equal(
    (await post({ operationId, input: { ...input, notes: "Changed" } })).status,
    409,
  );
  assert.deepEqual(await snapshot(), committed);
  check("reused request IDs reject changed order details");

  for (const body of [
    { input },
    { input, operationId: "bad" },
    {
      operationId: randomUUID(),
      input: { ...input, lines: [input.lines[0], input.lines[0]] },
    },
    { operationId: randomUUID(), input: { ...input, totalMinor: 1 } },
    {
      operationId: randomUUID(),
      input: { ...input, lines: [{ variantId: first, quantity: 0.5 }] },
    },
    {
      operationId: randomUUID(),
      input: { ...input, fulfillmentMethod: "shipping" },
    },
  ])
    assert.equal((await post(body)).status, 400);
  assert.deepEqual(await snapshot(), committed);
  check(
    "invalid quantities, duplicate lines, missing keys, injected prices, and missing addresses are rejected",
  );

  assert.equal(
    (
      await post(
        { input, operationId: randomUUID() },
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        { input, operationId: randomUUID() },
        { "X-CSRF-Token": "0".repeat(64) },
      )
    ).status,
    403,
  );
  assert.equal((await request("/api/store/orders")).status, 401);
  check(
    "public order creation preserves CSRF checks and private order listing",
  );

  for (const update of [{ publication: "private" }, { status: "archived" }]) {
    await collection("products")
      .doc(productId)
      .update(
        Object.fromEntries(
          Object.entries(update).map(([key, value]) => [`input.${key}`, value]),
        ),
      );
    assert.equal(
      (await post({ input, operationId: randomUUID() })).status,
      409,
    );
    await collection("products")
      .doc(productId)
      .update({ "input.publication": "public", "input.status": "active" });
  }
  await collection("productVariants")
    .doc(second)
    .update({ "input.publication": "private" });
  assert.equal((await post({ input, operationId: randomUUID() })).status, 409);
  await collection("productVariants")
    .doc(second)
    .update({ "input.publication": "public" });
  assert.deepEqual(await snapshot(), committed);
  check("checkout rechecks both parent product and variant visibility");

  const shortage = {
    ...input,
    lines: [
      { variantId: first, quantity: 1 },
      { variantId: second, quantity: 18 },
    ],
  };
  assert.equal(
    (await post({ input: shortage, operationId: randomUUID() })).status,
    409,
  );
  assert.deepEqual(await snapshot(), committed);
  check(
    "a shortage in the last line rolls back every stock change and the order counter",
  );

  await balanceRef(first).update({ onHand: 6 }); // 2 allocated + 2 reserved + 1 unavailable + 1 free.
  const lastUnit = { ...input, lines: [{ variantId: first, quantity: 1 }] };
  const competing = await Promise.all([
    post({ input: lastUnit, operationId: randomUUID() }),
    post({ input: lastUnit, operationId: randomUUID() }),
  ]);
  assert.deepEqual(competing.map((res) => res.status).sort(), [201, 409]);
  stock = (await balanceRef(first).get()).data();
  assert.equal(stock.allocated, 3);
  assert.equal(stock.onHand, 6);
  assert.equal(stock.reserved, 2);
  assert.equal(stock.unavailable, 1);
  check(
    "two buyers of the final unit produce one order without consuming reserved or damaged stock",
  );

  const freshKey = randomUUID(),
    madeInput = { ...input, lines: [{ variantId: made, quantity: 2 }] };
  const before = await snapshot();
  const duplicate = await Promise.all([
    post({ input: madeInput, operationId: freshKey }),
    post({ input: madeInput, operationId: freshKey }),
  ]);
  assert.equal(duplicate[0].status, 201);
  assert.equal(duplicate[1].status, 201);
  assert.deepEqual(await duplicate[0].json(), await duplicate[1].json());
  assert.equal((await snapshot()).orders, before.orders + 1);
  assert.equal((await snapshot()).counter.orders, before.counter.orders + 1);
  check("simultaneous first submissions with one key create exactly one order");

  await collection("products")
    .doc(productId)
    .update({ "input.publication": "private" });
  const historicalRetry = await post({ input, operationId });
  assert.equal(historicalRetry.status, 201);
  assert.deepEqual(await historicalRetry.json(), result);
  check(
    "confirmed requests remain recoverable after publication or stock changes",
  );

  const help = await request("/admin/how-to", {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(help.status, 200);
  assert.match(await help.text(), /id="store-orders"/);
  check("staff can discover the order request and recovery tutorial");
}
