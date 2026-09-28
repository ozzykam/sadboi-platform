// Read-only Stripe test-account diagnostics. Does not print credentials or buyer details.
// node --env-file=web-app/.env.vercel scripts/stripe-diagnostics.mjs
import { createRequire } from "node:module";
import path from "node:path";
const Stripe = createRequire(path.resolve("web-app/package.json"))("stripe");
if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new Error("A Stripe test secret key is required.");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 0, timeout: 10000 });
try {
  const [account, hooks, sessions, events] = await Promise.all([
    stripe.accounts.retrieve(null), stripe.webhookEndpoints.list({ limit: 100 }),
    stripe.checkout.sessions.list({ limit: 5 }), stripe.events.list({ type: "checkout.session.completed", limit: 5 }),
  ]);
  console.log(JSON.stringify({
    accountMatches: account.id === process.env.STRIPE_ACCOUNT_ID,
    webhookCount: hooks.data.length, webhooksHasMore: hooks.has_more,
    storeWebhooks: hooks.data.filter(h => h.url.includes("/api/stripe/webhook/")).map(h => ({ id: h.id, url: h.url, status: h.status, livemode: h.livemode, events: h.enabled_events })),
    recentStoreCheckouts: sessions.data.filter(s => s.metadata?.businessId === "sadboi").map(s => ({ id: s.id, orderId: s.metadata.orderId, status: s.status, paymentStatus: s.payment_status, created: s.created, returnOrigin: s.success_url ? new URL(s.success_url).origin : null })),
    recentStoreEvents: events.data.filter(e => e.data.object.metadata?.businessId === "sadboi").map(e => ({ id: e.id, orderId: e.data.object.metadata.orderId, pendingWebhooks: e.pending_webhooks, created: e.created })),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ type: error.type, code: error.code, status: error.statusCode, message: "Read-only Stripe inspection failed" }));
  process.exitCode = 1;
}
