import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { access, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const fromWeb = createRequire(
  new URL("../web-app/package.json", import.meta.url),
);
const sharp = fromWeb("sharp");

export async function galleryChecks({
  request,
  csrf,
  ownerCookie,
  legalCookie,
  db,
  check,
  origin,
}) {
  assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:9199");
  async function mutate(url, body, cookie = ownerCookie, method = "PATCH") {
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
  const source = {
    title: "Gallery integration original",
    series: "Gallery tests",
    year: 2026,
    medium: "Digital painting",
    description: "A public artwork story.",
    status: "draft",
    rights: "owned",
    tags: ["night"],
    pixelWidth: 2000,
    pixelHeight: 1000,
    colorProfile: "sRGB",
    internalNotes: "GALLERY_PRIVATE_SENTINEL",
  };
  const create = await mutate(
    "/api/artworks",
    { input: source, operationId: randomUUID() },
    ownerCookie,
    "POST",
  );
  assert.equal(create.status, 201);
  let art = (await create.json()).artwork;
  const url = `/api/artworks/${art.id}`,
    publishUrl = `${url}/gallery`,
    imageUrl = `/api/gallery/images/${art.id}`;
  const bytes = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#873543" },
  })
    .png()
    .toBuffer();
  const proof = await csrf();
  const upload = await request(`${url}/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      Origin: origin,
      Cookie: ownerCookie + "; " + proof.cookie,
      "X-CSRF-Token": proof.token,
      "X-Upload-ID": randomUUID(),
      "X-File-Name": "gallery-fixture.png",
    },
    body: bytes,
  });
  assert.equal(upload.status, 201, await upload.clone().text());
  const asset = (await upload.json()).asset;
  const input = {
    published: true,
    assetId: asset.id,
    alt: "An emulator-only red rectangle.",
    caption: "Display caption",
    credits: "Test artist",
    order: 5,
    rightsConfirmed: true,
  };
  const publish = (
    changes = {},
    revision = art.revision,
    key = randomUUID(),
    cookie = ownerCookie,
  ) =>
    mutate(
      publishUrl,
      { input: { ...input, ...changes }, revision, operationId: key },
      cookie,
    );
  async function edit(changes) {
    Object.assign(source, changes);
    const result = await mutate(url, {
      input: source,
      revision: art.revision,
      operationId: randomUUID(),
    });
    assert.equal(result.status, 200, await result.clone().text());
    art = (await result.json()).artwork;
  }
  assert.equal((await request(imageUrl)).status, 404);
  assert.equal(
    (
      await request(publishUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  );
  assert.equal(
    (await publish({}, art.revision, randomUUID(), legalCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(publishUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: ownerCookie,
        },
        body: "{}",
      })
    ).status,
    403,
  );
  check(
    "gallery publication requires super-admin access and CSRF; private images are absent",
  );
  assert.equal((await publish()).status, 400);
  await edit({ status: "ready", rights: "review" });
  assert.equal((await publish()).status, 400);
  await edit({ rights: "owned" });
  assert.equal((await publish({ assetId: "0".repeat(64) })).status, 400);
  assert.equal((await publish({ alt: "" })).status, 400);
  assert.equal((await publish({ rightsConfirmed: false })).status, 400);
  assert.equal((await publish({ originalPath: "/private" })).status, 400);
  check(
    "drafts, unresolved rights, missing images, missing descriptions, and injected paths cannot publish",
  );
  const revision = art.revision,
    key = randomUUID();
  const result = await publish({}, revision, key);
  assert.equal(result.status, 200, await result.clone().text());
  art = (await result.json()).artwork;
  const slug = art.gallery.slug,
    detail = `/art/${slug}`;
  const eventCount = (
    await db
      .doc(`businesses/sadboi/artworks/${art.id}`)
      .collection("events")
      .get()
  ).size;
  const retry = await publish({}, revision, key);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).artwork.revision, art.revision);
  assert.equal(
    (
      await db
        .doc(`businesses/sadboi/artworks/${art.id}`)
        .collection("events")
        .get()
    ).size,
    eventCount,
  );
  assert.equal((await publish({}, revision)).status, 409);
  check("publishing is revision-checked, audited, and safe to retry");
  const gallery = await request("/art"),
    galleryHtml = await gallery.text();
  assert.equal(gallery.status, 200);
  assert.ok(galleryHtml.includes(source.title));
  const page = await request(detail),
    html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes(source.description));
  assert.ok(html.includes("Display caption"));
  for (const privateValue of [
    source.internalNotes,
    "originalPath",
    "previewPath",
    "sha256",
  ]) {
    assert.ok(!html.includes(privateValue));
    assert.ok(!galleryHtml.includes(privateValue));
  }
  const image = await request(imageUrl + "?w=480");
  assert.equal(image.status, 200);
  assert.match(image.headers.get("cache-control"), /no-store/);
  const imageBytes = Buffer.from(await image.arrayBuffer()),
    meta = await sharp(imageBytes).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 480);
  assert.equal(meta.height, 240);
  assert.notDeepEqual(imageBytes, bytes);
  assert.equal(
    (await request(`${url}/assets/${asset.id}?download=1`)).status,
    401,
  );
  assert.equal((await request(imageUrl + "?w=99999")).status, 400);
  assert.equal((await request(`/art/wrong-${art.id}`)).status, 404);
  check(
    "anonymous gallery pages expose only public fields and bounded display images, never originals",
  );
  assert.ok(
    (await (await request("/art?q=night")).text()).includes(source.title),
  );
  assert.ok(
    !(await (await request("/art?series=unmatched")).text()).includes(
      source.title,
    ),
  );
  assert.ok(
    !(await (await request("/art?medium=unmatched")).text()).includes(
      source.title,
    ),
  );
  check("gallery search, series, and medium filters use published works");
  await edit({
    title: "Revised gallery title",
    description: "Revised public story",
  });
  assert.ok(
    (await (await request(detail)).text()).includes("A public artwork story."),
  );
  // Ordering is a separate, atomic operation; saved story edits stay private.
  const orderUrl = "/api/artworks/gallery-order";
  const artRef = db.doc(`businesses/sadboi/artworks/${art.id}`);
  const publicRef = db.doc(`businesses/sadboi/gallery/${art.id}`);
  const beforeOrder = (await artRef.get()).data();
  const beforePublicOrder = (await publicRef.get()).data();
  const secondId = createHash("sha256").update(randomUUID()).digest("hex");
  const secondRef = db.doc(`businesses/sadboi/artworks/${secondId}`);
  const secondPublicRef = db.doc(`businesses/sadboi/gallery/${secondId}`);
  await secondRef.set({
    ...beforeOrder,
    gallery: { ...beforeOrder.gallery, publishedRevision: art.revision },
  });
  await secondPublicRef.set({
    ...beforePublicOrder,
    work: { ...beforePublicOrder.work, id: secondId },
  });
  const orderBody = {
    operationId: randomUUID(),
    entries: [
      { id: art.id, revision: art.revision, order: 17 },
      { id: secondId, revision: art.revision, order: 2 },
    ],
  };
  assert.equal(
    (
      await request(orderUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderBody),
      })
    ).status,
    401,
  );
  assert.equal((await mutate(orderUrl, orderBody, legalCookie)).status, 403);
  assert.equal(
    (
      await request(orderUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: ownerCookie,
        },
        body: JSON.stringify(orderBody),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await mutate(orderUrl, {
        ...orderBody,
        entries: [{ ...orderBody.entries[0], order: -1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await mutate(orderUrl, { ...orderBody, input: { published: true } }))
      .status,
    400,
  );
  check(
    "gallery ordering requires super-admin access, CSRF, bounded inputs, and order-only fields",
  );
  const staleBatch = {
    ...orderBody,
    operationId: randomUUID(),
    entries: [orderBody.entries[0], { ...orderBody.entries[1], revision: 1 }],
  };
  assert.equal((await mutate(orderUrl, staleBatch)).status, 409);
  assert.deepEqual((await publicRef.get()).data(), beforePublicOrder);
  assert.equal((await artRef.get()).data().revision, art.revision);
  await secondPublicRef.update({ published: false });
  assert.equal((await mutate(orderUrl, orderBody)).status, 409);
  assert.deepEqual((await publicRef.get()).data(), beforePublicOrder);
  await secondPublicRef.update({ published: true });
  check(
    "one stale or unpublished artwork rejects the entire order batch without partial writes",
  );
  const savedOrder = await mutate(orderUrl, orderBody);
  assert.equal(savedOrder.status, 200, await savedOrder.clone().text());
  art = (await savedOrder.json()).artworks.find((item) => item.id === art.id);
  assert.equal(art.gallery.order, 17);
  assert.equal(art.revision, beforeOrder.revision + 1);
  assert.equal(
    art.gallery.publishedRevision,
    beforeOrder.gallery.publishedRevision,
  );
  const secondSaved = (await secondRef.get()).data();
  assert.equal(secondSaved.gallery.publishedRevision, secondSaved.revision);
  assert.equal(secondSaved.gallery.order, 2);
  assert.deepEqual((await artRef.get()).data().input, beforeOrder.input);
  assert.deepEqual((await publicRef.get()).data(), {
    ...beforePublicOrder,
    work: { ...beforePublicOrder.work, order: 17 },
  });
  assert.equal((await secondPublicRef.get()).data().work.order, 2);
  const orderEvents = await artRef
    .collection("events")
    .where("kind", "==", "gallery-order-changed")
    .get();
  assert.equal(orderEvents.size, 1);
  assert.equal(orderEvents.docs[0].data().previousOrder, 5);
  assert.equal(orderEvents.docs[0].data().order, 17);
  check(
    "order saves update both snapshots atomically, retain unpublished edits, and audit the change",
  );
  const orderRetry = await mutate(orderUrl, orderBody);
  assert.equal(orderRetry.status, 200);
  assert.equal(
    (await orderRetry.json()).artworks.find((item) => item.id === art.id)
      .revision,
    art.revision,
  );
  assert.equal(
    (
      await artRef
        .collection("events")
        .where("kind", "==", "gallery-order-changed")
        .get()
    ).size,
    1,
  );
  assert.equal(
    (
      await mutate(orderUrl, {
        ...orderBody,
        entries: [{ ...orderBody.entries[0], order: 18 }],
      })
    ).status,
    409,
  );
  check(
    "retrying an order save is idempotent and request IDs cannot be reused for other changes",
  );
  await secondPublicRef.delete();
  await db.recursiveDelete(secondRef);
  assert.ok(
    (await (await request(detail)).text()).includes("A public artwork story."),
  );
  const update = await publish();
  assert.equal(update.status, 200);
  art = (await update.json()).artwork;
  assert.equal(art.gallery.slug, slug);
  assert.ok(
    (await (await request(detail)).text()).includes("Revised public story"),
  );
  check(
    "studio edits require republishing and title changes preserve artwork URLs",
  );
  const p = db.collection("businesses/sadboi/products");
  await p.doc("d".repeat(64)).set({
    input: {
      artworkId: art.id,
      title: "Public linked print",
      status: "active",
      publication: "public",
    },
  });
  await p.doc("e".repeat(64)).set({
    input: {
      artworkId: art.id,
      title: "PRIVATE_PRODUCT_SENTINEL",
      status: "active",
      publication: "private",
    },
  });
  const linkedHtml = await (await request(detail)).text();
  assert.ok(linkedHtml.includes("Public linked print"));
  assert.ok(!linkedHtml.includes("PRIVATE_PRODUCT_SENTINEL"));
  check(
    "artwork shop links include only public products and do not require stock",
  );
  const withdrawn = await publish({ published: false });
  assert.equal(withdrawn.status, 200);
  art = (await withdrawn.json()).artwork;
  assert.equal((await request(detail)).status, 404);
  assert.equal((await request(imageUrl)).status, 404);
  assert.ok(!(await (await request("/art")).text()).includes(source.title));
  assert.equal(
    (
      await request(`${url}/assets/${asset.id}?download=1`, {
        headers: { Cookie: ownerCookie },
      })
    ).status,
    200,
  );
  check(
    "unpublish removes page, archive entry, and image access while preserving private originals",
  );
  const again = await publish();
  assert.equal(again.status, 200);
  art = (await again.json()).artwork;
  await edit({ status: "archived" });
  assert.equal(art.gallery.published, false);
  assert.equal((await request(imageUrl)).status, 404);
  assert.equal((await request(detail)).status, 404);
  await edit({ status: "ready" });
  assert.equal((await request(imageUrl)).status, 404);
  check(
    "archiving withdraws publication atomically; restoring Ready does not republish",
  );
  const republished = await publish();
  art = (await republished.json()).artwork;
  await edit({ rights: "review" });
  assert.equal((await request(imageUrl)).status, 404);
  check("rights review withdraws a previously published artwork");
  await p.doc("d".repeat(64)).delete();
  await p.doc("e".repeat(64)).delete();
  if (process.argv.includes("--gallery-preview")) {
    // Optional browser inspection on disposable emulators, never live records.
    await edit({ rights: "owned" });
    const preview = await publish();
    assert.equal(preview.status, 200);
    const stopFile = new URL(
      "../web-app/.next-auth-test/gallery-preview.done",
      import.meta.url,
    );
    await rm(stopFile, { force: true });
    console.log(`GALLERY BROWSER PREVIEW: ${origin}${detail}`);
    console.log(
      "Create web-app/.next-auth-test/gallery-preview.done to finish (10-minute maximum).",
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
