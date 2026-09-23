// Deliberate provisioning command. It never sends mail or sets passwords.
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const path = require("node:path");
const fromWeb = createRequire(path.resolve(__dirname, "../web-app/package.json"));
const { initializeApp, applicationDefault } = fromWeb("firebase-admin/app");
const { getFirestore, FieldValue } = fromWeb("firebase-admin/firestore");
(async () => {
  const emulator = process.argv.includes("--emulator");
  if (!emulator && !process.argv.includes("--live")) throw new Error("Pass --emulator or --live explicitly.");
  if (emulator && (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")) throw new Error("Local emulator hosts are required.");
  if (!emulator && (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error("Remove emulator variables for live bootstrap.");
  const db = getFirestore(initializeApp({ projectId: emulator ? "demo-sadboi-platform" : "sadboi-platform", ...(emulator ? {} : {credential: applicationDefault()}) }));
  for (const email of ["ozzykam@gmail.com", "sadboiillustration@gmail.com"]) {
    const ref = db.doc("businesses/sadboi/staffInvites/" + createHash("sha256").update(email).digest("hex"));
    const outcome = await db.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return "already provisioned; unchanged";
      tx.create(ref, { email, role: "super_admin", status: "pending", createdAt: FieldValue.serverTimestamp() });
      return "approved for verified account activation";
    });
    console.log(email + ": " + outcome);
  }
  await db.terminate();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
