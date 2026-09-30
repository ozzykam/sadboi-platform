# Pending orders and Stripe test checkout

September 25, 2026. The selected policy is a **30-minute stock hold** and **test-mode Stripe only**, initially using Aziz's account. No live payment activation is implemented. Production scheduling and real Stripe sandbox verification must be configured separately; local tests use disposable services.

## Implemented behavior

- Creating an order saves an immutable deadline and a private management token. Retrying creation recovers the same order, token and deadline. The private `/orders/[id]#token` link stores access in session storage and removes the fragment when storage works. Only a token hash is stored on the order; the original creation-operation response retains the token for recovery. Server responses expose order number, amount, status and deadline, never customer details or inventory. There is no recovery email yet.
- Customers can cancel unpaid orders using that link. Super admins cancel from Orders with a reason; accounting remains read-only. Closing releases the original allocated quantities atomically, changes no physical stock, and records an operation/audit trail. Corrupt allocations and ambiguous historical payment/fulfillment records block cancellation for reconciliation. Repeated requests never release twice.
- The expiry worker scans up to 50 pending orders per call using a persisted cursor. Orders without a valid deadline are skipped. At the deadline payment success requires review even if the worker has not run yet. A customer's status refresh also expires their due order. More than 50 pending orders can take several scheduled runs to scan; the job is not a precise per-order timer.
- Stripe Checkout uses one saved request/idempotency key per order, server-calculated USD totals, card payments only, and test keys only. No client amount, Price ID, Customer ID, or account-specific catalog is trusted. Shipping and tax are not added. Stripe requires its Session expiration to be at least 30 minutes from creation; the independent order deadline is never extended. The worker closes remaining open Sessions and retries remote cleanup after stock release.
- Signed raw-body webhooks verify the test account and canonical Session, then durably record normalized payment events. The private order page also retrieves its saved Session directly from Stripe on load/status refresh and before customer cancellation. A missed webhook can therefore recover through the same transactional payment handler. Direct verification has a stable `lookup_` receipt, labeled as a verification reference in staff history. Concurrent refreshes and webhooks share the account-scoped payment identity. Return-page parameters never mark an order paid. The old shared-secret confirmation endpoint cannot confirm a Stripe-bound order.
- Processing, paid/review, expired checkout, and unavailable verification states hide the checkout button. Verification failure also blocks customer cancellation until status can be checked. Payments discovered after the deadline still require staff review; a refresh never silently reopens released stock. Manual status refresh retries verification; automatic polling is not implemented.
- Super admins can accept a verified, unrefunded late payment on an unpaid closed order, atomically reserving currently available stock again. Insufficient stock rejects the entire resolution. Alternatively, complete the full refund in the matching Stripe test dashboard and verify its `re_...` ID in the app. The app does not issue refunds. Only failed-payment reviews can be dismissed. Resolutions require notes, expected revision and an idempotent request; flags clear only when all reviews are resolved.
- Historical events without an account mapping, identity conflicts across orders, partial refunds, normal paid-order refunds/returns, ledger postings, taxes, shipping rates and notifications remain outside this workflow. Do not manually refund a payment while another administrator is accepting it.

## Vercel configuration

September 28–29 deployment status: created test endpoint `we_1UKkFdFYZnZRR1WFm2B7ww8S` at `https://sadboi-platform-web-app.vercel.app/api/stripe/webhook/acct_1SEhNMFYZnZRR1WF`, subscribed to the four events below. The unrelated existing account webhook was not changed. Saved the new signing secret in ignored `.env.vercel` and `.secrets/stripe-vercel-webhook.json`, updated Vercel's existing secret variable, and redeployed commit `80ba2b9` as deployment `GJzufT2bSt8iNmWQX3rtZNyjcK3r`. A signed ignored-event probe confirmed the deployed secret matches; no order effects were caused by that probe. Local CLI forwarding was stopped before the real sandbox payment.

`node scripts/stripe-vercel-webhook.mjs` inspects the endpoint and checks the deployed signature configuration; `--apply` creates a missing test destination and saves its one-time secret without printing it. Existing destinations are not duplicated or modified. `node --env-file=web-app/.env.vercel scripts/stripe-diagnostics.mjs --order ORDER_ID` adds read-only Firebase receipt/stock verification for an order bound to the configured Stripe test account. Keep all credential files ignored.

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

## Local Stripe testing

Keep `SADBOI_APP_ORIGIN=http://127.0.0.1:3100` and the test account/secret in `web-app/.env.local`, with `SADBOI_STRIPE_ENABLED=1`. Install Stripe CLI, then run from the repository root:

```powershell
pnpm stripe:listen
```

The helper reads the ignored local file, passes the test key through the child process environment, saves the CLI's signing secret to `.env.local`, and forwards the four Checkout events to the account-specific local handler. It rejects a non-local origin or live key and redacts signing secrets from output. Keep the listener running in a separate terminal while testing; Ctrl+C stops it. Restart the dev server if it does not reload the changed environment automatically. Never upload this local signing secret as the Vercel endpoint secret.

If payment completes but the private page is still pending, use **Refresh order status**. The server checks the saved Session, not the redirect query. A payment recovered within its hold becomes paid; one discovered after closure/deadline needs **Accept late payment and reserve stock** or verified refund in staff payment history. Webhooks are still necessary when customers do not return. See [Stripe fulfillment guidance](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted).

September 25 diagnosis: a read-only check of the configured real Stripe test account found the reported Checkout Session complete/paid but no webhook endpoint targeting the Sadboi route. Local forwarding was connected successfully; the Vercel webhook destination remains a separate setup step. No real charges or refunds were created by the diagnostic script.

