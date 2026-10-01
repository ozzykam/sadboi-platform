// Configure only Sadboi's Stripe TEST webhook. Never prints signing/API secrets.
// Inspect: node scripts/stripe-vercel-webhook.mjs
// Create:  node scripts/stripe-vercel-webhook.mjs --apply
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = path.join(root, "web-app/.env.vercel");
const Stripe = createRequire(path.join(root, "web-app/package.json"))("stripe");
const origin = "https://sadboi-platform-web-app.vercel.app";
const events = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "refund.created", "refund.updated", "refund.failed"];
try {
  const config = parseEnv(readFileSync(envPath, "utf8"));
  if (!config.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !/^acct_[a-zA-Z0-9]+$/.test(config.STRIPE_ACCOUNT_ID ?? ""))
    throw new Error("Matching Stripe test credentials are required in .env.vercel.");
  if (config.SADBOI_APP_ORIGIN !== origin || config.SADBOI_STRIPE_ENABLED !== "1")
    throw new Error("Set the production app origin and enable test checkout in .env.vercel first.");
  const stripe = new Stripe(config.STRIPE_SECRET_KEY, { maxNetworkRetries: 1, timeout: 15000 });
  if ((await stripe.accounts.retrieve(null)).id !== config.STRIPE_ACCOUNT_ID) throw new Error("Stripe account mismatch.");
  const url = `${origin}/api/stripe/webhook/${config.STRIPE_ACCOUNT_ID}`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  if (endpoints.has_more) throw new Error("Endpoint list needs pagination before setup can proceed.");
  const matching = endpoints.data.filter(endpoint => endpoint.url === url);
  if (matching.length > 1) throw new Error("Duplicate Sadboi endpoints need review.");
  const probe = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", redirect: "manual", signal: AbortSignal.timeout(30000) });
  const probeData = await probe.json().catch(() => ({}));
  console.log(JSON.stringify({ url, existingEndpoint: matching[0]?.id ?? null, routeStatus: probe.status, routeCode: probeData.code ?? null }));
  if (probe.status !== 400 || probeData.code !== "stripe-signature") throw new Error("Deploy and configure the Stripe handler before creating its webhook.");
  if (matching.length) {
    const endpoint = matching[0];
    if (endpoint.livemode || endpoint.status !== "enabled" || !events.every(event => endpoint.enabled_events.includes(event) || endpoint.enabled_events.includes("*")))
      throw new Error("Existing endpoint configuration needs review; no changes were made.");
    console.log("The test endpoint already exists; retrieve its signing secret from Stripe if needed. No duplicate was created.");
    // An unsupported event exercises signature verification without changing an
    // order, payment, or inventory record. Real Stripe delivery is tested next.
    const payload = JSON.stringify({ id: "evt_sadboi_configuration_probe", object: "event", type: "account.updated", livemode: false, data: { object: { id: config.STRIPE_ACCOUNT_ID } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.STRIPE_WEBHOOK_SECRET });
    const verification = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": signature }, body: payload, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const result = await verification.json().catch(() => ({}));
    console.log(JSON.stringify({ signingSecretMatchesDeployment: verification.status === 200 && result.ignored === true, status: verification.status }));
    if (verification.status !== 200 || result.ignored !== true) throw new Error("Vercel has not accepted the saved signing secret; check its environment and deployment.");
  } else if (process.argv.includes("--apply")) {
    mkdirSync(path.join(root, ".secrets"), { recursive: true });
    const endpoint = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: "Sadboi Vercel test checkout", metadata: { businessId: "sadboi", purpose: "vercel-test-checkout" } },
      { idempotencyKey: "sadboi-webhook-" + createHash("sha256").update(url).digest("hex") });
    if (endpoint.livemode || !endpoint.secret?.startsWith("whsec_")) throw new Error("Unexpected endpoint response.");
    // Retain the one-time secret before changing the import file.
    try {
      writeFileSync(path.join(root, ".secrets/stripe-vercel-webhook.json"), JSON.stringify({ id: endpoint.id, url, accountId: config.STRIPE_ACCOUNT_ID, secret: endpoint.secret }), { mode: 0o600 });
      const current = readFileSync(envPath, "utf8"), line = `STRIPE_WEBHOOK_SECRET=${endpoint.secret}`;
      writeFileSync(envPath, /^[ \t]*(?:export[ \t]+)?STRIPE_WEBHOOK_SECRET[ \t]*=.*$/m.test(current)
        ? current.replace(/^[ \t]*(?:export[ \t]+)?STRIPE_WEBHOOK_SECRET[ \t]*=.*$/gm, line)
        : current + "\n" + line + "\n");
    } catch {
      await stripe.webhookEndpoints.update(endpoint.id, { disabled: true });
      throw new Error("Secret could not be saved; the new endpoint was disabled for recovery.");
    }
    console.log(JSON.stringify({ created: true, endpointId: endpoint.id, testMode: !endpoint.livemode, signingSecretSaved: "web-app/.env.vercel", next: "Update Vercel STRIPE_WEBHOOK_SECRET and redeploy." }));
  } else console.log("Ready to create the test endpoint with --apply.");
} catch (error) {
  console.error(JSON.stringify({ message: error.type ? "Stripe request failed" : error.message, code: error.code ?? null }));
  process.exitCode = 1;
}
