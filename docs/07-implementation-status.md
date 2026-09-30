# Implementation status

September 29 deployed Stripe verification completed (America/Chicago; September 30 UTC): after browser reconnection and staff sign-in, SO-000004's verified late payment was accepted through the staff UI, resolving both related receipts and reallocating its virtual test unit. Packing retained stock; pickup consumed exactly one unit. Fresh on-time sandbox order SO-000005 returned from Stripe as paid, with a native applied webhook receipt, and completed packing/pickup with one further stock deduction. Both orders are fulfilled. The dedicated test product and variant are archived/private, stock and allocations are zero, and the public shop no longer lists the test item. No actual funds or goods changed hands. See [evidence and remaining scope](35-order-lifecycle-stripe.md). This supersedes earlier browser-blocked, webhook-pending, and deployed-verification-pending statements below. Live payments remain disabled; local-listener checkout verification and broader commerce scope remain open.

September 28 scheduler update: the user confirmed Google Cloud Scheduler is working after the execution-log/Firestore verification walkthrough. Deployed scheduler activation is complete; earlier scheduler-pending statements below are historical. Vercel's Stripe webhook and the complete deployed test purchase/fulfillment flow still need verification.

September 25 payment-return fix: private order status verifies the saved Checkout Session directly with Stripe and records an idempotent verification receipt through the existing payment handler. The UI suppresses repeat payment during processing, review, or verification failure. Late discovery preserves stock-expiry review rules. `pnpm stripe:listen` configures local test forwarding using the ignored local environment. See [setup and verification](35-order-lifecycle-stripe.md).

Public gallery and shared navigation: `/art`, individual artwork pages, explicit publishing from Artwork, and a common public navbar are implemented. See [gallery scope and verification](34-public-gallery.md). Gallery publication does not depend on product stock and does not publish existing private records automatically.

Updated September 23, 2026, in `C:\Users\azizk\magkamco\sadboi-platform`.

Use the [build checklist](06-build-checklist.md) as the authoritative scope tracker. Every completed user-facing workflow also has an in-app how-to requirement described in the [feature build guide](14-feature-build-guide.md).

## Working now

- September 25 lifecycle continuation: 30-minute pending holds, exact cancellation/expiry releases, private customer order status/cancellation, test-only Stripe hosted Checkout with account-scoped signed webhooks, and staff late-payment reallocation or completed-refund verification. [Configuration and scope](35-order-lifecycle-stripe.md). Scheduler and actual Stripe test account activation are external setup steps, not yet verified.

- Vercel Firebase Admin credential support through the server-only `FIREBASE_ADMIN_CREDENTIALS` JSON secret, with project validation, redacted configuration errors, preserved local ADC, and emulator isolation. See [deployment guide](33-vercel-deployment.md); actual production access still needs deployment verification.

- Next.js/React application with a UI-independent TypeScript core, Firebase Auth, server-verified sessions, CSRF/origin protection, and server-owned memberships.
- Super-admin Workspace access: role-scoped legal/accounting invitations, claims, resend/revoke records, membership revocation/reactivation, session invalidation, revisions, idempotency, and audit history.
- Shared artwork records with metadata, search, archiving, private originals/previews, hashes, authorized downloads, asset validation, and audit events.
- Products linked permanently to artwork; variants with permanent unique SKUs, USD prices, attributes, fulfillment policy, and archive status.
- Inventory locations, receiving, quarantine/release/discard, physical counts, signed corrections, low-stock thresholds, replenishment suggestions, transfers, transit outcomes, revision checks, and immutable movement history.
- Purchasing suppliers, multi-line draft/placed orders, frozen snapshots, partial inspected deliveries, rejected/quarantined/accepted outcomes, cancellation of remaining commitments, and delivery history.
- Manual per-SKU supplier production progress, revised delivery forecasts, outstanding production queue, immutable update history, and linked audit/operation records.
- Responsive staff navigation, role-scoped accounting views, contextual links, and the `/admin/how-to` guide covering Workspace, contacts, catalog, stock, purchasing, production, receiving, replenishment, and transfers.
- Contacts and organizations with relationship labels, organization links, notes, follow-ups, archive status, role-scoped reads, revision-safe edits, and audit history.
- Printer quotes tied to suppliers and SKUs, setup/shipping-inclusive cost comparison, quote statuses and expiry fields, and accepted-quote snapshots on draft purchase orders.
- Print-file handoff and proof history on purchase orders, using private artwork assets, SKU-specific versions, revision-safe status updates, and automatic superseding of older approved proofs.
- Physical production batches linked to order SKU lines, with run quantities, waste/spoilage, status history, quantity limits, and audit records; supplier capacity estimates feed the production queue.
- Reprint requests linked to an original batch, with reason, replacement quantity, approval status, revision checks, and audit history.
- Vendor bill register linked to suppliers and optional purchase orders, with server-calculated totals, invoice dates, due dates, statuses, and audit history.
- Balanced journal entries linked uniquely to vendor bills, with debit/credit validation, source protection, and audit history.
- Payment attempt and settlement records linked to vendor bills, with method/status history, overpayment protection, and automatic bill closure when fully settled.
- Refund records linked to settled payments, with status history, reason/reference data, and refund-overpayment protection.
- Payment allocations, payment disputes, reconciliation records, and server-enforced accounting period locks.
- Location-specific reservations and allocations for commissions, events, wholesale, and internal holds, with transactional stock protection and release/fulfillment history.
- Public catalog publication controls and a server-filtered `/shop` page that exposes only active public products and variants with online availability.
- Public order foundation with server-side publication/availability rechecks and transactional allocation of stocked quantities.
- Persistent public cart with validated catalog data, order confirmation, and retry-safe multi-line checkout. Pending requests recover the same order after lost responses; stock allocation and numbering commit once. See [public customer orders](29-store-orders.md).
- Paid-order fulfillment uses exact checkout allocations, consumes stock at dispatch/collection, releases it on pre-dispatch cancellation, maintains location totals and history, and protects retries, stale edits, and terminal states. Historical records needing reconciliation are blocked. See [fulfillment](31-shipping-fulfillment.md).
- Payment confirmation preserves paid/fulfilled/closed states, validates full event identity, binds payments to one order/account, and records mismatches/additional payments/late successes for review. Orders includes staff/accounting payment history and reviewed resolution. See [payment confirmation](30-stripe-payment-confirmation.md) and [Stripe test setup](35-order-lifecycle-stripe.md).
- Stripe Checkout and signature verification are implemented for test mode only. Placeholder test credentials, external webhook deployment, scheduler activation, and real sandbox verification remain pending configuration.

