# Payment disputes

October 1, 2026. First staff-managed Stripe **test-mode** dispute workflow. Open an order in **Orders**, choose **Load payment disputes**, then **Refresh Stripe disputes**. In-app instructions: `/admin/how-to#payment-disputes`.

## Workflow and boundaries

Super admins can refresh the original confirmed payment's disputes and save a private response plan, evidence references and update notes. Accounting can read saved history. Legal users, anonymous visitors and customer private-order pages cannot access dispute details or notes.

Each dispute shows its canonical Stripe amount, reason, status, response deadline, evidence presence and submission count. A local plan to challenge or accept is only a note. Staff submit evidence or accept a dispute in the Stripe Dashboard, confirm the correct account and test mode, then refresh the order. No provider evidence, acceptance, refund or email command is issued by this feature.

Known open disputes and lost disputes hold unshipped fulfillment, replacement preparation/dispatch and new app refund commands. Cancellation can still release an existing stock allocation. Already-shipped goods can still receive tracking/delivery updates. A verified `won`, `warning_closed` or `prevented` outcome removes only the dispute hold; it does not reopen an order, allocate stock, reverse a refund, post a journal or change fulfillment. These holds depend on received or refreshed provider information and cannot prevent actions before an unknown dispute is discovered.

## Provider synchronization and recovery

Signed `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn` and `charge.dispute.funds_reinstated` events trigger canonical provider reads. The event payload's status/amount is not applied directly. Validation binds the dispute to the saved test account, original PaymentIntent, charge, currency, amount received and order metadata. Additional/unaccepted late payments remain in Payment history review and are outside this order-level dispute panel.

Manual refresh lists up to 20 disputes for the original payment. Incomplete lists, unknown formats, provider outages and mismatched ownership retain the prior saved history and holds. An overlapping refresh rejects stale results rather than overwriting a newer refresh. Repeated identical provider snapshots do not duplicate status history.

The existing order-expiry scheduler also rechecks already-known open disputes, up to three records per run with a persisted cursor. It does not discover every account dispute or provide deadline reminders. Closed/lost outcomes can still be refreshed manually or by a later webhook. Review deadlines in Stripe; this screen shows the last saved provider report.

Private notes use separate revisions, immutable history and actor-scoped operation IDs. An exact retry returns the original result without duplicating history, even after later edits. A stale edit must reload. The browser retains an uncertain request in session storage and offers **Retry same dispute note**. Reloading replaces unsaved form edits. The screen shows the latest 30 provider updates and 30 notes; older entries remain stored. Notes are limited to 200 updates per dispute.

## Records and access

- `storeOrders.disputeState`: revision, last check and normalized snapshots used atomically by fulfillment/refund/replacement guards.
- `storeDisputes`: account/test/dispute-scoped hashed IDs, canonical snapshot, provider fingerprint/revision, private plan and note revision, synchronization flag.
- `storeDisputes/{id}/providerHistory` and `/notes`: append-only provider observations and staff updates.
- `disputeNoteOperations`, `inventoryAudit`: idempotency results and staff audit history.
- `inventoryState/orderDisputes`: scheduler cursor, last run and per-order outcomes.

Server APIs enforce roles, origin/CSRF and strict command schemas. Existing Firestore client-deny rules cover these server-owned records. No new environment variables or composite indexes are required.

## Deployment

Deploy the app, then include the five dispute events listed above in the existing Stripe **test** webhook subscription. The local listener and Vercel webhook helper event lists include them; no external subscription was changed during development. Verify an actual sandbox dispute, webhook delivery, saved deadline/status, private note history and scheduler reconciliation with dedicated test records. Manual refresh remains available for a mapped confirmed test payment. Keep live payments and order-email sending disabled.

## Validation

`pnpm check` passed: type checks, lint, 98 domain tests, 7 credential tests, 2 runtime tests and production build. The focused disposable emulator suite passed **32 integration checks** and shut down successfully.

The full `pnpm test:disputes` commerce suite passed **119 integration checks**, including the cancelled/refunded duplicate-payment regression, email previews, returns/refunds, shipment cases and replacement stock effects. All emulator processes shut down successfully. A final `pnpm typecheck` regenerated normal Next.js route types and passed; `git diff --check` also passed.

Chrome verified super-admin note submission using the keyboard, saved note history, local Stripe refresh with retained notes, linked how-to and a 390px viewport without horizontal overflow. No browser console errors were captured. The temporary tab and viewport override were cleaned up. Full screen-reader and real-device testing remain outstanding.

The disposable HTTP Stripe fixture verifies canonical signed event handling, duplicates, role/CSRF boundaries, private-note concurrency/retries, incomplete-list/outage retention, customer-data exclusion, scheduler reconciliation, fulfillment/refund/replacement holds, cancellation and closed outcomes. No real provider, business records or external messages are involved.

## Remaining scope

Actual evidence uploads/submission and dispute acceptance remain in Stripe. Live-mode payments, dispute fees/accounting journals, response reminders, customer notifications, additional/unaccepted payment mapping and customer self-service remain open. Domain/Google Workspace/Resend activation and live carrier quotes remain deferred.

Provider references: [dispute fields and statuses](https://docs.stripe.com/api/disputes/object), [listing disputes by payment](https://docs.stripe.com/api/disputes/list), and [responding to disputes](https://docs.stripe.com/disputes/responding).
