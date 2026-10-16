import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

export async function inventoryPageChecks({
  request,
  ownerCookie,
  legalCookie,
  product,
  variant,
  hiddenId,
  check,
}) {
  const base = "/admin/inventory";
  const productUrl = `${base}/products/${product.id}`;
  const variantUrl = `${base}/variants/${variant.id}`;
  const staff = { headers: { Cookie: ownerCookie } };
  const index = await request(base, staff);
  assert.equal(index.status, 200);
  const cards = await index.text();
  assert.ok(cards.includes('class="inv-product-card"'));
  assert.ok(cards.includes(productUrl + "/edit"));
  assert.ok(cards.includes(`/api/inventory/images/products/${product.id}`));
  for (const url of [
    productUrl,
    variantUrl,
    productUrl + "/edit",
    variantUrl + "/edit",
  ]) {
    const response = await request(url, staff);
    assert.equal(
      response.status,
      200,
      `${url}: ${await response.clone().text()}`,
    );
    const anonymous = await request(url);
    assert.equal(anonymous.status, 307);
    assert.ok(anonymous.headers.get("location")?.includes("/sign-in"));
    const denied = await request(url, { headers: { Cookie: legalCookie } });
    assert.equal(denied.status, 307);
    assert.equal(denied.headers.get("location"), "/admin");
  }
  const productHtml = await (await request(productUrl, staff)).text();
  assert.ok(productHtml.includes(variantUrl));
  assert.ok(productHtml.includes(`${base}/variants/${hiddenId}`));
  assert.ok(
    productHtml.includes(`${base}/variants/new/edit?product=${product.id}`),
  );
  const variantHtml = await (await request(variantUrl, staff)).text();
  assert.ok(variantHtml.includes("Archival cotton paper"));
  assert.ok(variantHtml.includes("MOON-8X10"));
  assert.ok(variantHtml.includes(`${base}?variant=${variant.id}`));
  const stock = await request(`/api/inventory/stock?variant=${variant.id}`, staff);
  assert.equal(stock.status, 200, await stock.clone().text());
  assert.equal((await stock.json()).balances[0].onHand, 10);
  for (const image of (await variant.get()).data().catalogImages)
    assert.ok(variantHtml.includes(`asset=${image.assetId}`));
  assert.equal(
    (await request(`${base}/variants/new/edit?product=${product.id}`, staff))
      .status,
    200,
  );
  check(
    "inventory image cards link to authorized product/variation details and editors, including private variations and gallery/stock links",
  );
  for (const ref of [product, variant]) {
    await ref.update({
      "input.publication": "private",
      "input.status": "archived",
    });
    const url = ref === product ? productUrl : variantUrl;
    assert.equal((await request(url, staff)).status, 200);
    assert.equal((await request(url + "/edit", staff)).status, 200);
    await ref.update({
      "input.publication": "public",
      "input.status": "active",
    });
  }
  for (const url of [
    `${base}/products/${randomBytes(32).toString("hex")}`,
    `${base}/variants/invalid`,
    `${base}/locations/${variant.id}`,
    `${base}/variants/new/edit?product=invalid`,
  ])
    assert.equal((await request(url, staff)).status, 404, url);
  check(
    "private/archived inventory remains manageable and missing records or invalid creation parents return 404",
  );
}
