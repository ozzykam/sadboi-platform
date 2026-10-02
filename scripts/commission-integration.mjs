import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
export async function commissionChecks({ request, csrf, ownerCookie, legalCookie, identity, signIn, session, db, check, origin }) {
  const accounting = await identity("commission-accounting@example.test", true, "accounting"), accountingCookie = session(await signIn(accounting));
  const proof = await csrf(), headers = { "Content-Type": "application/json", Origin: origin, Cookie: ownerCookie + "; " + proof.cookie, "X-CSRF-Token": proof.token };
  const post = (body, extra = {}) => request("/api/commissions", { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const ok = async (response, status = 200) => { const r = await response; assert.equal(r.status, status, await r.clone().text()); return r.json(); };
  const read = (kind, id, cookie = ownerCookie) => request(`/api/commissions?kind=${kind}&id=${id}`, { headers: { Cookie: cookie } });
  const directory = () => ok(request("/api/commissions", { headers: { Cookie: ownerCookie } }));
  const c = name => db.collection(`businesses/sadboi/${name}`);
  const contact = { kind: "person", name: "Commission test client", email: "commission@example.test", phone: "", website: "", organizationId: "", relationships: [{ kind: "client", label: "Commission client" }], notes: "Private contact note", nextFollowUp: "", followUpNote: "", status: "active" };
  const savedContact = await ok(request("/api/contacts", { method: "POST", headers, body: JSON.stringify({ input: contact, operationId: randomUUID() }) }), 201);
  const input = { contactId: savedContact.id, title: "Album cover test", brief: "Create original album cover artwork", deliverables: "One final cover image", budgetMinor: 60000,
    deadline: "2026-12-01", notes: "PRIVATE commission notes", archived: false, stage: "new", qualification: "Confirm format and scope", nextFollowUp: "2026-10-15" };
  const command = { action: "inquiry", id: null, expectedRevision: 0, operationId: randomUUID(), input, note: "Initial test brief" };
  for (const [cookie, status] of [["", 401], [legalCookie, 403], [accountingCookie, 200]]) assert.equal((await request("/api/commissions", { headers: { Cookie: cookie } })).status, status);
  for (const extra of [{ Cookie: accountingCookie + "; " + proof.cookie }, { Cookie: legalCookie + "; " + proof.cookie }, { Origin: "https://attacker.example" }, { "X-CSRF-Token": "invalid" }]) assert.equal((await post(command, extra)).status, 403);
  const deniedPage = await request("/admin/projects", { headers: { Cookie: legalCookie } }); assert.equal(deniedPage.status, 307);
  check("commission pages and APIs enforce staff/accounting reads, super-admin writes, origin and CSRF");

  const creates = await Promise.all([ok(post(command), 201), ok(post(command), 201)]), inquiryId = creates[0].id;
  assert.equal(creates[1].id, inquiryId); assert.equal((await c("commissionState").doc("counts").get()).data().inquiries, 1);
  assert.equal((await ok(read("inquiry", inquiryId))).history.length, 1);
  assert.equal((await post({ ...command, input: { ...input, title: "Different request" } })).status, 409);
  assert.equal(JSON.stringify(await directory()).includes("PRIVATE commission notes"), false);
  check("concurrent identical inquiry creates produce one record, one history version and one counter increment");

  for (const invalid of [{ ...command, businessId: "other" }, { ...command, input: { ...input, budgetMinor: 1.5 } }, { ...command, input: { ...input, deadline: "2026-02-30" } }, { ...command, input: { ...input, paid: true } }]) assert.equal((await post({ ...invalid, operationId: randomUUID() })).status, 400);
  assert.equal((await post({ ...command, operationId: randomUUID(), input: { ...input, contactId: "b".repeat(64) } })).status, 400);
  await c("contacts").doc(savedContact.id).update({ "input.status": "archived" });
  assert.equal((await post({ ...command, operationId: randomUUID() })).status, 400);
  const convert = revision => ({ action: "convert", id: inquiryId, expectedRevision: revision, operationId: randomUUID(), note: "Create internal project" });
  assert.equal((await post(convert(1))).status, 409);
  await c("contacts").doc(savedContact.id).update({ "input.status": "active", "input.name": "Renamed contact" });
  check("strict briefs reject injected fields, fractional budgets, invalid dates and missing/archived contacts; conversion requires acceptance");

  const edit = { ...command, id: inquiryId, expectedRevision: 1, operationId: randomUUID(), input: { ...input, stage: "reviewing" }, note: "Review scope" };
  const edits = await Promise.all([post(edit), post({ ...edit, operationId: randomUUID(), input: { ...input, stage: "estimating" } })]);
  assert.deepEqual(edits.map(r => r.status).sort(), [201, 409]);
  let inquiry = await ok(read("inquiry", inquiryId)); assert.equal(inquiry.record.contact.name, contact.name); assert.equal(inquiry.history.length, 2);
  await ok(post({ ...edit, expectedRevision: 2, operationId: randomUUID(), input: { ...input, stage: "accepted" }, note: "Studio accepts scope" }), 201);
  await c("contacts").doc(savedContact.id).update({ "input.status": "archived" }); assert.equal((await post(convert(3))).status, 409);
  await c("contacts").doc(savedContact.id).update({ "input.status": "active" });
  check("stale inquiry edits conflict, contact snapshots survive directory changes and archived clients cannot start projects");

  const conversion = convert(3), alternateConversion = { ...conversion, operationId: randomUUID() }, conversions = await Promise.all([post(conversion), post(alternateConversion)]);
  assert.deepEqual(conversions.map(r => r.status).sort(), [201, 409]);
  const projectId = (await conversions.find(r => r.status === 201).json()).id;
  assert.equal((await c("commissionProjects").get()).size, 1); assert.equal((await c("commissionState").doc("counts").get()).data().projects, 1);
  inquiry = await ok(read("inquiry", inquiryId)); assert.equal(inquiry.record.projectId, projectId);
  assert.equal((await post({ ...edit, expectedRevision: 4, operationId: randomUUID() })).status, 409);
  let project = await ok(read("project", projectId)); assert.equal(project.record.inquiryId, inquiryId); assert.equal(project.record.acceptedBrief.budgetMinor, 60000);
  assert.equal(project.record.input.status, "planned"); assert.equal(project.record.contact.name, contact.name);
  check("competing conversions atomically create one linked project and retain a read-only accepted inquiry snapshot");

  const milestoneId = randomUUID(), taskId = randomUUID();
  const plan = { ...project.record.input, status: "active", milestones: [{ id: milestoneId, title: "Sketch review", status: "planned", dueDate: "2026-11-01", notes: "Internal review" }],
    tasks: [{ id: taskId, title: "Prepare sketches", status: "todo", dueDate: "2026-10-25", notes: "Try three compositions", milestoneId }] };
  const projectCommand = (input, revision = 1) => ({ action: "project", id: projectId, expectedRevision: revision, operationId: randomUUID(), input, note: "Update project plan" });
  for (const invalid of [{ ...plan, status: "completed" }, { ...plan, milestones: [{ ...plan.milestones[0], status: "completed" }] }, { ...plan, tasks: [{ ...plan.tasks[0], milestoneId: randomUUID() }] }, { ...plan, tasks: [plan.tasks[0], plan.tasks[0]] }, { ...plan, tasks: Array.from({ length: 41 }, () => ({ ...plan.tasks[0], id: randomUUID() })) }]) assert.equal((await post(projectCommand(invalid))).status, 400);
  const savePlan = projectCommand(plan), sameSaves = await Promise.all([ok(post(savePlan), 201), ok(post(savePlan), 201)]); assert.equal(sameSaves[0].revision, 2); assert.equal(sameSaves[1].revision, 2);
  assert.equal((await post(projectCommand(plan))).status, 409);
  assert.equal((await post(projectCommand({ ...plan, tasks: [] }, 2))).status, 409);
  assert.equal((await post(projectCommand({ ...plan, milestones: [], tasks: [{ ...plan.tasks[0], milestoneId: "" }] }, 2))).status, 409);
  assert.equal((await ok(post(command), 201)).id, inquiryId);
  check("project plans reject invalid links and premature completion, preserve saved work rows and recover identical retries without duplicate history");

  const complete = { ...plan, status: "completed", milestones: [{ ...plan.milestones[0], status: "completed" }], tasks: [{ ...plan.tasks[0], status: "done" }] };
  await ok(post(projectCommand(complete, 2)), 201);
  assert.equal((await post(projectCommand({ ...complete, title: "Changed while closed" }, 3))).status, 409);
  const archive = { ...complete, archived: true }; await ok(post(projectCommand(archive, 3)), 201);
  assert.equal((await post(projectCommand(archive, 4))).status, 409);
  await ok(post(projectCommand(complete, 4)), 201);
  await ok(post(projectCommand({ ...complete, status: "active", budgetMinor: 75000 }, 5)), 201);
  project = await ok(read("project", projectId)); assert.equal(project.record.acceptedBrief.budgetMinor, 60000); assert.equal(project.record.input.budgetMinor, 75000);
  assert.equal(project.history.length, 6); assert.equal(project.history.at(-1).input.status, "planned");
  assert.equal((await ok(post(savePlan), 201)).revision, 2);
  assert.equal((await ok(read("project", projectId))).record.revision, 6);
  assert.equal((await ok(post(conversions[0].status === 201 ? conversion : alternateConversion), 201)).id, projectId);
  assert.equal((await c("commissionProjects").get()).size, 1);
  check("completed projects require explicit reopening, archive/restore preserves history and later planning edits never rewrite the accepted brief");

  const competing = await Promise.all([post(projectCommand({ ...project.record.input, status: "on_hold" }, 6)), post(projectCommand({ ...project.record.input, status: "cancelled" }, 6))]);
  assert.deepEqual(competing.map(r => r.status).sort(), [201, 409]);
  for (const [cookie, status] of [["", 401], [legalCookie, 403], [accountingCookie, 200]]) assert.equal((await read("project", projectId, cookie)).status, status);
  assert.equal((await read("inquiry", projectId)).status, 404); assert.equal((await read("project", "bad")).status, 400);
  const owner2 = await identity("commission-second-admin@example.test", true, "super_admin"), secondCookie = session(await signIn(owner2));
  const second = await ok(post(command, { Cookie: secondCookie + "; " + proof.cookie }), 201); assert.notEqual(second.id, inquiryId);
  assert.equal((await c("commissionAudit").get()).size, 11);
  check("concurrent project edits serialize, detail history enforces roles and operation identities are scoped to the staff actor");

  await c("commissionState").doc("counts").update({ inquiries: 500 });
  assert.equal((await post({ ...command, operationId: randomUUID() })).status, 409); await c("commissionState").doc("counts").update({ inquiries: 2 });
  await c("commissionInquiries").doc(second.id).update({ revision: 200 });
  assert.equal((await post({ ...edit, id: second.id, expectedRevision: 199, operationId: randomUUID() })).status, 409);
  await c("commissionInquiries").doc(second.id).update({ revision: 1 });
  const page = await request("/admin/projects", { headers: { Cookie: accountingCookie } }); assert.equal(page.status, 200); assert.match(await page.text(), /read-only access/);
  const help = await request("/admin/how-to", { headers: { Cookie: accountingCookie } }); assert.match(await help.text(), /id="commissions"/);
  for (const name of ["storeOrders", "stockMovements", "storeOrderRefunds", "orderEmails"]) assert.equal((await c(name).get()).size, 0);
  check("record/version caps reject safely, accounting can discover help, and commission planning creates no commerce or stock records");
  if (process.argv.includes("--commission-preview")) {
    const marker = "web-app/.next-auth-test/commission-preview.done"; try { await unlink(marker); } catch {}
    await writeFile("web-app/.next-auth-test/commission-preview.ready", JSON.stringify({ inquiryId, projectId }));
    console.log("Commission browser preview ready at " + origin + "/admin/projects");
    for (let i = 0; i < 1800; i++) { try { await access(marker); break; } catch {} await delay(500); }
  }
}
