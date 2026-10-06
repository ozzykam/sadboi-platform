import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { access as fileAccess, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
export async function agreementChecks({
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
  const accounting = await identity(
      "agreement-accounting@example.test",
      true,
      "accounting",
    ),
    accountingCookie = session(await signIn(accounting));
  const proof = await csrf(),
    headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: ownerCookie + "; " + proof.cookie,
      "X-CSRF-Token": proof.token,
    };
  const c = (name) => db.collection(`businesses/sadboi/${name}`);
  const token = () => randomBytes(32).toString("hex");
  const proposalId = token(),
    contactId = token(),
    source = { proposalId };
  const proposal = {
    title: "Agreement example",
    scope: "Create an original cover",
    deliverables: "One image",
    timeline: "Two weeks",
    revisionPolicy: "Two revisions",
    terms: "Reviewed example terms",
    validUntil: "2099-12-31",
    currency: "USD",
    lines: [{ description: "Illustration", quantity: 1, unitMinor: 55000 }],
    discountMinor: 0,
    taxMinor: 0,
    taxStatus: "not_applicable",
    taxNote: "Fictional test example",
  };
  const client = {
    id: contactId,
    name: "Test Client",
    email: "client@example.test",
  };
  await c("contacts")
    .doc(contactId)
    .set({ businessId: "sadboi", input: { status: "active" } });
  await c("commissionProposals")
    .doc(proposalId)
    .set({
      businessId: "sadboi",
      input: proposal,
      client,
      number: "PR-TEST",
      version: 1,
      state: "accepted",
      responseReference: "PRIVATE RESPONSE",
      updatedAt: new Date().toISOString(),
    });
  const input = {
    title: "Test agreement",
    body: "Reviewed fictional agreement terms for this test only.",
    effectiveDate: "2026-10-05",
    expiresDate: "",
    currency: "USD",
    totalMinor: 55000,
  };
  const cmd = (action, expectedRevision, extra = {}) => ({
    action,
    source,
    operationId: randomUUID(),
    expectedRevision,
    note: "PRIVATE STAFF NOTE",
    ...extra,
  });
  const post = (command, extra = {}) =>
    request("/api/agreements", {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(command),
    });
  const read = (cookie = ownerCookie) =>
    request(`/api/agreements?proposalId=${proposalId}`, {
      headers: { Cookie: cookie },
    });
  const access = (command, extra = {}) =>
    request("/api/agreement-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...extra },
      body: JSON.stringify(command),
    });
  const ok = async (promise, status = 200) => {
    const res = await promise;
    assert.equal(res.status, status, await res.clone().text());
    return res.json();
  };
  for (const [cookie, status] of [
    ["", 401],
    [legalCookie, 200],
    [accountingCookie, 200],
  ])
    assert.equal((await read(cookie)).status, status);
  const first = cmd("save", 0, { input });
  assert.equal(
    (await post(first, { Cookie: accountingCookie + "; " + proof.cookie }))
      .status,
    403,
  );
  assert.equal(
    (await post(first, { Origin: "https://attacker.example" })).status,
    403,
  );
  assert.equal((await post(first, { "X-CSRF-Token": "bad" })).status, 403);
  const legalHeaders = { Cookie: legalCookie + "; " + proof.cookie };
  await ok(post(first, legalHeaders), 201);
  await ok(post(first, legalHeaders), 201);
  assert.equal(
    (
      await post(
        { ...first, input: { ...input, title: "Changed" } },
        legalHeaders,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await c("commissionAgreements")
        .doc(proposalId)
        .collection("history")
        .get()
    ).size,
    1,
  );
  check(
    "agreement role and CSRF checks allow legal, deny accounting writes, and deduplicate saves",
  );
  assert.equal(
    (await post(cmd("save", 1, { input: { ...input, totalMinor: 1 } }))).status,
    409,
  );
  const competing = await Promise.all([
    post(cmd("save", 1, { input })),
    post(cmd("save", 1, { input })),
  ]);
  assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
  const firstToken = token(),
    invitation = cmd("invite", 2, { token: firstToken });
  await ok(post(invitation), 201);
  await ok(post(invitation), 201);
  const ref = c("commissionAgreements").doc(proposalId);
  let saved = (await ref.get()).data();
  assert.equal(saved.revision, 3);
  assert.notEqual(saved.invitationHash, firstToken);
  assert.equal(JSON.stringify(saved).includes(firstToken), false);
  let document = await ok(
    access({ action: "read", proposalId, token: firstToken }),
  );
  assert.deepEqual(document.proposalSnapshot, proposal);
  assert.equal(JSON.stringify(document).includes("PRIVATE"), false);
  assert.equal(document.client.id, undefined);
  assert.equal(document.invitationHash, undefined);
  assert.equal(
    (await access({ action: "read", proposalId, token: token() })).status,
    404,
  );
  assert.equal(
    (await access({ action: "read", proposalId: token(), token: firstToken }))
      .status,
    404,
  );
  assert.equal(
    (
      await access(
        { action: "read", proposalId, token: firstToken },
        { Origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/agreement-access?token=" + firstToken)).status,
    405,
  );
  assert.equal((await post(cmd("save", 3, { input }))).status, 409);
  check(
    "invitation binds a frozen proposal and hashes secrets; public access excludes private data and rejects guesses/cross-origin requests",
  );
  await ref.update({ invitationExpiresAt: "2000-01-01T00:00:00.000Z" });
  assert.equal(
    (await access({ action: "read", proposalId, token: firstToken })).status,
    404,
  );
  const secondToken = token();
  await ok(post(cmd("invite", 3, { token: secondToken })), 201);
  assert.equal(
    (await access({ action: "read", proposalId, token: firstToken })).status,
    404,
  );
  await ok(post(cmd("reopen", 4)), 201);
  assert.equal(
    (await access({ action: "read", proposalId, token: secondToken })).status,
    404,
  );
  await ok(
    post(
      cmd("save", 5, {
        input: { ...input, body: input.body + " Revised terms." },
      }),
    ),
    201,
  );
  const finalToken = token();
  await ok(post(cmd("invite", 6, { token: finalToken })), 201);
  document = await ok(
    access({ action: "read", proposalId, token: finalToken }),
  );
  const sign = {
    action: "sign",
    proposalId,
    token: finalToken,
    operationId: randomUUID(),
    expectedRevision: 7,
    documentHash: document.documentHash,
    signerName: "Test Client",
    signedDate: new Date().toISOString().slice(0, 10),
    consent: true,
  };
  for (const patch of [{ consent: false }, { signedDate: "2099-01-01" }])
    assert.equal((await access({ ...sign, ...patch })).status, 400);
  assert.equal(
    (await access({ ...sign, documentHash: "f".repeat(64) })).status,
    409,
  );
  assert.equal((await access({ ...sign, expectedRevision: 3 })).status, 409);
  const signed = await Promise.all([ok(access(sign)), ok(access(sign))]);
  assert.deepEqual(signed[0], signed[1]);
  assert.equal(signed[0].state, "signed");
  assert.equal(signed[0].signatureMethod, "client_link");
  assert.match(signed[0].consentText, /electronic signature/);
  assert.equal((await ref.collection("history").get()).size, 8);
  assert.equal(
    (await access({ ...sign, signerName: "Someone Else" })).status,
    409,
  );
  assert.equal(
    (await access({ ...sign, operationId: randomUUID() })).status,
    409,
  );
  assert.equal((await post(cmd("reopen", 8))).status, 409);
  assert.equal((await post(cmd("save", 8, { input }))).status, 409);
  saved = (await ref.get()).data();
  assert.equal(saved.signedDocumentHash, document.documentHash);
  assert.deepEqual(saved.proposalSnapshot, proposal);
  check(
    "expired/replaced/revoked links fail; consent, dates, document hash and revisions are checked; concurrent signature retries commit once",
  );
  const signedSnapshot = (
    await ref.collection("history").doc("000008").get()
  ).data();
  await ok(post(cmd("void", 8)), 201);
  assert.equal(
    (await access({ action: "read", proposalId, token: finalToken })).status,
    404,
  );
  assert.deepEqual(
    (await ref.collection("history").doc("000008").get()).data(),
    signedSnapshot,
  );
  assert.equal(
    (await ref.get()).data().signedDocumentHash,
    document.documentHash,
  );
  for (const cookie of [ownerCookie, legalCookie, accountingCookie]) {
    const page = await request(
      `/admin/projects/agreement?proposalId=${proposalId}`,
      { headers: { Cookie: cookie } },
    );
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Agreement history/);
    if (cookie === legalCookie)
      assert.equal(html.includes("Back to proposal"), false);
    assert.equal(
      (await request("/admin/agreements", { headers: { Cookie: cookie } }))
        .status,
      200,
    );
  }
  const publicPage = await request("/agreement");
  assert.equal(publicPage.status, 200);
  assert.equal((await publicPage.text()).includes("PRIVATE"), false);
  for (const name of ["storeOrders", "orderEmails", "stockMovements"])
    assert.equal((await c(name).get()).size, 0);
  check(
    "void preserves signed history; staff pages and legal help render; public page leaks no details and no commerce/email effects occur",
  );
  // Separate agreement exercises external signature and concurrent revoke/sign.
  const otherId = token();
  await c("commissionProposals")
    .doc(otherId)
    .set({
      businessId: "sadboi",
      input: proposal,
      client,
      number: "PR-TEST2",
      version: 1,
      state: "draft",
    });
  assert.equal(
    (
      await post({
        ...cmd("save", 0, { input }),
        source: { proposalId: otherId },
      })
    ).status,
    409,
  );
  await c("commissionProposals").doc(otherId).update({ state: "accepted" });
  const otherCmd = (action, rev, extra = {}) => ({
    ...cmd(action, rev, extra),
    source: { proposalId: otherId },
  });
  await ok(post(otherCmd("save", 0, { input })), 201);
  const otherToken = token();
  await ok(post(otherCmd("invite", 1, { token: otherToken })), 201);
  const otherDoc = await ok(
    access({ action: "read", proposalId: otherId, token: otherToken }),
  );
  const race = await Promise.all([
    post(otherCmd("reopen", 2)),
    access({
      ...sign,
      proposalId: otherId,
      token: otherToken,
      documentHash: otherDoc.documentHash,
      expectedRevision: 2,
      operationId: randomUUID(),
    }),
  ]);
  assert.equal(
    race.filter((r) => r.status === 200 || r.status === 201).length,
    1,
  );
  const otherRef = c("commissionAgreements").doc(otherId);
  if ((await otherRef.get()).data().state === "draft") {
    await ok(post(otherCmd("invite", 3, { token: token() })), 201);
    await ok(
      post(
        otherCmd("recordSignature", 4, {
          signerName: "External Client",
          signedDate: sign.signedDate,
          evidence: "PRIVATE EXTERNAL EVIDENCE",
        }),
      ),
      201,
    );
    assert.equal(
      (await otherRef.get()).data().signatureMethod,
      "staff_recorded",
    );
  }
  check(
    "only accepted proposals create agreements and concurrent signing/revocation cannot both commit",
  );
  if (process.argv.includes("--agreement-preview")) {
    const previewId = token(), previewToken = token();
    await c("commissionProposals").doc(previewId).set({
      businessId: "sadboi", input: proposal, client, number: "PR-PREVIEW",
      version: 1, state: "accepted", updatedAt: new Date().toISOString(),
    });
    await ok(post({ ...cmd("save", 0, { input }), source: { proposalId: previewId } }), 201);
    await ok(post({ ...cmd("invite", 1, { token: previewToken }), source: { proposalId: previewId } }), 201);
    const marker = "web-app/.next-auth-test/agreement-preview.done";
    try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/agreement-preview.ready", JSON.stringify({
      url: origin + "/agreement#" + previewId + "." + previewToken,
    }));
    console.log("Agreement browser preview ready.");
    for (let i = 0; i < 1200; i++) {
      try { await fileAccess(marker); break; } catch {}
      await delay(500);
    }
  }
}
