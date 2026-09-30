# Build resumption — September 23, 2026

## Recovered context

Reviewed the project source, feature guides, checklist, and the local Codex session titled **Resume Next project build**, including its final September 22 messages. No Git repository existed at the start of this review, consistent with the original project direction. The user subsequently requested Git initialization and a private GitHub repository on September 23; the current repository is linked from the README.

The last completed work was storefront cart persistence and order confirmation, followed by product dialog styling: a sticky product title, description spacing, close-button stacking, and consolidation of `.shop-dialog-description`. The accepted cart border artwork, left-only repeating border, shadow, minimum 250px product cards, custom scrollbars, and automatic close after adding to cart remain the current design baseline.

Stripe setup remains deferred until the business/Stripe account is ready. Existing code includes staff access, artwork/private assets, products/inventory, contacts, purchasing/production records, financial foundations, public catalog/order requests, and initial fulfillment. These are foundations; broad checklist groups remain incomplete.

## Continued work

September 29 Stripe handoff completed (America/Chicago; September 30 UTC): test webhook `we_1UKkFdFYZnZRR1WFm2B7ww8S` remains active on deployment `GJzufT2bSt8iNmWQX3rtZNyjcK3r` / commit `80ba2b9`. Browser reconnection and user sign-in succeeded. SO-000004 (`0f1f9910a68742cd875dbdccdcc57d92`) had its verified late payment accepted through staff review, clearing both related receipts and reallocating stock; packing/pickup then completed. Fresh on-time SO-000005 (`f3cf621ef5344e049ac79a9aa092f7d1`) returned as paid, with native webhook `evt_1ULDdbFYZnZRR1WFHEXJGQFZ` applied at `2026-09-30T02:52:56.047Z`, and also completed pickup. Inventory history shows exactly one -1 dispatch per order, with final on-hand/allocated/reserved all zero. Dedicated product `Stripe verification TEST ONLY 2026-09-28` and SKU `STRIPE-VERIFY-20260928` are archived/private and verified absent from the public shop. Test orders/audit history remain for evidence; no existing artwork product stock or real funds were used. The deployed test purchase/fulfillment verification is complete. Local-listener checkout verification, live account migration, shipping/tax, notifications, refunds/returns, and broader checklist scope remain open. See [the detailed evidence](35-order-lifecycle-stripe.md). No application code changed during this verification.

September 28 scheduler update: user confirmed automatic stock-release scheduling works after the Cloud Scheduler and Firestore verification walkthrough. The build checklist now marks scheduler activation complete. Next: verify Vercel's Stripe test webhook and a deployed test purchase through payment confirmation and fulfillment. This supersedes earlier scheduler-pending notes below.

September 25 local Stripe return: diagnosed a successful test payment with no Sadboi webhook destination. Added canonical Session verification on private status access, stable verification receipts, guarded repeat-payment UI, and a local CLI forwarding helper. External Vercel webhook and scheduler activation remain separate tasks. See [current setup](35-order-lifecycle-stripe.md).

Completed a coherent reliability pass on public order creation and the persisted cart. See [public customer orders](29-store-orders.md) for behavior and limitations. Added a dedicated checkout emulator suite and in-app customer/staff guidance. No live business records were seeded or changed.

The initial `pnpm check` passed typecheck, lint, 55 domain tests, and the production build. After the changes, the final `pnpm check` passed typecheck, lint, 59 domain tests, and the production build; `pnpm test:store-orders` passed 35 authentication/checkout integration checks. Results are also recorded in [implementation status](07-implementation-status.md). Browser discovery returned no connected browsers, so visual/form interaction checks are not claimed.

## Next continuation

Latest validation: `pnpm check` passed with 76 core tests and the production build; the combined emulator suite passed 63 checks. Connected Chrome confirmed customer/staff cancellation and reviewed late-payment acceptance, with resolution history and mobile guest-page checks. See [setup and verification](35-order-lifecycle-stripe.md). No credentials, scheduler jobs, external payment accounts, or live business records were changed.

Latest continuation: pending-order cancellation/expiry and Stripe **test-mode** Checkout are implemented with private customer order access and staff review resolution. The user chose a 30-minute hold and a placeholder test account; Google Cloud Scheduler will invoke the Vercel endpoint directly. Follow [the setup/handoff guide](35-order-lifecycle-stripe.md) for environment variables, webhook, scheduler, and account migration. This supersedes the older deferred-provider/unfinished-expiry notes below. Next external work is deployment/configuration and real Stripe sandbox end-to-end verification; live payments remain disabled.

The September 25 continuation implements exact-allocation fulfillment, made-to-order handling, dispatch/collection consumption, pre-dispatch cancellation, revision checks, retry recovery, location rollups, inventory/audit history, and historical-record review. Orders is discoverable in staff navigation; accounting remains read-only. See [fulfillment](31-shipping-fulfillment.md) for scope and validation.

Validation: `pnpm check` passed with 67 core tests and a successful production build; the combined checkout/fulfillment emulator harness passed 45 checks. Connected Chrome exercised shipping, pickup, cancellation, stale-tab recovery, terminal read-only states, help, and narrow-screen/keyboard behavior using disposable records. No live records or payment provider configuration changed.

The subsequent September 25 payment slice protects successful payment/terminal order states, checks complete event identity, binds payment IDs across orders, records conflicts for review, and adds staff payment history and instructions. Exact replays and legacy records are handled explicitly. See [payment confirmation and review](30-stripe-payment-confirmation.md). The previously identified late-failure regression is repaired; no provider connection was activated.

Payment validation: `pnpm check` passed with 73 core tests and the production build; the combined authentication/checkout/fulfillment/payment harness passed 56 checks. Browser checks used a disposable accounting account to verify history, review markers, refresh, empty/error states, read-only controls, help, and phone-width/keyboard behavior. Full screen-reader and real-device testing remain outstanding.

1. Add pending-order cancellation/expiry and safe late-payment reconciliation, including a reviewed resolution workflow for payment flags. Payment after cancellation is now recorded for review without reopening the order; actual reallocation/refund resolution remains unfinished.
2. Add shipping rates/tax decisions, customer access/notifications, and the deferred provider connection.
3. Continue the larger dependency-ordered build checklist after these commerce boundaries are reliable; preserve whole-order fulfillment limits until partial shipments/returns are designed.
