import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function variantGalleryChecks({
  request,
  csrf,
  ownerCookie,
  origin,
  product,
  variant,
  variantInput,
  sharp,
  check,
}) {
  const proof = await csrf();
  const headers = {
    "Content-Type": "image/png",
    Origin: origin,
    Cookie: ownerCookie + "; " + proof.cookie,
    "X-CSRF-Token": proof.token,
  };
  const endpoint = `/api/inventory/images/variants/${variant.id}`;
  const publicUrl = (asset) =>
    `/api/store/catalog/images/variants/${variant.id}?asset=${asset}`;
  const initial = (await variant.get()).data().input.imageAssetId;
  for (const color of ["#36785b", "#475ca1"]) {
    const png = await sharp({
      create: { width: 600, height: 800, channels: 3, background: color },
    })
      .png()
      .toBuffer();
    const response = await request(endpoint + "?append=1", {
      method: "POST",
      headers,
      body: png,
    });
    assert.equal(response.status, 201, await response.clone().text());
  }
  const gallery = (await variant.get()).data().catalogImages;
  assert.equal(gallery.length, 3);
  assert.equal(gallery[0].assetId, initial);
  assert.equal(new Set(gallery.map((image) => image.assetId)).size, 3);
  for (const image of gallery)
    assert.equal((await request(publicUrl(image.assetId))).status, 200);
  assert.equal((await request(publicUrl(randomUUID()))).status, 404);
  check(
    "variation uploads append ordered images, preserve the existing cover, and restrict asset access to saved members",
  );
  const description =
    "Archival cotton paper with a signed border.\n\nA close-up study of the night sky.";
  async function save(fields = {}) {
    const record = (await variant.get()).data();
    return request("/api/inventory?action=variants", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: variant.id,
        revision: record.revision,
        operationId: randomUUID(),
        input: { ...variantInput, description, ...fields },
      }),
    });
  }
  assert.equal((await save({ imageAssetId: "stale-cover" })).status, 200);
  assert.deepEqual((await variant.get()).data().catalogImages, gallery);
  assert.equal((await variant.get()).data().input.imageAssetId, initial);
  const html = await (await request(`/shop/${product.id}`)).text();
  assert.ok(html.includes("Archival cotton paper"));
  for (const image of gallery)
    assert.ok(html.includes(`asset=${image.assetId}`));
  assert.equal((await save({ description: "x".repeat(3001) })).status, 400);
  assert.equal((await save({ imageAssetIds: [randomUUID()] })).status, 400);
  check(
    "variation descriptions persist and public pages expose the full gallery without metadata saves overwriting it",
  );
  for (const ref of [variant, product]) {
    await ref.update({ "input.publication": "private" });
    for (const image of gallery)
      assert.equal((await request(publicUrl(image.assetId))).status, 404);
    await ref.update({ "input.publication": "public" });
  }
  assert.equal((await request(endpoint + `?asset=${initial}`)).status, 401);
  assert.equal(
    (
      await request(endpoint + `?asset=${initial}`, {
        method: "DELETE",
        headers: { Origin: origin, Cookie: ownerCookie },
      })
    ).status,
    403,
  );
  check(
    "private variation or parent product withdraws every public image and image removal requires CSRF",
  );
  for (const image of [gallery[1], gallery[0], gallery[2]]) {
    const removed = await request(endpoint + `?asset=${image.assetId}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(removed.status, 200);
    assert.equal((await request(publicUrl(image.assetId))).status, 404);
    assert.equal(
      (
        await request(endpoint + `?asset=${image.assetId}`, {
          method: "DELETE",
          headers,
        })
      ).status,
      200,
    );
    assert.equal((await save()).status, 200);
  }
  assert.deepEqual((await variant.get()).data().catalogImages, []);
  assert.ok(!(await variant.get()).data().input.imageAssetId);
  assert.equal(
    (await request(`/api/store/catalog/images/variants/${variant.id}`)).status,
    404,
  );
  check(
    "removing middle, cover and final images preserves the remaining gallery and metadata cannot restore removed images",
  );
  await variant.update({
    catalogImages: Array.from({ length: 12 }, (_, index) => ({
      assetId: randomUUID(),
      path: gallery[index % 3].path,
    })),
  });
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  assert.equal(
    (
      await request(endpoint + "?append=1", {
        method: "POST",
        headers,
        body: png,
      })
    ).status,
    400,
  );
  await variant.update({
    catalogImages: gallery,
    imagePath: gallery[0].path,
    "input.imageAssetId": initial,
  });
  check(
    "variation image limits are enforced without replacing existing gallery members",
  );
}
