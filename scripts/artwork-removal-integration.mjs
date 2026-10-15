import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const fromWeb = createRequire(
  new URL("../web-app/package.json", import.meta.url),
);

export async function artworkRemovalChecks({
  request,
  csrf,
  ownerCookie,
  legalCookie,
  db,
  check,
  origin,
}) {
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:9199");
  async function mutate(url, method, body, cookie = ownerCookie) {
    const proof = await csrf();
    return request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie + "; " + proof.cookie,
        "X-CSRF-Token": proof.token,
      },
      body: JSON.stringify(body),
    });
  }
  const input = {
    title: "Image removal fixture",
    series: "Tests",
    year: 2026,
    medium: "Digital painting",
    description: "Disposable removal fixture",
    status: "ready",
    rights: "owned",
    tags: [],
    pixelWidth: null,
    pixelHeight: null,
    colorProfile: "",
    internalNotes: "",
  };
  let art = (
    await (
      await mutate("/api/artworks", "POST", {
        input,
        operationId: randomUUID(),
      })
    ).json()
  ).artwork;
  const url = `/api/artworks/${art.id}`;
  const ref = db.doc(`businesses/sadboi/artworks/${art.id}`);
  const bytes = await fromWeb("sharp")({
    create: { width: 20, height: 10, channels: 3, background: "#ab3434" },
  })
    .png()
    .toBuffer();
  async function upload(key = randomUUID()) {
    const proof = await csrf();
    return request(`${url}/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        Origin: origin,
        Cookie: ownerCookie + "; " + proof.cookie,
        "X-CSRF-Token": proof.token,
        "X-Upload-ID": key,
        "X-File-Name": "remove-test.png",
      },
      body: bytes,
    });
  }
  const first = (await (await upload()).json()).asset;
  const secondUpload = randomUUID();
  const second = (await (await upload(secondUpload)).json()).asset;
  const endpoint = `${url}/assets/${second.id}`;
  const body = { operationId: randomUUID() };
  assert.equal((await request(endpoint, { method: "DELETE" })).status, 401);
  assert.equal(
    (await mutate(endpoint, "DELETE", body, legalCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: ownerCookie,
        },
        body: JSON.stringify(body),
      })
    ).status,
    403,
  );
  assert.equal(
    (await mutate(endpoint, "DELETE", { ...body, originalPath: "foreign" }))
      .status,
    400,
  );
  assert.equal(
    (
      await mutate(
        `/api/artworks/${"0".repeat(64)}/assets/${second.id}`,
        "DELETE",
        body,
      )
    ).status,
    404,
  );
  check(
    "image removal requires super-admin access, CSRF and scoped identifiers; browser paths are rejected",
  );
  const gallery = {
    published: true,
    assetId: second.id,
    alt: "Removal test",
    caption: "",
    credits: "",
    order: 0,
    rightsConfirmed: true,
  };
  art = (
    await (
      await mutate(`${url}/gallery`, "PATCH", {
        input: gallery,
        revision: art.revision,
        operationId: randomUUID(),
      })
    ).json()
  ).artwork;
  assert.equal((await mutate(endpoint, "DELETE", body)).status, 409);
  assert.equal((await ref.get()).data().assetCount, 2);
  assert.equal(
    (await request(`/api/gallery/images/${art.id}?w=480`)).status,
    200,
  );
  check(
    "published images cannot be removed and keep serving their public preview",
  );
  art = (
    await (
      await mutate(`${url}/gallery`, "PATCH", {
        input: { ...gallery, published: false },
        revision: art.revision,
        operationId: randomUUID(),
      })
    ).json()
  ).artwork;
  const secondDoc = ref.collection("assets").doc(second.id);
  const stored = (await secondDoc.get()).data();
  const bucket = fromWeb("firebase-admin/storage")
    .getStorage()
    .bucket("demo-sadboi-platform.firebasestorage.app");
  assert.equal((await bucket.file(stored.originalPath).exists())[0], true);
  assert.equal((await bucket.file(stored.previewPath).exists())[0], true);
  assert.equal((await mutate(endpoint, "DELETE", body)).status, 200);
  assert.equal((await mutate(endpoint, "DELETE", body)).status, 200);
  const after = (await ref.get()).data();
  assert.equal(after.coverAssetId, first.id);
  assert.equal(after.assetCount, 1);
  assert.equal(after.revision, art.revision);
  assert.deepEqual(after.input, input);
  assert.equal((await secondDoc.get()).data().status, "deleted");
  assert.equal(
    (await ref.collection("events").where("kind", "==", "image-removed").get())
      .size,
    1,
  );
  assert.equal(
    (await request(endpoint, { headers: { Cookie: ownerCookie } })).status,
    404,
  );
  assert.equal(
    (
      await request(endpoint + "?download=1", {
        headers: { Cookie: ownerCookie },
      })
    ).status,
    404,
  );
  assert.equal((await upload(secondUpload)).status, 409);
  // Verify physical storage deletion through the authenticated emulator admin SDK.
  assert.equal((await bucket.file(stored.originalPath).exists())[0], false);
  assert.equal((await bucket.file(stored.previewPath).exists())[0], false);
  check(
    "removal deletes both files, updates the cover once, preserves metadata, and cannot be undone by an upload retry",
  );
  const firstDoc = ref.collection("assets").doc(first.id);
  // Simulate restart after the removal transaction, before storage cleanup.
  await firstDoc.update({ status: "deleting" });
  await ref.update({ assetCount: 0, coverAssetId: null });
  const pending = await (
    await request(`${url}/assets`, { headers: { Cookie: ownerCookie } })
  ).json();
  assert.equal(pending.assets[0].removalPending, true);
  const legal = await (
    await request(`${url}/assets`, { headers: { Cookie: legalCookie } })
  ).json();
  assert.equal(legal.assets.length, 0);
  assert.equal(
    (
      await mutate(`${url}/assets/${first.id}`, "DELETE", {
        operationId: randomUUID(),
      })
    ).status,
    200,
  );
  assert.equal((await ref.get()).data().assetCount, 0);
  assert.equal((await ref.get()).data().coverAssetId, null);
  assert.equal(
    (
      await (
        await request(`${url}/assets`, { headers: { Cookie: ownerCookie } })
      ).json()
    ).assets.length,
    0,
  );
  assert.equal((await upload()).status, 201);
  check(
    "interrupted removal can resume after reload, removing the last image allows a fresh upload",
  );
}
