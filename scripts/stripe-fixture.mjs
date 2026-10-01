// Local Stripe HTTP fixture; the application allows it only with Firebase emulators.
import { createServer } from "node:http";
export async function stripeFixture() {
  const sessions = new Map(), payments = new Map(), refunds = new Map(), keys = new Map();
  const accountId = "acct_fixtureCurrent", secret = "whsec_disposable_fixture";
  let creates = 0, unavailable = false, reads = 0, refundCreates = 0, refundStatus = "succeeded", droppedRefundResponses = 0;
  const refundKeys = new Map();
  function updateRefundTotals(id) {
    const payment = payments.get(id);
    if (payment) payment.latest_charge.amount_refunded = [...refunds.values()].filter(row => row.payment_intent === id && row.status === "succeeded").reduce((sum, row) => sum + row.amount, 0);
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = new URLSearchParams(Buffer.concat(chunks).toString());
    if (unavailable) { res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { type: "api_error", message: "Disposable outage" } })); return; }
    let result;
    if (url.pathname === "/v1/account") result = { id: accountId, object: "account" };
    else if (url.pathname === "/v1/checkout/sessions" && req.method === "POST") {
      const key = req.headers["idempotency-key"];
      if (keys.has(key)) result = sessions.get(keys.get(key));
      else {
        const id = "cs_test_fixture" + ++creates;
        result = { id, object: "checkout.session", livemode: false, mode: "payment", status: "open", payment_status: "unpaid", payment_intent: null,
          amount_total: [...body.entries()].filter(([key]) => /^line_items\[\d+\]\[price_data\]\[unit_amount\]$/.test(key)).reduce((sum, [key, amount]) => sum + Number(amount) * Number(body.get(key.replace("[price_data][unit_amount]", "[quantity]"))), 0), currency: "usd", client_reference_id: body.get("client_reference_id"),
          metadata: Object.fromEntries(["orderId", "businessId", "accountId"].map(k => [k, body.get(`metadata[${k}]`)])),
          expires_at: Number(body.get("expires_at")), url: "https://checkout.stripe.com/c/pay/" + id };
        keys.set(key, id); sessions.set(id, result);
      }
    } else if (url.pathname.startsWith("/v1/checkout/sessions/")) {
      reads++;
      const id = url.pathname.split("/")[4]; result = sessions.get(id);
      if (result && req.method === "POST" && url.pathname.endsWith("/expire")) { result.status = "expired"; result.url = null; }
    } else if (url.pathname.startsWith("/v1/payment_intents/")) result = payments.get(url.pathname.split("/")[3]);
    else if (url.pathname === "/v1/refunds" && req.method === "GET") result = { object: "list", has_more: false, data: [...refunds.values()].filter(row => row.payment_intent === url.searchParams.get("payment_intent")) };
    else if (url.pathname === "/v1/refunds" && req.method === "POST") {
      const key = req.headers["idempotency-key"], prior = refundKeys.get(key);
      if (prior) result = refunds.get(prior);
      else {
        const pi = body.get("payment_intent"), amount = Number(body.get("amount")), payment = payments.get(pi);
        const held = [...refunds.values()].filter(row => row.payment_intent === pi && !["failed", "canceled"].includes(row.status)).reduce((sum, row) => sum + row.amount, 0);
        if (!payment || amount < 1 || amount + held > payment.amount_received) {
          res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { type: "invalid_request_error", code: "amount_too_large", message: "Refund exceeds payment" } })); return;
        }
        const id = "re_fixture" + ++refundCreates;
        result = { id, object: "refund", amount, currency: "usd", payment_intent: pi, status: refundStatus,
          metadata: Object.fromEntries(["sadboiRefundId", "orderId", "businessId"].map(k => [k, body.get(`metadata[${k}]`)])) };
        refunds.set(id, result); refundKeys.set(key, id); updateRefundTotals(pi);
      }
      if (droppedRefundResponses > 0) { droppedRefundResponses--; req.socket.destroy(); return; }
    }
    else if (url.pathname.startsWith("/v1/refunds/")) result = refunds.get(url.pathname.split("/")[3]);
    res.setHeader("Content-Type", "application/json"); res.statusCode = result ? 200 : 404;
    res.end(JSON.stringify(result ?? { error: { type: "invalid_request_error", message: "Fixture not found", code: "resource_missing" } }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, sessions, payments, refunds, accountId, secret, creates: () => creates, reads: () => reads, setUnavailable: value => { unavailable = value; },
    refundCreates: () => refundCreates, setRefundStatus: value => { refundStatus = value; }, dropRefundResponses: count => { droppedRefundResponses = count; },
    resolveRefund: (id, status) => { const row = refunds.get(id); row.status = status; updateRefundTotals(row.payment_intent); },
    env: { SADBOI_STRIPE_ENABLED: "1", STRIPE_ACCOUNT_ID: accountId, STRIPE_SECRET_KEY: "sk_test_disposable_fixture", STRIPE_WEBHOOK_SECRET: secret, SADBOI_STRIPE_TEST_PORT: String(server.address().port) },
    pay(id) {
      const session = sessions.get(id), paymentId = "pi_fixture" + id.replaceAll("_", "");
      session.status = "complete"; session.payment_status = "paid"; session.payment_intent = paymentId;
      payments.set(paymentId, { id: paymentId, object: "payment_intent", livemode: false, status: "succeeded", currency: "usd", amount_received: session.amount_total,
        metadata: session.metadata, latest_charge: { id: "ch_fixture", object: "charge", amount_refunded: 0 } });
      return session;
    },
  };
}