## Google Cloud Scheduler

September 28 status: the user confirmed the deployed scheduler works after following the force-run, execution-log, and Firestore status verification instructions. Activation is checked off based on that user confirmation, not an independent agent inspection of cloud logs. This does not complete Stripe webhook verification or the full purchase/fulfillment test. Failure/stale-run alerting remains a separate operational task. This update supersedes the earlier scheduler-pending notes in this document.

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

Real hosted webhook verified September 28–29: SO-000004 (`0f1f9910a68742cd875dbdccdcc57d92`) used the dedicated $1 test SKU `STRIPE-VERIFY-20260928`. Its hold expired at `2026-09-28T20:05:36.003Z`; Stripe's completed event was created at `20:05:47Z` and the native webhook receipt `evt_1UKko4FYZnZRR1WFunB0ToBy` was saved at `20:05:49.195Z`. The return-page lookup followed at `20:05:52.579Z`. Both correctly recorded `late_success`, rather than silently reopening stock. A September 29 read-only Firebase check confirmed status expired, review required, allocation released, test stock on hand 1 / allocated 0 / reserved 0. No actual funds or physical goods changed hands, and existing artwork product balances were not used.

Deployed verification completed September 29 (America/Chicago; September 30 UTC), after browser reconnection and user staff sign-in:

- SO-000004: staff accepted the verified late payment through the review UI. Both the webhook and lookup receipts became resolved, the review flag cleared, and the order reopened as paid. Packing retained on-hand 1 / allocated 1; simulated pickup at `2026-09-30T02:50:15.823Z` produced fulfilled/delivered, on-hand 0 / allocated 0, exactly one `order_dispatch` movement of -1, and read-only fulfillment controls.
- Received one further explicitly labeled virtual test unit through the normal inventory UI. Fresh $1 sandbox SO-000005 (`f3cf621ef5344e049ac79a9aa092f7d1`) was created at approximately `02:52:12Z`, with deadline `03:22:12.375Z`. Stripe Session `cs_test_a1JQXrfXFknpgAwWHL9BKg91Hakq9UlLjpV3CSviZAGJggLlHckPsK99YV` completed/paid; native webhook `evt_1ULDdbFYZnZRR1WFHEXJGQFZ` was applied with `payment_confirmed` at `02:52:56.047Z`. No review was required, and the customer returned directly to Paid with no repeat-checkout button. The saved native event anchored payment; this was not solely return-page recovery.
- Before fulfillment, read-only diagnostics confirmed SO-000005 paid with on-hand 1 / allocated 1. Staff packed and simulated pickup, with the saved movement at `2026-09-30T02:59:04Z`. Staff and refreshed customer pages showed fulfilled. Inventory history showed one -1 dispatch for each test order, with final on-hand, available, reserved, and allocated all zero.
- Archived both the dedicated product and variant and set both to Private through the staff UI. A fresh public shop view showed only the pre-existing art print; the temporary product is no longer public. Orders and inventory/payment audit history were preserved. All units were virtual test fixtures; no real payment or goods changed hands.

The previously blocked deployed purchase/fulfillment checks are complete. The separate fresh checkout through the local CLI listener is still unverified; broader live launch, tax/shipping, notifications, refund execution, and returns remain outside this verification. No application code changed in this pass; the checks were against deployed UI, actual Stripe sandbox events, and read-only saved-state diagnostics. The following older pending-webhook/deployed-test notes are historical.

Payment-return recovery validated September 28: the combined suite passed **66 integration checks**, including missing-webhook recovery, concurrent lookups/webhooks, private-token enforcement, processing status, mismatched canonical data, Stripe outages, and late discovery. An initial run lost its local Next connection before lifecycle checks; the rerun completed successfully. Chrome confirmed paid return without a webhook, no repeat checkout button, refresh/reload with retained access, and an unpaid order remaining pending despite `?checkout=returned`. At 390×844 the paid page had no horizontal overflow. Test tabs and viewport overrides were cleaned up. `pnpm check` passed for the recovery code (76 core, 7 credential, 2 runtime tests, lint, typecheck, production build).

Real-account investigation confirmed the user's payment in Stripe and the local listener connected with a separately saved local signing secret. The original live-Firebase order has not been manually altered or marked resolved; its authorized private-page refresh will reconcile it under the existing deadline policy. A new real Stripe test checkout through the listener and the Vercel webhook deployment remain to be verified.

The final combined authentication/checkout/fulfillment/payment/lifecycle emulator run passed **63 integration checks**, including payment-versus-cancellation contention and a verified refund before the expiry sweep. All fixtures are disposable; the suite made no actual Stripe calls or live Firebase changes.

Final code checks passed on September 25: typecheck, lint, 76 core tests, 7 Firebase credential tests, 2 runtime compatibility tests, and the production build. Connected Chrome verified customer cancellation, retained access after a checkout return, staff cancellation with a reason, late-payment acceptance, the paid fulfillment state, and the saved resolution audit. The customer page has no horizontal overflow at 390×844. Browser tabs and temporary viewport overrides were closed/reset afterward. Full screen-reader, real-device, real Stripe sandbox and deployed scheduler checks remain outstanding.

`pnpm check` covers domain validation and production compilation. `pnpm test:order-lifecycle` runs the existing checkout/fulfillment/payment suites plus cancellation, expiry, signed Stripe fixture calls, acceptance and refund reconciliation in Firebase emulators. The local HTTP Stripe fixture exercises SDK serialization and signature checks but is not a real Stripe sandbox test. Run these commands sequentially because Next build/type artifacts are shared.
