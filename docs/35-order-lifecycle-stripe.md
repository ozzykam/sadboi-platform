# Pending orders and Stripe test checkout

September 25, 2026. The selected policy is a **30-minute stock hold** and **test-mode Stripe only**, initially using Aziz's account. No live payment activation is implemented. Production scheduling and real Stripe sandbox verification must be configured separately; local tests use disposable services.

## Implemented behavior

- Creating an order saves an immutable deadline and a private management token. Retrying creation recovers the same order, token and deadline. The private `/orders/[id]#token` link stores access in session storage and removes the fragment when storage works. Only a token hash is stored on the order; the original creation-operation response retains the token for recovery. Server responses expose order number, amount, status and deadline, never customer details or inventory. There is no recovery email yet.
- Customers can cancel unpaid orders using that link. Super admins cancel from Orders with a reason; accounting remains read-only. Closing releases the original allocated quantities atomically, changes no physical stock, and records an operation/audit trail. Corrupt allocations and ambiguous historical payment/fulfillment records block cancellation for reconciliation. Repeated requests never release twice.
- The expiry worker scans up to 50 pending orders per call using a persisted cursor. Orders without a valid deadline are skipped. At the deadline payment success requires review even if the worker has not run yet. A customer's status refresh also expires their due order. More than 50 pending orders can take several scheduled runs to scan; the job is not a precise per-order timer.
- Stripe Checkout uses one saved request/idempotency key per order, server-calculated USD totals, card payments only, and test keys only. No client amount, Price ID, Customer ID, or account-specific catalog is trusted. Shipping and tax are not added. Stripe requires its Session expiration to be at least 30 minutes from creation; the independent order deadline is never extended. The worker closes remaining open Sessions and retries remote cleanup after stock release.
- Signed raw-body webhooks verify the test account and canonical Session, then durably record normalized payment events. Payment and event identities include account and mode. Return-page parameters never mark an order paid. The old shared-secret confirmation endpoint cannot confirm a Stripe-bound order.
- Super admins can accept a verified, unrefunded late payment on an unpaid closed order, atomically reserving currently available stock again. Insufficient stock rejects the entire resolution. Alternatively, complete the full refund in the matching Stripe test dashboard and verify its `re_...` ID in the app. The app does not issue refunds. Only failed-payment reviews can be dismissed. Resolutions require notes, expected revision and an idempotent request; flags clear only when all reviews are resolved.
- Historical events without an account mapping, identity conflicts across orders, partial refunds, normal paid-order refunds/returns, ledger postings, taxes, shipping rates and notifications remain outside this workflow. Do not manually refund a payment while another administrator is accepting it.

## Vercel configuration

Use server-only Production environment variables. Never commit credentials or prefix them with `NEXT_PUBLIC_`.

| Variable | Value |
| --- | --- |
| `SADBOI_STRIPE_ENABLED` | `1` after test setup is ready; default `0` |
| `STRIPE_ACCOUNT_ID` | Placeholder business's `acct_...` ID |
| `STRIPE_SECRET_KEY` | Its **test** `sk_test_...` secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` for the endpoint below in that same test environment |
| `SADBOI_EXPIRY_SECRET` | Random secret of at least 32 characters, shared only with the scheduler |
| `SADBOI_APP_ORIGIN` | `https://sadboi-platform-web-app.vercel.app` |

Keep existing live Firebase server configuration. `SADBOI_AUTH_ENV=live` refers to Firebase, not Stripe payment mode. Do not set emulator/test-transport variables in Vercel. No publishable Stripe key is needed for hosted Checkout.

Create a Stripe **test/sandbox** webhook destination:

`https://sadboi-platform-web-app.vercel.app/api/stripe/webhook/acct_YOUR_ACCOUNT_ID`

Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Use its signing secret, not a Stripe CLI listener's signing secret. Redeploy after configuring environment variables. Verify a real Stripe sandbox card checkout, webhook retry, expiry, and late-payment review before calling the account integration verified. See [Stripe signature verification](https://docs.stripe.com/webhooks/signature) and [Checkout expiration](https://docs.stripe.com/api/checkout/sessions/create).

