import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
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
    revision: 1,
    privateNote: "PRIVATE_PRODUCT_NOTE",
    internalCost: "PRIVATE_COST_SENTINEL",
  });
  await collection("products")
    .doc(secondId)
    .set({ input: { ...productInput, title: "Small Night Print" } });
  await variant.set({ input: variantInput, revision: 1 });
  await collection("artworks")
    .doc(productInput.artworkId)
    .set({ title: "Moon study" });
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
  const uploadHeaders = {
    "Content-Type": "image/png",
    Origin: origin,
    Cookie: ownerCookie + "; " + proof.cookie,
    "X-CSRF-Token": proof.token,
  };
  for (const [resource, ref, input] of [
    ["products", product, productInput],
    ["variants", variant, variantInput],
  ]) {
    const uploadUrl = `/api/inventory/images/${resource}/${ref.id}`;
    const first = await request(uploadUrl, {
      method: "POST",
      headers: uploadHeaders,
      body: png,
    });
    assert.equal(first.status, 201);
    const oldAssetId = (await first.json()).image.assetId;
    async function saveImageMetadata(imageFields) {
      const current = (await ref.get()).data();
      const saved = await request(`/api/inventory?action=${resource}`, {
        method: "PATCH",
        headers: { ...uploadHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ref.id,
          revision: current.revision,
          operationId: randomUUID(),
          input: { ...input, ...imageFields },
        }),
      });
      assert.equal(saved.status, 200, await saved.clone().text());
    }
    await saveImageMetadata({});
    assert.equal((await ref.get()).data().input.imageAssetId, oldAssetId);
    const replacement = await request(uploadUrl, {
      method: "POST",
      headers: uploadHeaders,
      body: png,
    });
    assert.equal(replacement.status, 201);
    const newAssetId = (await replacement.json()).image.assetId;
    assert.notEqual(newAssetId, oldAssetId);
    await saveImageMetadata({ imageAssetId: oldAssetId });
    assert.equal((await ref.get()).data().input.imageAssetId, newAssetId);
    await saveImageMetadata({ imageAssetId: "" });
    assert.equal((await ref.get()).data().input.imageAssetId, newAssetId);
    // Simulate an earlier broken save. The stored upload still restores the preview.
    await ref.update({ input });
    const catalog = await (
      await request("/api/inventory", { headers: { Cookie: ownerCookie } })
    ).json();
    assert.equal(
      catalog[resource].find((item) => item.id === ref.id).imageAssetId,
      newAssetId,
    );
    const publicHtml = await (await request(`/shop/${productId}`)).text();
    assert.ok(publicHtml.includes(`${ref.id}?v=${newAssetId}`));
    await saveImageMetadata({});
    assert.equal((await ref.get()).data().input.imageAssetId, newAssetId);
    await ref.update({ "input.publication": "private" });
    const preview = await request(uploadUrl, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("cache-control"), /private, no-store/);
    assert.equal((await request(uploadUrl)).status, 401);
    assert.equal(
      (await request(`/api/store/catalog/images/${resource}/${ref.id}`)).status,
      404,
    );
    await ref.update({ "input.publication": "public" });
    assert.equal(
      (
        await request(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            Cookie: ownerCookie,
            Origin: origin,
          },
          body: png,
        })
      ).status,
      403,
    );
    check(
      `${resource} image survives save, replacement, stale metadata and legacy recovery; previews remain private`,
    );
  }
  const url = `/shop/${productId}`;
  const page = await request(url);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Moonlight Print/);
  assert.match(html, /Printed on archival paper/);
  assert.match(html.replace(/<!--.*?-->/g, ""), /6 available/);
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
  assert.match(outOfStock.replace(/<!--.*?-->/g, ""), /0 available/);
  check("sold-out products remain discoverable with zero availability");
  await balance.update({ onHand: 10 });
  const { variantGalleryChecks } =
    await import("./variant-gallery-integration.mjs");
  await variantGalleryChecks({
    request,
    csrf,
    ownerCookie,
    origin,
    product,
    variant,
    variantInput,
    sharp,
    check,
  });
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
