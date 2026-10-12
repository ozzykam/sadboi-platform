import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

export async function eventChecks({
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
  const accountant = await identity(
      "events-accounting@example.test",
      true,
      "accounting",
    ),
    accountingCookie = session(await signIn(accountant));
  const proof = await csrf(),
    headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: ownerCookie + "; " + proof.cookie,
      "X-CSRF-Token": proof.token,
    };
  const c = (name) => db.collection(`businesses/sadboi/${name}`),
    id = randomUUID(),
    taskId = randomUUID();
  const date = (days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const input = {
    title: "Autumn Art Market",
    kind: "market",
    status: "considering",
    archived: false,
    startDate: date(7),
    endDate: date(8),
    startTime: "10:00",
    endTime: "17:00",
    timezone: "America/Chicago",
    venue: "Example Arts Hall",
    address: "100 Example Avenue",
    city: "Roberts",
    region: "WI",
    country: "United States",
    booth: "Booth B12",
    publicDescription:
      "Meet Sadboi, browse original artwork and pick up prints.",
    eventUrl: "example.com",
    organizer: "SECRET ORGANIZER",
    organizerEmail: "private@example.test",
    applicationUrl: "https://private.example.test/apply",
    notes: "SECRET STAFF NOTES",
    tasks: [
      {
        id: taskId,
        title: "Submit vendor application",
        kind: "application",
        dueDate: date(-1),
        dueTime: "17:00",
        timezone: "UTC",
        status: "todo",
        details: "SECRET DEADLINE DETAILS",
        feeMinor: 2500,
        feeStatus: "unpaid",
        feeReference: "SECRET FEE REFERENCE",
      },
    ],
  };
  const cmd = (action, expectedRevision, extra = {}) => ({
    action,
    expectedRevision,
    id,
    operationId: randomUUID(),
    note: "SECRET HISTORY NOTE",
    ...extra,
  });
  const post = (body, extra = {}) =>
    request("/api/events", {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(body),
    });
  const read = (cookie = ownerCookie, eventId = id) =>
    request(`/api/events?id=${eventId}`, { headers: { Cookie: cookie } });
  const ok = async (promise, status = 200) => {
    const response = await promise,
      body = await response.text();
    assert.equal(response.status, status, body);
    return JSON.parse(body);
  };
  const publicRead = () => ok(request("/api/appearances"));
  const create = cmd("save", 0, { input });
  assert.equal((await read("")).status, 401);
  assert.equal((await read(legalCookie)).status, 403);
  for (const cookie of [accountingCookie, legalCookie])
    assert.equal(
      (await post(create, { Cookie: cookie + "; " + proof.cookie })).status,
      403,
    );
  assert.equal(
    (await post(create, { Origin: "https://foreign.example" })).status,
    403,
  );
  assert.equal((await post(create, { "X-CSRF-Token": "bad" })).status, 403);
  assert.equal((await post({ ...create, published: true })).status, 400);
  assert.equal(
    (
      await post({
        ...create,
        input: { ...input, eventUrl: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  assert.equal((await read(ownerCookie, "not-an-id")).status, 400);
  check(
    "events enforce staff roles, origin/CSRF, safe URLs and strict bounded commands",
  );

  await Promise.all([ok(post(create), 201), ok(post(create), 201)]);
  let detail = await ok(read());
  assert.equal(detail.record.revision, 1);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.record.input.eventUrl, "https://example.com");
  assert.equal((await c("eventState").doc("counts").get()).data().total, 1);
  assert.equal(
    (await post({ ...create, note: "Changed operation content" })).status,
    409,
  );
  assert.equal((await post(cmd("publish", 1))).status, 409);
  assert.equal((await publicRead()).appearances.length, 0);
  await ok(
    post(cmd("save", 1, { input: { ...input, status: "confirmed" } })),
    201,
  );
  assert.equal((await publicRead()).appearances.length, 0);
  const publish = cmd("publish", 2);
  await Promise.all([ok(post(publish), 201), ok(post(publish), 201)]);
  detail = await ok(read());
  assert.equal(detail.record.revision, 3);
  const appearance = (await publicRead()).appearances[0];
  assert.equal(appearance.title, input.title);
  assert.deepEqual(
    Object.keys(appearance).sort(),
    [
      "id",
      "title",
      "kind",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
      "timezone",
      "venue",
      "address",
      "city",
      "region",
      "country",
      "booth",
      "publicDescription",
      "eventUrl",
    ].sort(),
  );
  assert.doesNotMatch(
    JSON.stringify(appearance),
    /SECRET|private@example|applicationUrl|organizer|tasks|notes|fee/,
  );
  const publicPage = await request("/appearances");
  assert.equal(publicPage.status, 200);
  const html = await publicPage.text();
  assert.match(html, /Autumn Art Market/);
  assert.doesNotMatch(html, /SECRET|private@example/);
  check(
    "confirmation stays private; separate idempotent publication exposes only the public allowlist",
  );

  const completedInput = {
    ...detail.record.input,
    tasks: [
      {
        ...detail.record.input.tasks[0],
        status: "done",
        feeStatus: "paid",
        feeReference: "SECRET RECEIPT 123",
      },
    ],
  };
  const done = cmd("save", 3, { input: completedInput });
  await ok(post(done), 201);
  await ok(post(done), 201);
  detail = await ok(read());
  assert.ok(detail.record.completionDates[taskId]);
  assert.ok(detail.record.published);
  assert.equal(detail.history.length, 4);
  assert.equal(
    (await post(cmd("save", 4, { input: { ...completedInput, tasks: [] } })))
      .status,
    409,
  );
  assert.equal(
    (
      await post(
        cmd("save", 4, {
          input: {
            ...completedInput,
            tasks: [{ ...completedInput.tasks[0], feeReference: "" }],
          },
        }),
      )
    ).status,
    400,
  );
  const before = (
    await c("studioEvents").doc(id).collection("history").doc("000003").get()
  ).data();
  assert.equal(before.input.tasks[0].status, "todo");
  check(
    "deadline completion and paid fee evidence are audited separately without exposing or removing private details",
  );

  const race = await Promise.all([
    post(cmd("save", 4, { input: { ...completedInput, venue: "New Hall A" } })),
    post(cmd("save", 4, { input: { ...completedInput, venue: "New Hall B" } })),
  ]);
  assert.deepEqual(race.map((response) => response.status).sort(), [201, 409]);
  assert.equal((await publicRead()).appearances.length, 0);
  detail = await ok(read());
  assert.equal(detail.record.revision, 5);
  await ok(post(cmd("publish", 5)), 201);
  assert.equal((await publicRead()).appearances.length, 1);
  await ok(post(cmd("unpublish", 6)), 201);
  assert.equal((await publicRead()).appearances.length, 0);
  check(
    "competing edits cannot overwrite each other and public-field changes require explicit republication",
  );

  let revision = 7;
  for (const patch of [
    { status: "cancelled" },
    { status: "declined" },
    { archived: true },
  ]) {
    detail = await ok(read());
    await ok(
      post(
        cmd("save", revision++, {
          input: {
            ...detail.record.input,
            status: "confirmed",
            archived: false,
          },
        }),
      ),
      201,
    );
    await ok(post(cmd("publish", revision++)), 201);
    detail = await ok(read());
    await ok(
      post(
        cmd("save", revision++, {
          input: { ...detail.record.input, ...patch },
        }),
      ),
      201,
    );
    assert.equal((await publicRead()).appearances.length, 0);
    assert.equal((await post(cmd("publish", revision))).status, 409);
  }
  detail = await ok(read());
  await ok(
    post(
      cmd("save", revision++, {
        input: {
          ...detail.record.input,
          status: "confirmed",
          archived: false,
          tasks: [{ ...detail.record.input.tasks[0], status: "todo" }],
        },
      }),
    ),
    201,
  );
  detail = await ok(read());
  assert.deepEqual(detail.record.completionDates, {});
  await ok(post(cmd("publish", revision++)), 201);
  check(
    "cancellation, decline and archive withdraw appearances; reopened tasks clear current completion while keeping history",
  );

  const ref = c("studioEvents").doc(id),
    saved = (await ref.get()).data();
  await ref.update({
    "input.startDate": "2020-01-01",
    "input.endDate": "2020-01-02",
    "published.startDate": "2020-01-01",
    "published.endDate": "2020-01-02",
  });
  assert.equal((await publicRead()).appearances.length, 0);
  await ref.set(saved);
  await ref.update({ businessId: "other" });
  assert.equal((await read()).status, 404);
  await ref.update({ businessId: "sadboi" });
  await ref.update({ revision: 200 });
  assert.equal((await post(cmd("unpublish", 200))).status, 400);
  await ref.update({ revision });
  await c("eventState").doc("counts").update({ total: 500 });
  assert.equal(
    (await post(cmd("save", 0, { id: randomUUID(), input }))).status,
    409,
  );
  await c("eventState").doc("counts").update({ total: 1 });
  check(
    "past appearances are omitted, foreign records fail closed and event/history limits are explicit",
  );

  await ok(read(accountingCookie));
  const staffPage = await request(`/admin/events/${id}`, {
    headers: { Cookie: accountingCookie },
  });
  assert.equal(staffPage.status, 200);
  const staffHtml = await staffPage.text();
  assert.match(staffHtml, /Accounting can review/);
  assert.ok(!staffHtml.includes(">Save event</button>"));
  const planner = await request("/admin/events", {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(planner.status, 200);
  assert.match(await planner.text(), /Overdue/);
  assert.equal(
    (await request("/admin/events", { headers: { Cookie: legalCookie } }))
      .status,
    307,
  );
  assert.equal(
    (await request("/admin/events/new", { headers: { Cookie: ownerCookie } }))
      .status,
    307,
  );
  const newId = randomUUID(),
    newForm = await request(`/admin/events/new?id=${newId}`, {
      headers: { Cookie: ownerCookie },
    });
  assert.equal(newForm.status, 200);
  const help = await request("/admin/how-to", {
    headers: { Cookie: ownerCookie },
  });
  assert.match(await help.text(), /id="events"/);
  for (const name of ["storeOrders", "orderEmails", "stockMovements"])
    assert.equal((await c(name).get()).size, 0);
  check(
    "staff planner, stable new-event URL, read-only accounting and public schedule render without commerce/email side effects",
  );

  if (process.argv.includes("--event-preview")) {
    const marker = "web-app/.next-auth-test/event-preview.done";
    try {
      await unlink(marker);
    } catch {}
    await writeFile(
      "web-app/.next-auth-test/event-preview.ready",
      JSON.stringify({
        url: origin + `/admin/events/${id}`,
        publicUrl: origin + "/appearances",
      }),
    );
    console.log("Event browser preview ready.");
    for (let i = 0; i < 1200; i++) {
      try {
        await access(marker);
        break;
      } catch {}
      await delay(500);
    }
  }
}
