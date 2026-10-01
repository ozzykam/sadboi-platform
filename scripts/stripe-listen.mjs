// Local test webhooks. Load keys from the ignored file, never command arguments.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = path.join(root, "web-app/.env.local");
try {
  const config = parseEnv(readFileSync(envPath, "utf8"));
  if (!config.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !/^acct_[a-zA-Z0-9]+$/.test(config.STRIPE_ACCOUNT_ID ?? ""))
    throw new Error("Set the Stripe test secret and account ID in web-app/.env.local first.");
  const origin = new URL(config.SADBOI_APP_ORIGIN ?? "http://127.0.0.1:3100");
  if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname))
    throw new Error("Local webhook forwarding requires a localhost SADBOI_APP_ORIGIN in .env.local.");
  const windowsCli = path.join(process.env.ProgramFiles ?? "C:/Program Files", "Stripe/stripe.exe");
  const cli = process.platform === "win32" && existsSync(windowsCli) ? windowsCli : "stripe";
  const env = { ...process.env, STRIPE_API_KEY: config.STRIPE_SECRET_KEY };
  const args = ["listen", "--skip-update", "--events", "checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,refund.created,refund.updated,refund.failed",
    "--forward-to", `${origin.origin}/api/stripe/webhook/${config.STRIPE_ACCOUNT_ID}`];
  const output = execFileSync(cli, [...args, "--print-secret"], { env, windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 });
  const secret = output.match(/\bwhsec_[a-zA-Z0-9]+\b/)?.[0];
  if (!secret) throw new Error("Stripe did not return a local signing secret.");
  // Re-read to preserve unrelated edits made while waiting for Stripe.
  const current = readFileSync(envPath, "utf8");
  if (parseEnv(current).STRIPE_WEBHOOK_SECRET !== secret) {
    const line = `STRIPE_WEBHOOK_SECRET=${secret}`;
    writeFileSync(envPath, /^\s*(?:export\s+)?STRIPE_WEBHOOK_SECRET\s*=.*$/m.test(current)
      ? current.replace(/^[ \t]*(?:export[ \t]+)?STRIPE_WEBHOOK_SECRET[ \t]*=.*$/gm, line)
      : current + "\n" + line + "\n");
    console.log("Updated the local webhook signing secret. Restart the dev server if it does not reload .env.local automatically.");
  }
  const child = spawn(cli, args, { env, windowsHide: true, stdio: ["inherit", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", line => console.log(line.replace(/\b(?:whsec|sk_test|rk_test)_[a-zA-Z0-9]+\b/g, "[secret hidden]")));
  }
  child.on("error", () => { console.error("Could not start Stripe CLI. Confirm it is installed."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 0; });
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
  console.log(`Forwarding Stripe test webhooks to ${origin.origin}. Keep this terminal running; press Ctrl+C to stop.`);
} catch (error) {
  // Child-process failures may embed credentials or signing secrets in output.
  console.error(error?.stdout !== undefined || error?.stderr !== undefined ? "Stripe listener setup failed. Check Stripe CLI access and your test credentials." : error.message);
  process.exitCode = 1;
}