Start the development server with `pnpm dev` at `http://127.0.0.1:3100`. Live business records are not seeded by the test suites; emulator tests use disposable local Firebase services.

## Validation

- September 25 lifecycle/Stripe continuation: `pnpm check` passed typecheck, lint, 76 core tests, 7 credential tests, 2 runtime tests and the production build. The final combined emulator suite passed 63 integration checks. Browser verification covered guest and staff cancellation, late-payment acceptance, persisted resolution audit, return-page access, and the guest page at 390×844. See [full scope and setup](35-order-lifecycle-stripe.md). Actual Stripe sandbox and deployed scheduling verification remain outstanding.

- September 25 payment continuation: `pnpm check` passed typecheck, lint, 73 core tests, 7 Firebase credential tests, 2 Firebase runtime tests, and the production build. The combined checkout/fulfillment/payment emulator harness passed 56 checks. Connected Chrome verified accounting payment history, review markers, load/refresh, empty/error states, read-only controls, help, keyboard focus, and no horizontal overflow at 390×844. See [payment validation](30-stripe-payment-confirmation.md).

- September 25 fulfillment: `pnpm check` passed typecheck, lint, 67 core tests, 7 Firebase credential tests, 2 Firebase runtime tests, and the production build. The Auth/Firestore harness with `--store-orders --fulfillment --fulfillment-preview` passed all 45 authentication/checkout/fulfillment checks.
- Connected Chrome, disposable emulator data: completed pack → ship → deliver, address-free made-to-order pickup, pre-dispatch cancellation, persisted tracking/notes, terminal read-only controls, two-tab stale-save rejection/reload, and the contextual help link. At a 390×844 viewport the pickup form had no horizontal overflow, 16px form text, and working keyboard focus. No browser console errors were observed; full screen-reader and real-device validation remain outstanding.

- `pnpm check` passes type checking, ESLint, 59 core domain tests across 20 files, and the production build (September 23).
- `pnpm test:store-orders` passes 35 authentication/checkout emulator checks (September 23), including duplicate/concurrent submissions, multi-line allocation, publication checks, shortage rollback, and last-unit contention.
- Previously recorded: `pnpm test:workspace` passed 33 authentication/Workspace emulator checks; this suite was not rerun during the September 23 checkout slice.
- Previously recorded: `pnpm test:purchasing` passed 145 authentication, artwork, inventory, purchasing, production, and tutorial integration checks; this suite was not rerun during the September 23 checkout slice.
- Firebase rules checks and artwork/inventory suites pass as recorded in their feature documents.
- Historical September 23 validation had no connected browser. Subsequent gallery and fulfillment browser checks are recorded in their feature guides; real email-link completion remains outstanding.

Run build and emulator suites sequentially. Next route type generation writes shared generated files, so overlapping build/test processes can interfere with one another.

## Current limits

Application caps and workflow limits are documented with each feature: [artwork](10-shared-artwork.md), [inventory](11-inventory.md), [purchasing](13-purchasing.md), [production](15-supplier-production.md), [Workspace access](16-workspace-access.md), [contacts](17-contacts.md), [printer quotes](18-printer-quotes.md), [print-file handoff](19-print-file-handoff.md), [production batches](20-production-batches.md), [reprint requests](21-reprint-requests.md), [vendor bills](22-vendor-bills.md), [balanced journals](23-balanced-journal.md), [payments](24-payments.md), [refunds](25-refunds-and-disputes.md), and [financial controls](26-financial-controls.md). The Firebase project is on Blaze billing, but live Firestore/Storage/Auth consumption and billing totals are not tracked in the application yet.

The platform still lacks external supplier file delivery, signed proof approvals, calendar/production capacity reservations, live paid storefront checkout, shipping rates/labels, customer accounts, returns, commissions, agreements, licensing, events/POS, backups/monitoring, and automated email delivery. Existing journals, vendor bills, batches, stock reservations, publication, payment confirmation, and fulfillment are foundations rather than completed end-to-end modules.

The September 25 slices add reliable fulfillment, payment-event ordering/identity, pending-order expiry/cancellation, private guest access, and verified late-payment resolution. External activation and remaining limits are in [Stripe setup](35-order-lifecycle-stripe.md). The platform is not ready for live paid checkout.

## Next build sequence

1. Configure the placeholder Stripe test credentials, signed webhook and Google Cloud Scheduler job; verify actual sandbox checkout, expiry and review recovery.
2. Complete shipping/tax decisions, customer communications, receipts and returns; migrate to Sadboi's account and separately review live-payment readiness.
3. Continue capacity planning, production lead times, financial posting/cost connections, and later modules in the build checklist.

The original preview-only status is superseded by this connected-platform status. Feature-specific history remains in guides 08–32.