## Google Cloud Scheduler

Recommended: Cloud Scheduler calls the existing Vercel endpoint; a separate Cloud Function would add a second deployment without adding business logic. Use the existing Google Cloud project, enable Cloud Scheduler and billing if needed, and create this job through the Cloud Console:

| Setting | Value |
| --- | --- |
| Name | `sadboi-pending-order-expiry` |
| Frequency / timezone | `* * * * *` / `UTC` |
| Target type / method | HTTP / POST |
| URL | `https://sadboi-platform-web-app.vercel.app/api/cron/order-expiry` |
| Header | `Authorization: Bearer YOUR_SADBOI_EXPIRY_SECRET` |
| Content-Type / body | `application/json` / `{}` |
| Authentication setting | None (the application verifies the custom bearer header) |
| Attempt deadline | 60 seconds |
| Retry count / minimum backoff | 3 / 10 seconds |

Keep the job secret restricted to operators. Enable the job only after the endpoint has been deployed. Use **Force run** once; verify HTTP success, its response, and `businesses/sadboi/inventoryState/expiry` in Firestore. The state records scanned count, last run, per-order conflicts and Stripe cleanup results. HTTP success can include records needing manual review; inspect these too. Add a failure/stale-last-run alert in Cloud Monitoring. Do not log request headers or secret values. Vercel's deployment protection must permit this endpoint, as it must permit the Stripe webhook.

If a job fails, confirm URL, secret, deployment, Firebase access, and logs. A failure after stock release is safe to retry. Super admins can choose **Run pending-order expiry check** in Orders as a fallback. Stripe cleanup failures retain a retry marker; interrupted Session creation beyond the supported recovery window needs administrator reconciliation. Never recreate an order merely to bypass a stock inconsistency.

Sources: [Cloud Scheduler HTTP jobs](https://docs.cloud.google.com/scheduler/docs/creating), [Vercel cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). A one-minute schedule is the requested check cadence; cloud delays and bounded batches can delay physical stock release.

## Switching to Sadboi's account

1. Stop offering new test checkout while coordinating the switch. Drain/expire placeholder orders and resolve payment reviews; keep its webhook enabled while events remain outstanding.
2. Move the placeholder configuration to `STRIPE_PREVIOUS_ACCOUNT_ID`, `STRIPE_PREVIOUS_SECRET_KEY`, `STRIPE_PREVIOUS_WEBHOOK_SECRET`. The previous account can reconcile its existing orders; newly started checkouts use the current account. Only one previous account is supported.
3. Set the primary account variables to Sadboi's **test** credentials and create its account-specific webhook URL. Re-enable test checkout, redeploy, and test the complete flow. Existing account bindings are never rewritten to the new account.
4. Retire previous credentials only when its outstanding Sessions/events/reviews are drained. Keep historical source/account data. Live mode requires a separately reviewed launch change and shipping/tax/fulfillment readiness; replacing the test secret with `sk_live_...` is intentionally rejected.

## Validation

The final combined authentication/checkout/fulfillment/payment/lifecycle emulator run passed **63 integration checks**, including payment-versus-cancellation contention and a verified refund before the expiry sweep. All fixtures are disposable; the suite made no actual Stripe calls or live Firebase changes.

Final code checks passed on September 25: typecheck, lint, 76 core tests, 7 Firebase credential tests, 2 runtime compatibility tests, and the production build. Connected Chrome verified customer cancellation, retained access after a checkout return, staff cancellation with a reason, late-payment acceptance, the paid fulfillment state, and the saved resolution audit. The customer page has no horizontal overflow at 390×844. Browser tabs and temporary viewport overrides were closed/reset afterward. Full screen-reader, real-device, real Stripe sandbox and deployed scheduler checks remain outstanding.

`pnpm check` covers domain validation and production compilation. `pnpm test:order-lifecycle` runs the existing checkout/fulfillment/payment suites plus cancellation, expiry, signed Stripe fixture calls, acceptance and refund reconciliation in Firebase emulators. The local HTTP Stripe fixture exercises SDK serialization and signature checks but is not a real Stripe sandbox test. Run these commands sequentially because Next build/type artifacts are shared.
