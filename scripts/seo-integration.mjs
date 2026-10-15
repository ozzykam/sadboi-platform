import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, unlink, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function seoChecks({
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
  const accountantCookie = session(
    await signIn(
      await identity("seo-accountant@example.test", true, "accounting"),
    ),
  );
  const read = (cookie = ownerCookie) =>
    request("/api/seo", { headers: { Cookie: cookie } });
  const post = async (body, cookie = ownerCookie) => {
    const proof = await csrf();
    return request("/api/seo", {
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
  const ok = async (promise, status = 200) => {
    const response = await promise;
    const text = await response.text();
    assert.equal(response.status, status, text);
    return JSON.parse(text);
  };
  assert.equal((await request("/api/seo")).status, 401);
  for (const cookie of [legalCookie, accountantCookie]) {
    assert.equal((await read(cookie)).status, 403);
    assert.equal((await post({}, cookie)).status, 403);
    assert.equal(
      (await request("/admin/settings/seo", { headers: { Cookie: cookie } }))
        .status,
      307,
    );
  }
  assert.equal(
    (
      await request("/api/seo", {
        method: "POST",
        headers: {
          Cookie: ownerCookie,
          Origin: "https://attacker.example",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  check("SEO read/write and settings page enforce super-admin access and CSRF");

  const initial = await ok(read());
  assert.equal(initial.revision, 0);
  assert.equal(initial.input.indexingEnabled, false);
  assert.equal(initial.input.siteUrl, "https://sadboi.art");
  const input = {
    ...initial.input,
    siteUrl: "https://studio.example.com",
    indexingEnabled: true,
    googleVerification: "seo_fixture_verification",
    homeTitle: "Sadboi SEO fixture — original artwork",
    homeDescription:
      "Browse original artwork and editions by Joel Hedstrom, with upcoming public appearances and ways to contact Sadboi Studios.",
  };
  const command = { input, expectedRevision: 0, operationId: randomUUID() };
  await ok(post(command), 201);
  await ok(post(command), 201);
  assert.equal((await ok(read())).revision, 1);
  assert.equal(
    (
      await post({
        ...command,
        input: { ...input, homeTitle: "Changed operation payload" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await post({ ...command, operationId: randomUUID() })).status,
    409,
  );
  check(
    "SEO settings persist, retry once, and reject reused payloads and stale revisions",
  );

  for (const patch of [
    { siteUrl: "https://localhost" },
    { googleVerification: '<meta content="injected">' },
    { homeTitle: "x" },
    { siteUrl: "" },
  ]) {
    assert.equal(
      (
        await post({
          input: { ...input, ...patch },
          expectedRevision: 1,
          operationId: randomUUID(),
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await post({
        input,
        expectedRevision: 1,
        operationId: randomUUID(),
        extra: "invalid",
      })
    ).status,
    400,
  );
  const race = await Promise.all([
    post({
      input: { ...input, homeTitle: "Sadboi SEO fixture — version A" },
      expectedRevision: 1,
      operationId: randomUUID(),
    }),
    post({
      input: { ...input, homeTitle: "Sadboi SEO fixture — version B" },
      expectedRevision: 1,
      operationId: randomUUID(),
    }),
  ]);
  assert.deepEqual(race.map((response) => response.status).sort(), [201, 409]);
  const latest = await ok(read());
  assert.equal(latest.revision, 2);
  const audit = await db
    .collection("businesses/sadboi/inventoryAudit")
    .where("resource", "==", "seo")
    .get();
  assert.equal(audit.size, 2);
  check(
    "SEO fields are bounded and concurrent saves produce one audited revision",
  );

  const html = async (url, cookie) => {
    const response = await request(url, {
      headers: {
        "User-Agent": "Twitterbot",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    assert.equal(response.status, 200, url);
    return response.text();
  };
  const home = await html("/");
  assert.ok(home.includes(`<title>${latest.input.homeTitle}</title>`));
  const canonical = home.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical, "Homepage should emit a canonical link");
  assert.equal(new URL(canonical).href, "https://studio.example.com/");
  assert.match(home, /name="robots" content="noindex, follow"/);
  assert.ok(
    home.includes(
      'property="og:image" content="https://studio.example.com/images/shared-image.webp"',
    ),
  );
  assert.ok(home.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(
    home.includes(
      'name="google-site-verification" content="seo_fixture_verification"',
    ),
  );
  assert.match(home, /type="application\/ld\+json"/);
  assert.ok(home.includes('"@type":"WebSite"'));
  assert.ok(home.includes('class="entrance"'));
  check(
    "homepage emits saved metadata, canonical, social image, verification and website structured data",
  );
  const artworkId = "a".repeat(64),
    artworkSlug = `seo-artwork-${artworkId}`;
  const galleryRef = db.doc(`businesses/sadboi/gallery/${artworkId}`);
  await galleryRef.set({
    published: true,
    work: {
      id: artworkId,
      slug: artworkSlug,
      title: "Published SEO artwork",
      series: "",
      year: 2026,
      medium: "Digital illustration",
      description: "A public description of this original artwork.",
      tags: [],
      alt: "A colorful abstract illustration",
      caption: "",
      credits: "",
      order: 0,
      width: 1200,
      height: 1600,
    },
    privateNote: "PRIVATE-SEO-FIXTURE",
  });
  const artwork = await html(`/art/${artworkSlug}`);
  assert.ok(
    artwork.includes(
      `rel="canonical" href="https://studio.example.com/art/${artworkSlug}"`,
    ),
  );
  assert.ok(
    artwork.includes(
      `property="og:image" content="https://studio.example.com/api/gallery/images/${artworkId}?w=960"`,
    ),
  );
  assert.ok(!artwork.includes("PRIVATE-SEO-FIXTURE"));
  await galleryRef.update({ published: false });
  const unpublished = await request(`/art/${artworkSlug}`, {
    headers: { "User-Agent": "Twitterbot" },
  });
  // Next's streamed not-found UI can retain HTTP 200; it must emit noindex
  // and must never retain the previously published content or canonical.
  assert.ok([200, 404].includes(unpublished.status));
  const withdrawnHtml = await unpublished.text();
  assert.match(withdrawnHtml, /name="robots" content="noindex/);
  assert.ok(!withdrawnHtml.includes("Published SEO artwork"));
  assert.ok(!withdrawnHtml.includes(`rel="canonical" href="https://studio.example.com/art/${artworkSlug}"`));
  check(
    "artwork metadata uses the public projection and disappears when unpublished",
  );
  for (const path of ["/art", "/shop", "/appearances", "/contact"]) {
    const body = await html(path);
    assert.ok(
      body.includes(`rel="canonical" href="https://studio.example.com${path}"`),
      path,
    );
    assert.match(body, /name="robots" content="noindex, follow"/);
  }
  for (const [path, cookie] of [
    ["/sign-in"],
    ["/admin/settings/seo", ownerCookie],
  ]) {
    const body = await html(path, cookie);
    assert.match(body, /name="robots" content="noindex, nofollow"/);
    assert.ok(!body.includes('rel="canonical"'));
  }
  const robots = await (await request("/robots.txt")).text();
  assert.match(robots, /Allow: \//);
  assert.ok(!robots.includes("Sitemap:"));
  const sitemap = await (await request("/sitemap.xml")).text();
  assert.ok(!sitemap.includes("<loc>"));
  const oldSocial = await request("/social-image");
  assert.equal(oldSocial.status, 307);
  assert.equal(new URL(oldSocial.headers.get("location"), origin).pathname, "/images/shared-image.webp");
  const social = await request("/images/shared-image.webp");
  assert.equal(social.status, 200);
  assert.equal(social.headers.get("content-type"), "image/webp");
  const image = Buffer.from(await social.arrayBuffer());
  assert.deepEqual(image, await readFile("web-app/public/images/shared-image.webp"));
  check(
    "public pages have distinct canonicals; private and development pages remain noindex; sharing image renders",
  );

  if (process.argv.includes("--seo-preview")) {
    const marker = "web-app/.next-auth-test/seo-preview.done";
    try {
      await unlink(marker);
    } catch {}
    console.log("SEO browser preview ready: " + origin + "/admin/settings/seo");
    for (let i = 0; i < 1200; i++) {
      try {
        await access(marker);
        break;
      } catch {}
      await delay(500);
    }
  }
}
