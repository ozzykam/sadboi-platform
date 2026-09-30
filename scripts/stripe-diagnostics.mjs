// Read-only Stripe test-account diagnostics. Does not print credentials or buyer details.
// node --env-file=web-app/.env.vercel scripts/stripe-diagnostics.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
const fromWeb = createRequire(path.resolve("web-app/package.json"));
const Stripe = fromWeb("stripe");
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
  const orderId = process.argv[process.argv.indexOf("--order") + 1];
  if (process.argv.includes("--order")) {
    if (!/^[a-f0-9]{32}$/.test(orderId ?? "")) throw new Error("Invalid order ID.");
    const { initializeApp, cert, applicationDefault, deleteApp } = fromWeb("firebase-admin/app");
    const { getFirestore } = fromWeb("firebase-admin/firestore");
    const registration = JSON.parse(readFileSync("firebase.web.config.json", "utf8"));
    const credentials = process.env.FIREBASE_ADMIN_CREDENTIALS ? JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS) : null;
    if (credentials && credentials.project_id !== registration.projectId) throw new Error("Firebase project mismatch.");
    const app = initializeApp({ projectId: registration.projectId, credential: credentials
      ? cert({ projectId: credentials.project_id, clientEmail: credentials.client_email, privateKey: credentials.private_key.replace(/\\n/g, "\n") }) : applicationDefault() });
    const db = getFirestore(app), collection = name => db.collection(`businesses/sadboi/${name}`);
    try {
      const order = (await collection("storeOrders").doc(orderId).get()).data();
      if (!order || order.businessId !== "sadboi" || order.stripeSource?.accountId !== account.id || order.stripeSource?.mode !== "test") throw new Error("Order is not bound to this test account.");
      const history = await collection("storePaymentEvents").where("input.orderId", "==", orderId).limit(20).get();
      const stock = [];
      for (const line of order.lines ?? []) {
        const balances = await collection("stockBalances").where("variantId", "==", line.variantId).limit(20).get();
        stock.push(...balances.docs.map(doc => ({ sku: line.sku, locationId: doc.data().locationId, onHand: doc.data().onHand, allocated: doc.data().allocated, reserved: doc.data().reserved })));
      }
      console.log(JSON.stringify({ order: { id: orderId, number: order.orderNumber, status: order.status, expiresAt: order.expiresAt, paymentEventId: order.paymentEventId ?? null, reviewRequired: order.paymentReviewRequired === true, allocationState: order.allocationState },
        paymentReceipts: history.docs.map(doc => ({ eventId: doc.data().input.eventId, verification: doc.data().verification ?? "webhook", outcome: doc.data().outcome, reason: doc.data().reason, receivedAt: doc.data().createdAt, resolved: !!doc.data().resolution })), stock }, null, 2));
    } finally { await db.terminate(); await deleteApp(app); }
  }
} catch (error) {
  console.error(JSON.stringify({ type: error.type, code: error.code, status: error.statusCode, message: "Read-only Stripe inspection failed" }));
  process.exitCode = 1;
}
