import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { access, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
export async function collectionChecks({
  request,
  csrf,
  ownerCookie,
  legalCookie,
  identity,
  signIn,
  session,
  db,
  check,
  origin,
}) {
  const base = "businesses/sadboi/",
    id = () => randomBytes(32).toString("hex");
  const products = (
    await db
      .collection(base + "products")
      .where("input.publication", "==", "public")
      .get()
  ).docs;
  assert.ok(
    products.length >= 2,
    "Run with --product-pages to create shop fixtures.",
  );
  const a = products.find((item) => item.data().imagePath),
    b = products.find((item) => item.id !== a.id);
  const artId = id(),
    assetId = id();
  const work = {
    id: artId,
    slug: `night-study-${artId}`,
    title: "Night Study Artwork",
    series: "Night studies",
    year: 2026,
    medium: "Ink",
    description: "An original work from the collection.",
    tags: [],
    alt: "Purple night study",
    caption: "",
    credits: "",
    order: 0,
    width: 600,
    height: 800,
  };
  await db
    .doc(base + `artworks/${artId}/assets/${assetId}`)
    .set({ status: "ready", previewPath: a.data().imagePath });
  const gallery = db.doc(base + `gallery/${artId}`);
  await gallery.set({ published: true, assetId, work });
  const privateId = id();
  await db
    .doc(base + `products/${privateId}`)
    .set({
      input: {
        ...a.data().input,
        title: "PRIVATE_PRODUCT_SENTINEL",
        publication: "private",
      },
    });
  const accountantCookie = session(
    await signIn(
      await identity("collections-accountant@example.test", true, "accounting"),
    ),
  );
  const write = async (body, cookie = ownerCookie) => {
    const proof = await csrf();
    return request("/api/shop-collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie + "; " + proof.cookie,
        "X-CSRF-Token": proof.token,
      },
      body: JSON.stringify(body),
    });
  };
  const ok = async (response) => {
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).collection;
  };
  assert.equal((await request("/api/shop-collections")).status, 401);
  for (const cookie of [legalCookie, accountantCookie]) {
    assert.equal(
      (await request("/api/shop-collections", { headers: { Cookie: cookie } }))
        .status,
      403,
    );
    assert.equal((await write({}, cookie)).status, 403);
    assert.equal(
      (await request("/admin/collections", { headers: { Cookie: cookie } }))
        .status,
      307,
    );
  }
  assert.equal(
    (
      await request("/api/shop-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: "{}",
      })
    ).status,
    403,
  );
  check("collection management requires super-admin membership and CSRF");
  const input = {
    title: "Night Creatures",
    description: "A curated release of prints and original artwork.",
    productIds: [b.id, a.id],
    artworkIds: [artId],
    order: 3,
  };
  const create = {
    action: "save",
    id: null,
    revision: 0,
    operationId: randomUUID(),
    input,
  };
  let record = await ok(await write(create));
  const ref = db.doc(base + `shopCollections/${record.id}`),
    url = `/shop/collections/${record.id}`;
  const retry = await ok(await write(create));
  assert.equal(retry.id, record.id);
  assert.equal(retry.revision, 1);
  assert.equal((await ref.collection("events").get()).size, 1);
  assert.equal(
    (await write({ ...create, input: { ...input, title: "Altered retry" } }))
      .status,
    409,
  );
  assert.equal((await request(url)).status, 404);
  assert.ok(!(await (await request("/shop")).text()).includes(input.title));
  check("new drafts stay private and repeated creation is idempotent");
  assert.equal(
    (
      await write({
        ...create,
        operationId: randomUUID(),
        input: { ...input, productIds: [a.id, a.id] },
      })
    ).status,
    400,
  );
  assert.equal(
    (await write({ ...create, operationId: randomUUID(), published: true }))
      .status,
    400,
  );
  let empty = await ok(
    await write({
      ...create,
      operationId: randomUUID(),
      input: { ...input, title: "Empty draft", productIds: [], artworkIds: [] },
    }),
  );
  assert.equal(
    (
      await write({
        action: "publish",
        id: empty.id,
        revision: empty.revision,
        operationId: randomUUID(),
      })
    ).status,
    400,
  );
  check(
    "collection commands reject duplicate members, injected publication and empty publication",
  );
  const act = async (action) => {
    record = await ok(
      await write({
        action,
        id: record.id,
        revision: record.revision,
        operationId: randomUUID(),
      }),
    );
  };
  const save = async (changes) => {
    record = await ok(
      await write({
        action: "save",
        id: record.id,
        revision: record.revision,
        operationId: randomUUID(),
        input: { ...record.input, ...changes },
      }),
    );
  };
  await act("publish");
  let html = await (await request(url)).text();
  assert.match(html, /Night Creatures/);
  assert.match(html, /Night Study Artwork/);
  assert.ok(
    html.indexOf(`id="product-${b.id}"`) < html.indexOf(`id="product-${a.id}"`),
  );
  assert.ok(html.includes(`href="https://sadboi.art${url}"`));
  assert.ok(html.includes('name="robots" content="noindex, follow"'));
  assert.ok((await (await request("/shop")).text()).includes(`href="${url}"`));
  check(
    "published collection exposes ordered members, shop navigation and SEO metadata",
  );
  const beforeDraft = record.revision;
  await save({
    title: "DRAFT_TITLE_SENTINEL",
    description: "DRAFT_DESCRIPTION_SENTINEL",
    productIds: [a.id, b.id],
  });
  html = await (await request(url)).text();
  assert.ok(!html.includes("DRAFT_TITLE_SENTINEL"));
  assert.ok(!html.includes("DRAFT_DESCRIPTION_SENTINEL"));
  assert.ok(
    html.indexOf(`id="product-${b.id}"`) < html.indexOf(`id="product-${a.id}"`),
  );
  assert.equal(
    (
      await write({
        action: "publish",
        id: record.id,
        revision: beforeDraft,
        operationId: randomUUID(),
      })
    ).status,
    409,
  );
  await act("publish");
  html = await (await request(url)).text();
  assert.match(html, /DRAFT_TITLE_SENTINEL/);
  assert.ok(
    html.indexOf(`id="product-${a.id}"`) < html.indexOf(`id="product-${b.id}"`),
  );
  check(
    "draft changes do not leak; explicit publication updates saved content and order",
  );
  const revision = record.revision;
  const commands = ["Concurrent A", "Concurrent B"].map((title) => ({
    action: "save",
    id: record.id,
    revision,
    operationId: randomUUID(),
    input: { ...record.input, title },
  }));
  const attempts = await Promise.all(commands.map((command) => write(command)));
  assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 409]);
  const winner = attempts.findIndex((item) => item.status === 200);
  record = await ok(attempts[winner]);
  const eventCount = (await ref.collection("events").get()).size;
  const recovered = await ok(await write(commands[winner]));
  assert.equal(recovered.revision, record.revision);
  assert.equal((await ref.collection("events").get()).size, eventCount);
  check(
    "concurrent edits reject the stale writer and recovery does not duplicate audit events",
  );
  await save({ productIds: [privateId], artworkIds: [] });
  assert.equal(
    (
      await write({
        action: "publish",
        id: record.id,
        revision: record.revision,
        operationId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.ok(!(await (await request(url)).text()).includes(privateId));
  check(
    "collections cannot publish private products or expose draft membership",
  );
  await save(input);
  await act("publish");
  await a.ref.update({ "input.publication": "private" });
  await gallery.update({ published: false });
  html = await (await request(url)).text();
  assert.ok(!html.includes(a.id));
  assert.ok(!html.includes(artId));
  assert.ok(html.includes(b.id));
  await b.ref.update({ "input.status": "archived" });
  assert.equal((await request(url)).status, 404);
  assert.ok(!(await (await request("/shop")).text()).includes(`href="${url}"`));
  check(
    "withdrawn members disappear and fully empty collections leave the shop",
  );
  await a.ref.update({ "input.publication": "public" });
  await b.ref.update({ "input.status": "active" });
  await gallery.update({ published: true });
  await act("unpublish");
  assert.equal((await request(url)).status, 404);
  await act("publish");
  await act("archive");
  assert.equal((await request(url)).status, 404);
  assert.equal(
    (
      await write({
        action: "publish",
        id: record.id,
        revision: record.revision,
        operationId: randomUUID(),
      })
    ).status,
    409,
  );
  await act("restore");
  assert.equal(record.published, false);
  assert.equal((await request(url)).status, 404);
  await act("publish");
  assert.equal((await request("/shop/collections/unknown")).status, 404);
  check(
    "unpublish, archive and restore preserve drafts without accidental republication",
  );
  if (process.argv.includes("--collection-preview")) {
    const stopFile = new URL(
      "../web-app/.next-auth-test/collection-preview.done",
      import.meta.url,
    );
    await rm(stopFile, { force: true });
    console.log(`COLLECTION PREVIEW: ${origin}${url}`);
    console.log(`ADMIN PREVIEW: ${origin}/admin/collections`);
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
