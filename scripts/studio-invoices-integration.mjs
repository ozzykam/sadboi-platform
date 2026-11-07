import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function studioInvoiceChecks({
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
      "studio-billing-accounting@example.test",
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
  const post = (body, extra = {}, route = "/api/invoices") =>
    request(route, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  const read = (id, cookie = ownerCookie) =>
    request(`/api/invoices?id=${id}`, { headers: { Cookie: cookie } });
  const ok = async (response, status = 200) => {
    const r = await response,
      text = await r.text();
    assert.equal(r.status, status, text);
    return JSON.parse(text);
  };
  const c = (name) => db.collection(`businesses/sadboi/${name}`);
  const defaults = await ok(
    request("/api/invoice-defaults", { headers: { Cookie: ownerCookie } }),
  );
  assert.equal(defaults.input.dueDays, 30);
  const defaultSave = {
    input: {
      ...defaults.input,
      issuer: {
        name: "Sadboi Studio",
        email: "billing@example.test",
        address: "Test studio address",
      },
      usageTemplate:
        "Posters and tea towels only; other merchandise requires express written permission.",
    },
    expectedRevision: 0,
    operationId: randomUUID(),
  };
  for (const cookie of [legalCookie, accountingCookie])
    assert.equal(
      (
        await post(
          defaultSave,
          { Cookie: cookie + "; " + proof.cookie },
          "/api/invoice-defaults",
        )
      ).status,
      403,
    );
  await Promise.all([
    ok(post(defaultSave, {}, "/api/invoice-defaults"), 201),
    ok(post(defaultSave, {}, "/api/invoice-defaults"), 201),
  ]);
  assert.equal(
    (
      await post(
        { ...defaultSave, input: { ...defaultSave.input, dueDays: 15 } },
        {},
        "/api/invoice-defaults",
      )
    ).status,
    409,
  );
  check("invoice defaults enforce roles and replay-safe saves");
  const invoiceId = randomUUID();
  const input = {
    title: "Flight of the Conchords — custom artwork",
    issuer: defaultSave.input.issuer,
    billTo: {
      name: "Jermaine of Flight of the Conchords",
      email: "",
      address: "",
      confirmed: false,
      contactId: "",
    },
    currency: "USD",
    lines: [
      { description: "Custom poster artwork", quantity: 1, unitMinor: 180000 },
      {
        description: "Custom tea towel artwork",
        quantity: 1,
        unitMinor: 50000,
      },
    ],
    discountMinor: 0,
    taxStatus: "unresolved",
    taxMinor: 0,
    taxNote: "",
    dueDays: 30,
    paymentMethod: "stripe",
    paymentInstructions: defaultSave.input.paymentInstructions,
    stripePaymentUrl: "",
    usage: {
      status: "proposed",
      text: defaultSave.input.usageTemplate,
      acceptanceReference: "",
    },
    agreementReference: "",
    notes: "Client-facing invoice note",
  };
  const cmd = (action, expectedRevision, extra = {}) => ({
    action,
    expectedRevision,
    invoiceId,
    operationId: randomUUID(),
    note: "PRIVATE CHANGE NOTE",
    ...extra,
  });
  const save = cmd("save", 0, { input });
  assert.equal((await read(invoiceId, "")).status, 401);
  assert.equal((await read(invoiceId, legalCookie)).status, 403);
  for (const cookie of [legalCookie, accountingCookie])
    assert.equal(
      (await post(save, { Cookie: cookie + "; " + proof.cookie })).status,
      403,
    );
  assert.equal((await post(save, { "X-CSRF-Token": "invalid" })).status, 403);
  assert.equal(
    (await post(save, { Origin: "https://elsewhere.example" })).status,
    403,
  );
  assert.equal((await post({ ...save, paid: true })).status, 400);
  assert.equal((await read("bad")).status, 400);
  check(
    "standalone invoices enforce authentication, roles, CSRF, origin and strict commands",
  );
  await ok(post(save), 201);
  await ok(post(save), 201);
  let detail = await ok(read(invoiceId));
  assert.equal(detail.invoice.revision, 1);
  assert.equal(detail.history.length, 1);
  assert.equal(
    (await post({ ...save, note: "Different command" })).status,
    409,
  );
  assert.equal((await post(cmd("save", 0, { input }))).status, 409);
  assert.equal((await post(cmd("issue", 1))).status, 409);
  assert.equal((await c("counters").doc("studioInvoice").get()).exists, false);
  const draftPrint = await request(`/admin/invoices/${invoiceId}/print`, {
    headers: { Cookie: ownerCookie },
  });
  const draftHtml = await draftPrint.text();
  assert.equal(draftPrint.status, 200);
  assert.match(draftHtml, /Needs review/);
  assert.match(draftHtml, /Provisional recipient/);
  assert.match(draftHtml, /2,300.00/);
  assert.ok(!draftHtml.includes("PRIVATE CHANGE NOTE"));
  check(
    "incomplete drafts save without agreements; issuance requires resolved tax and recipient; print labels incomplete details",
  );
  const ready = {
    ...input,
    billTo: { ...input.billTo, confirmed: true },
    taxStatus: "not_applicable",
    taxNote: "Fictional test tax treatment",
    stripePaymentUrl: "https://buy.stripe.com/test_emulator",
  };
  const race = await Promise.all([
    post(cmd("save", 1, { input: ready })),
    post(cmd("save", 1, { input: ready })),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  // An older draft saved late in Chicago must retain that local date on issue.
  await c("studioInvoices").doc(invoiceId).update({
    updatedAt: "2026-01-07T02:30:00.000Z",
  });
  const issue = cmd("issue", 2);
  await Promise.all([ok(post(issue), 201), ok(post(issue), 201)]);
  detail = await ok(read(invoiceId));
  const issued = detail.invoice;
  assert.equal(issued.revision, 3);
  assert.equal(issued.number, "260106-JER-001");
  assert.equal(
    (await c("counters").doc("studioInvoice").get()).data().value,
    1,
  );
  const due = new Date(issued.issuedAt.slice(0, 10) + "T00:00:00.000Z");
  due.setUTCDate(due.getUTCDate() + 30);
  assert.equal(issued.dueDate, due.toISOString().slice(0, 10));
  assert.equal((await post(cmd("save", 3, { input: ready }))).status, 409);
  await ok(
    post(
      {
        ...defaultSave,
        expectedRevision: 1,
        operationId: randomUUID(),
        input: {
          ...defaultSave.input,
          issuer: { ...defaultSave.input.issuer, name: "Changed default name" },
          dueDays: 15,
        },
      },
      {},
      "/api/invoice-defaults",
    ),
    201,
  );
  assert.deepEqual((await ok(read(invoiceId))).invoice.input, ready);
  check(
    "concurrency protects edits and numbering; net-30 starts on issue; defaults cannot change issued snapshots",
  );
  const payment = cmd("recordPayment", 3, {
    payment: {
      amountMinor: 50000,
      receivedDate: issued.issuedAt.slice(0, 10),
      method: "stripe",
      reference: "PRIVATE STRIPE REFERENCE",
    },
  });
  await Promise.all([ok(post(payment), 201), ok(post(payment), 201)]);
  assert.equal((await ok(read(invoiceId))).invoice.number, issued.number);
  assert.equal(
    (await post({ ...payment, operationId: randomUUID(), expectedRevision: 4 }))
      .status,
    409,
  );
  assert.equal(
    (
      await post(
        cmd("recordPayment", 4, {
          payment: {
            ...payment.payment,
            reference: "Other",
            amountMinor: 180001,
          },
        }),
      )
    ).status,
    409,
  );
  assert.equal((await post(cmd("void", 4))).status, 409);
  const printed = await request(`/admin/invoices/${invoiceId}/print`, {
    headers: { Cookie: accountingCookie },
  });
  const html = await printed.text();
  assert.equal(printed.status, 200);
  assert.match(html, /1,800.00/);
  assert.match(html, /Awaiting client approval/);
  for (const secret of ["PRIVATE CHANGE NOTE", "PRIVATE STRIPE REFERENCE"])
    assert.ok(!html.includes(secret));
  for (const suffix of ["", "/print"])
    assert.equal(
      (
        await request(`/admin/invoices/${invoiceId}${suffix}`, {
          headers: { Cookie: legalCookie },
        })
      ).status,
      307,
    );
  const accountPage = await request(`/admin/invoices/${invoiceId}`, {
    headers: { Cookie: accountingCookie },
  });
  assert.match(await accountPage.text(), /Accounting can review and print/);
  check(
    "payment retries record once, duplicate and excessive payments fail, print access is restricted and private evidence stays private",
  );
  const reverse = cmd("reversePayment", 4, { paymentId: payment.operationId });
  await ok(post(reverse), 201);
  await ok(post(reverse), 201);
  await ok(post(cmd("void", 5)), 201);
  detail = await ok(read(invoiceId));
  assert.equal(detail.invoice.state, "void");
  assert.equal(detail.invoice.number, issued.number);
  assert.equal(
    (
      await c("studioInvoices")
        .doc(invoiceId)
        .collection("history")
        .doc("000004")
        .get()
    ).data().invoice.payments[0].reversedAt,
    null,
  );
  assert.equal(
    (await post(cmd("recordPayment", 6, { payment: payment.payment }))).status,
    409,
  );
  check(
    "reversal preserves history; void retains invoice numbers and blocks payments",
  );
  const secondId = randomUUID(),
    thirdId = randomUUID();
  for (const id of [secondId, thirdId])
    await ok(post(cmd("save", 0, { invoiceId: id, input: ready })), 201);
  await Promise.all([
    ok(post(cmd("issue", 1, { invoiceId: secondId })), 201),
    ok(post(cmd("issue", 1, { invoiceId: thirdId })), 201),
  ]);
  assert.notEqual(
    (await ok(read(secondId))).invoice.number,
    (await ok(read(thirdId))).invoice.number,
  );
  await c("studioInvoices").doc(thirdId).update({ businessId: "foreign" });
  assert.equal((await read(thirdId)).status, 404);
  await c("studioInvoices").doc(thirdId).update({ businessId: "sadboi" });
  const agreedId = randomUUID();
  await ok(
    post(
      cmd("save", 0, {
        invoiceId: agreedId,
        input: {
          ...ready,
          usage: {
            ...ready.usage,
            status: "agreed",
            acceptanceReference: "PRIVATE APPROVAL EVIDENCE",
          },
        },
      }),
    ),
    201,
  );
  const agreedPrint = await request(`/admin/invoices/${agreedId}/print`, {
    headers: { Cookie: ownerCookie },
  });
  assert.ok(!(await agreedPrint.text()).includes("PRIVATE APPROVAL EVIDENCE"));
  for (const name of [
    "storeOrders",
    "stockMovements",
    "orderEmails",
    "commissionBilling",
    "commissionAgreements",
  ])
    assert.equal((await c(name).get()).size, 0);
  const newPage = await request(
    "/admin/invoices/new?starter=flight-of-the-conchords",
    { headers: { Cookie: ownerCookie } },
  );
  assert.equal(newPage.status, 200);
  const newHtml = await newPage.text();
  assert.match(newHtml, /Jermaine of Flight/);
  assert.match(newHtml, /2,300.00/);
  check(
    "cross-invoice numbering is atomic, foreign data fails closed, starter works and no agreements, stock, orders or emails are created",
  );
  if (process.argv.includes("--invoice-preview")) {
    const marker = "web-app/.next-auth-test/invoice-preview.done";
    try {
      await unlink(marker);
    } catch {}
    await writeFile(
      "web-app/.next-auth-test/invoice-preview.ready",
      JSON.stringify({
        url: origin + `/admin/invoices/${secondId}`,
        draftUrl: origin + `/admin/invoices/${agreedId}`,
      }),
    );
    console.log("Invoice browser preview ready.");
    for (let i = 0; i < 1800; i++) {
      try {
        await access(marker);
        break;
      } catch {}
      await delay(500);
    }
  }
}
