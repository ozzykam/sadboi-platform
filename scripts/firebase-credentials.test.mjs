import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { createRequire } from "node:module";
import { firebaseCredential } from "../web-app/src/server/firebase-credentials.ts";

const fromWeb = createRequire(
  new URL("../web-app/package.json", import.meta.url),
);
const { applicationDefault, initializeApp, deleteApp } =
  fromWeb("firebase-admin/app");
const config = { emulator: false, projectId: "demo-sadboi-platform" };
// Generate a disposable key in memory. Never load the developer's credentials
// or ask Google for an access token in this suite.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account = {
  type: "service_account",
  project_id: config.projectId,
  client_email: `test@${config.projectId}.iam.gserviceaccount.com`,
  private_key: privateKey,
};
const environment = (value) => ({
  VERCEL: "1",
  FIREBASE_ADMIN_CREDENTIALS: JSON.stringify(value),
});

test("Vercel credentials initialize the Admin SDK without a file or network request", async () => {
  const credential = firebaseCredential(config, environment(account));
  assert.equal(typeof credential.getAccessToken, "function");
  const app = initializeApp(
    { projectId: config.projectId, credential },
    "credential-test",
  );
  assert.equal(app.options.projectId, config.projectId);
  await deleteApp(app);
});

test("escaped key newlines are accepted", () => {
  assert.ok(
    firebaseCredential(
      config,
      environment({
        ...account,
        private_key: privateKey.replace(/\n/g, "\\n"),
      }),
    ),
  );
});

test("local and Google-hosted environments preserve application-default credentials", () => {
  assert.equal(firebaseCredential(config, {}), applicationDefault());
});

test("Vercel fails clearly when its secret is missing", () => {
  assert.throws(
    () => firebaseCredential(config, { VERCEL: "1" }),
    /Set FIREBASE_ADMIN_CREDENTIALS/,
  );
});

test("emulators ignore missing, invalid, and real-shaped live credentials", () => {
  for (const env of [
    { VERCEL: "1" },
    { VERCEL: "1", FIREBASE_ADMIN_CREDENTIALS: "not json" },
    environment(account),
  ]) {
    assert.equal(
      firebaseCredential({ ...config, emulator: true }, env),
      undefined,
    );
  }
});

test("malformed JSON and invalid credential fields are rejected without echoing input", () => {
  const marker = "PRIVATE_INPUT_MUST_NOT_APPEAR";
  for (const raw of [
    "",
    `{"private_key":"${marker}`,
    JSON.stringify(marker),
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...account, type: "authorized_user" }),
    JSON.stringify({ ...account, client_email: marker }),
    JSON.stringify({ ...account, private_key: marker }),
  ]) {
    assert.throws(
      () => firebaseCredential(config, { FIREBASE_ADMIN_CREDENTIALS: raw }),
      (error) => {
        assert.match(error.message, /FIREBASE_ADMIN_CREDENTIALS/);
        assert.ok(!error.message.includes(marker));
        assert.ok(!error.message.includes(privateKey));
        assert.equal(error.cause, undefined);
        return true;
      },
    );
  }
});

test("a key for another Firebase project is rejected", () => {
  assert.throws(
    () =>
      firebaseCredential(
        config,
        environment({ ...account, project_id: "another-project" }),
      ),
    /must belong to the project/,
  );
});
