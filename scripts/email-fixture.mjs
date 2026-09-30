import { createServer } from "node:http";
// Disposable emulator transport; never contacts Resend or an actual mailbox.
export async function emailFixture() {
  const messages = new Map(), calls = [];
  let mode = "ok";
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    const key = req.headers["idempotency-key"];
    calls.push({ key, payload });
    res.setHeader("Content-Type", "application/json");
    if (mode === "outage") { res.writeHead(503); res.end('{"message":"fixture outage"}'); return; }
    if (mode === "rejected") { res.writeHead(422); res.end('{"message":"fixture rejection"}'); return; }
    const prior = messages.get(key);
    if (prior && JSON.stringify(prior.payload) !== JSON.stringify(payload)) { res.writeHead(409); res.end('{}'); return; }
    const saved = prior ?? { id: `mail_fixture_${messages.size + 1}`, payload };
    messages.set(key, saved);
    if (mode === "lost-response") { req.socket.destroy(); return; }
    res.end(JSON.stringify({ id: saved.id }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, messages, calls, setMode(value) { mode = value; }, env: {
    SADBOI_ORDER_EMAIL_MODE: "resend", RESEND_API_KEY: "re_disposable_fixture",
    SADBOI_ORDER_EMAIL_FROM: "orders@example.test", SADBOI_ORDER_EMAIL_REPLY_TO: "studio@example.test",
    SADBOI_ORDER_EMAIL_TEST_RECIPIENTS: "email-test@example.test", SADBOI_EMAIL_TEST_PORT: String(server.address().port),
  } };
}
