import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { access, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const fromWeb = createRequire(
  new URL("../web-app/package.json", import.meta.url),
);

export async function productPageChecks({
  request,
  csrf,
  ownerCookie,
  db,
  check,
  origin,
}) {
  const id = () => randomBytes(32).toString("hex");
  const productId = id(),
    secondId = id(),
    variantId = id(),
    hiddenId = id(),
    locationId = id();
  const collection = (name) => db.collection(`businesses/sadboi/${name}`);
  const product = collection("products").doc(productId);
  const variant = collection("productVariants").doc(variantId);
  const productInput = {
    artworkId: id(),
    title: "Moonlight Print",
    kind: "print",
    description: "A moonlit study in ink.\nPrinted on archival paper.",
    status: "active",
    publication: "public",
  };
  const variantInput = {
    productId,
    sku: "MOON-8X10",
    name: "8 × 10 print",
    size: "8 × 10",
    color: "",
    material: "Archival paper",
    finish: "Matte",
    priceMinor: 2500,
    currency: "USD",
    weightGrams: 100,
    fulfillment: "stocked",
    status: "active",
    publication: "public",
  };
  await product.set({
    input: productInput,
    privateNote: "PRIVATE_PRODUCT_NOTE",
    internalCost: "PRIVATE_COST_SENTINEL",
  });
  await collection("products")
    .doc(secondId)
    .set({ input: { ...productInput, title: "Small Night Print" } });
  await variant.set({ input: variantInput });
  await collection("productVariants")
    .doc(id())
    .set({
      input: {
        ...variantInput,
        productId: secondId,
        sku: "NIGHT-8",
        name: "Small print",
        fulfillment: "made_to_order",
      },
    });
  await collection("productVariants")
    .doc(hiddenId)
    .set({
      input: {
        ...variantInput,
        name: "PRIVATE_VARIANT_SENTINEL",
        publication: "private",
      },
    });
  await collection("stockLocations")
    .doc(locationId)
    .set({
      input: {
        name: "Online studio",
        kind: "studio",
        status: "active",
        onlineEligible: true,
      },
    });
  const balance = collection("stockBalances").doc(id());
  await balance.set({
    variantId,
    locationId,
    onHand: 10,
    reserved: 2,
    allocated: 1,
    unavailable: 1,
    revision: 1,
  });
  const proof = await csrf();
  const sharp = fromWeb("sharp");
  const png = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#8c7589" },
  })
    .png()
    .toBuffer();
  const upload = await request(`/api/inventory/images/products/${productId}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      Origin: origin,
      Cookie: ownerCookie + "; " + proof.cookie,
      "X-CSRF-Token": proof.token,
    },
    body: png,
  });
  assert.equal(upload.status, 201, await upload.clone().text());
  const url = `/shop/${productId}`;
  const page = await request(url);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Moonlight Print/);
  assert.match(html, /Printed on archival paper/);
  assert.match(html, /6<!-- --> available/);
  for (const secret of [
    "PRIVATE_PRODUCT_NOTE",
    "PRIVATE_COST_SENTINEL",
    "PRIVATE_VARIANT_SENTINEL",
  ])
    assert.ok(!html.includes(secret));
  check(
    "public product page renders prices, stock availability and safe public fields",
  );
  assert.ok(html.includes(`href="https://sadboi.art${url}"`));
  assert.ok(html.includes('property="og:title" content="Moonlight Print'));
  assert.ok(
    html.includes(
      `https://sadboi.art/api/store/catalog/images/products/${productId}`,
    ),
  );
  assert.match(html, /name="robots" content="noindex, follow"/);
  check(
    "product canonical, sharing metadata and development noindex use public product data",
  );
  const shopHtml = await (await request("/shop")).text();
  assert.ok(shopHtml.includes(`href="${url}"`));
  check("shop titles expose crawlable product page links");
  for (const missing of ["not-an-id", id()])
    assert.equal((await request(`/shop/${missing}`)).status, 404);
  check("unknown and malformed product addresses return HTTP 404");
  await product.update({ "input.title": "Moonlight Print — renamed" });
  assert.ok(
    (await (await request(url)).text()).includes("Moonlight Print — renamed"),
  );
  check("product renaming preserves its shareable address");
  await variant.update({ "input.status": "archived" });
  const unavailable = await (await request(url)).text();
  assert.match(unavailable, /No variations are available to order/);
  assert.ok(!unavailable.includes("Add selected to cart"));
  check(
    "products without public active variants show unavailable instead of purchase controls",
  );
  await variant.update({ "input.status": "active" });
  for (const change of [
    { "input.publication": "private" },
    { "input.publication": "public", "input.status": "archived" },
  ]) {
    await product.update(change);
    assert.equal((await request(url)).status, 404);
    assert.equal(
      (await request(`/api/store/catalog/images/products/${productId}`)).status,
      404,
    );
    assert.ok(
      !(await (await request("/shop")).text()).includes(`href="${url}"`),
    );
  }
  check(
    "private and archived products withdraw page, catalog link and public image",
  );
  await product.update({
    "input.publication": "public",
    "input.status": "active",
    "input.title": "Moonlight Print",
  });
  await balance.update({ onHand: 4 });
  const outOfStock = await (await request(url)).text();
  assert.match(outOfStock, /0<!-- --> available/);
  check("sold-out products remain discoverable with zero availability");
  await balance.update({ onHand: 10 });
  if (process.argv.includes("--product-preview")) {
    const stopFile = new URL(
      "../web-app/.next-auth-test/product-preview.done",
      import.meta.url,
    );
    await rm(stopFile, { force: true });
    console.log(`PRODUCT BROWSER PREVIEW: ${origin}${url}`);
    console.log(
      "Create web-app/.next-auth-test/product-preview.done to finish (10-minute maximum).",
    );
    for (let i = 0; i < 1200; i++) {
      try {
        await access(stopFile);
        break;
      } catch {
        await delay(500);
      }
    }
    await rm(stopFile, { force: true });
  }
}
