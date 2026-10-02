import "server-only";
import Stripe from "stripe";
import { AccessError } from "./staff";
export type StripeSource = { accountId: string; mode: "test" };
export function stripeEnabled() {
  return process.env.SADBOI_STRIPE_ENABLED === "1";
}
const clients = new Map<string, { client: Stripe; verified: Promise<void> }>();
export async function stripeContext(source?: StripeSource) {
  if (!stripeEnabled())
    throw new AccessError(
      503,
      "stripe-disabled",
      "Test checkout is not configured yet.",
    );
  const current = process.env.STRIPE_ACCOUNT_ID;
  const previous =
    source &&
    source.accountId !== current &&
    source.accountId === process.env.STRIPE_PREVIOUS_ACCOUNT_ID;
  const accountId = previous ? process.env.STRIPE_PREVIOUS_ACCOUNT_ID : current;
  const key = previous
    ? process.env.STRIPE_PREVIOUS_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
  const webhookSecret = previous
    ? process.env.STRIPE_PREVIOUS_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;
  if (
    !accountId ||
    !/^acct_[a-zA-Z0-9]+$/.test(accountId) ||
    !key?.startsWith("sk_test_") ||
    !webhookSecret?.startsWith("whsec_") ||
    (source && (source.accountId !== accountId || source.mode !== "test"))
  )
    throw new AccessError(
      503,
      "stripe-config",
      "The matching Stripe test account, test key, and webhook secret must be configured.",
    );
  const fakePort = process.env.SADBOI_STRIPE_TEST_PORT;
  if (
    fakePort &&
    !(
      process.env.SADBOI_AUTH_TEST === "1" &&
      process.env.SADBOI_AUTH_ENV === "emulator" &&
      process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080" &&
      /^\d{4,5}$/.test(fakePort)
    )
  )
    throw new AccessError(
      503,
      "stripe-config",
      "The test Stripe transport is restricted to local emulators.",
    );
  const cacheKey = accountId + key;
  let cached = clients.get(cacheKey);
  if (!cached) {
    const client = new Stripe(key, {
      maxNetworkRetries: 1,
      timeout: 15000,
      ...(fakePort
        ? {
            host: "127.0.0.1",
            port: Number(fakePort),
            protocol: "http" as const,
          }
        : {}),
    });
    const verified = client.accounts
      .retrieve(null)
      .then((account) => {
        if (account.id !== accountId)
          throw new AccessError(
            503,
            "stripe-account-mismatch",
            "The Stripe key does not belong to the configured account.",
          );
      })
      .catch((error) => {
        clients.delete(cacheKey);
        throw error;
      });
    cached = { client, verified };
    clients.set(cacheKey, cached);
  }
  await cached.verified;
  return {
    client: cached.client,
    source: { accountId, mode: "test" as const },
    webhookSecret,
  };
}
