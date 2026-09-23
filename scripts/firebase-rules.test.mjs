import assert from "node:assert/strict";
import { before, test } from "node:test";

const project = "demo-sadboi-platform";
const hosts = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  firestore: process.env.FIRESTORE_EMULATOR_HOST,
  storage: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
};
for (const [service, host] of Object.entries(hosts)) {
  assert.match(host ?? "", /^127\.0\.0\.1:\d+$/, service + " must use the loopback emulator");
}
assert.equal(process.env.GCLOUD_PROJECT, project, "Rules tests must use the isolated demo project");
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
let token;
before(async () => {
  const response = await request("http://" + hosts.auth + "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rules-test@example.test", password: "Emulator-only-password-123!", returnSecureToken: true }),
  });
  assert.equal(response.status, 200, "Emulator test user should be created");
  token = (await response.json()).idToken;
  assert.ok(token);
});

for (const principal of ["anonymous", "signed-in"]) {
  const headers = () => principal === "signed-in" ? { Authorization: "Bearer " + token } : {};
  const documents = "http://" + hosts.firestore + "/v1/projects/" + project + "/databases/(default)/documents";
  const objects = "http://" + hosts.storage + "/v0/b/" + project + ".firebasestorage.app/o";
  test(principal + " cannot read Firestore documents", async () => {
    const response = await request(documents + "/businesses/sadboi/artworks/private", { headers: headers() });
    assert.equal(response.status, 403);
  });
  test(principal + " cannot list Firestore documents", async () => {
    const response = await request(documents + "/businesses/sadboi/artworks", { headers: headers() });
    assert.equal(response.status, 403);
  });
  test(principal + " cannot create or self-assign a membership", async () => {
    const response = await request(documents + "/businesses/sadboi/memberships/self", {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { role: { stringValue: "super_admin" } } }),
    });
    assert.equal(response.status, 403);
  });
  test(principal + " cannot download private storage files", async () => {
    const response = await request(objects + "/private%2Fmaster.png?alt=media", { headers: headers() });
    assert.equal(response.status, 403);
  });
  test(principal + " cannot upload storage files", async () => {
    const response = await request(objects + "?uploadType=media&name=private%2Fmaster.png", {
      method: "POST",
      headers: { ...headers(), "Content-Type": "image/png" },
      body: "emulator-test-only",
    });
    assert.equal(response.status, 403);
  });
}