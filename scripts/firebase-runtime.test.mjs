import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

const fromWeb = createRequire(new URL("../web-app/package.json", import.meta.url));

test("Firebase server imports work without synchronous require(ESM)", () => {
  assert.ok(process.execArgv.includes("--no-experimental-require-module"));
  for (const service of ["auth", "firestore", "storage", "app-check"]) {
    assert.doesNotThrow(() => fromWeb(`firebase-admin/${service}`));
  }
});

test("Firebase's JWKS dependency still resolves usable signing keys", async () => {
  const fromAdmin = createRequire(fromWeb.resolve("firebase-admin/auth"));
  const jwksClient = fromAdmin("jwks-rsa");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "disposable-test-key",
    use: "sig",
    alg: "RS256",
  };
  // Supply a local JWKS response: no credentials or network are needed.
  const client = jwksClient({
    jwksUri: "https://example.invalid/jwks",
    cache: false,
    fetcher: async () => ({ keys: [jwk] }),
  });
  const key = await client.getSigningKey(jwk.kid);
  assert.equal(
    key.getPublicKey().trim(),
    publicKey.export({ type: "spki", format: "pem" }).trim(),
  );
  const payload = Buffer.from("runtime compatibility check");
  const signature = sign("sha256", payload, privateKey);
  assert.equal(verify("sha256", payload, key.getPublicKey(), signature), true);
  assert.equal(
    verify("sha256", Buffer.from("tampered"), key.getPublicKey(), signature),
    false,
  );
  await assert.rejects(
    client.getSigningKey("unknown-key"),
    /Unable to find a signing key/,
  );

  const provider = jwksClient.passportJwtSecret({
    jwksUri: "https://example.invalid/jwks",
    cache: false,
    fetcher: async () => ({ keys: [jwk] }),
  });
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "RS256", kid: jwk.kid })}.${encode({ sub: "test" })}.c2ln`;
  const resolveKey = (jwt) =>
    new Promise((resolve, reject) => {
      provider({}, jwt, (error, value) => error ? reject(error) : resolve(value));
    });
  assert.equal(await resolveKey(token), key.getPublicKey());
  assert.equal(await resolveKey("malformed-token"), null);
});
