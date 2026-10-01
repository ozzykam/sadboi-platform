# Build checklist

Origin labels: **B** = freelancing business project; **E** = ecommerce template; **N** = new work. A combined label means adapted source functionality plus new behavior. Concrete source paths and limitations are in [the reuse map](02-source-audit.md).

Firebase project initialization and 10 passing baseline rules checks are recorded in [Firebase setup](08-firebase-setup.md). Staff authentication is recorded in [staff sign-in](09-staff-sign-in.md). Shared artwork and private uploads are recorded in [shared artwork status](10-shared-artwork.md), with 59 integration checks. Products and the first stock workflow are recorded in [inventory status](11-inventory.md). Authorization for remaining business modules, general seed fixtures, and browser tests remain outstanding.

The first application/catalog slice is recorded in [implementation status](07-implementation-status.md). Partially implemented task groups remain unchecked. Phases express dependencies, not deadline priorities. A module is complete only when its operational flow, permissions, error/retry behavior, mobile UI, acceptance scenario, and in-app how-to work together.

## Completion criteria for every feature

September 25 payment-return recovery: canonical Stripe lookup on authorized private order access, idempotent verification receipts, unavailable/processing UI, and local CLI webhook forwarding are implemented. Missed confirmations after the stock deadline still require review. See [payment setup](35-order-lifecycle-stripe.md); Vercel webhook activation remains outstanding.

September 25 pending-order/Stripe slice: 30-minute holds, customer/staff cancellation, a protected scheduled expiry endpoint, Stripe test Checkout and signed webhooks, private order access, and verified late-payment acceptance/refund resolution are implemented. See [setup and limitations](35-order-lifecycle-stripe.md). The user confirmed deployed scheduler operation on September 28; full Stripe sandbox verification remains pending. Broad reservation, live-payment, refunds, financial and customer-account groups remain unchecked.

September 25 fulfillment slice: exact paid-order allocations, dispatch/collection and pre-dispatch cancellation, revision/retry safety, location rollups and history, staff/accounting UI, and linked how-to are implemented. See [fulfillment scope and verification](31-shipping-fulfillment.md). Broader commerce/fulfillment groups remain open for payments, partial shipments, shipping labels/rates, notifications, and returns.

September 25 payment slice: provider event identity/replay, success/terminal-state protection, cross-order payment binding, conflict review records, staff payment history, and linked instructions are implemented. See [payment scope and verification](30-stripe-payment-confirmation.md). Payment collection/provider connection, expiry, review resolution, automated refunds, and complete paid commerce remain unchecked.

Apply these criteria to every task in every phase, including extensions to existing features. Follow the [feature build guide](14-feature-build-guide.md).

- [ ] Implement the complete authorized workflow, permissions, validation, concurrency/retry behavior, and responsive interface.
- [ ] Add or update a role-appropriate in-app how-to: purpose, prerequisites, exact screen/button steps, a worked example, effects on connected records, and relevant limits.
- [ ] Explain editing, cancellation/archiving, mistakes, stale records, and uncertain-save recovery wherever those actions apply.
- [ ] Link the feature screen directly to its tutorial; make it discoverable from How-to without exposing restricted data or actions.
- [ ] Verify tutorial instructions against the actual implementation, run appropriate checks, and record remaining verification gaps.
- [ ] Update implementation status and this checklist; mark larger groups complete only when their entire scope is complete.

Tutorial coverage: Workspace access, contacts, product/variant creation and editing, archiving, stock counts, supplier orders, printer quote comparison, print-file handoff and proof approval, production progress, delivery inspection, replenishment, and transfers have an in-app guide at `/admin/how-to`. Detailed sign-in/account recovery and artwork metadata/private uploads still need dedicated walkthroughs. Extend the help area for the roles and features added in later phases.

## 0. Establish the new application

- [x] **B/E/N** Create the application/workspace under this project without initializing a Git repository.
- [x] **B/E/N** Resolve current stable compatible dependencies, pin the runtime/tooling, and generate one lockfile. See the implementation note for the Node 24 target and validated Node 22 environment.
- [ ] **N** Add environment validation and placeholder-only examples; use distinct development/staging/production bindings.
- [ ] **B/E/N** Record each copied module's origin; exclude credentials, generated folders, old business data, test endpoints, and unrelated features.
- [ ] **N** Define shared IDs, timestamps, currency/minor-unit money, schemas, errors, pagination, and operation idempotency conventions.
- [ ] **N** Establish emulator setup, seed fixtures, lint, typecheck, build, domain-test, rules-test, and browser-test commands.
- [ ] **N** Confirm the Firestore decision with stock-contention, balanced-posting, and representative reporting prototypes before real data migration.

**Acceptance:** A clean install starts locally with explicit missing-configuration errors; development cannot accidentally use the original businesses' credentials or data.

## 1. Identity, storage, and reliable operations

- [x] **B/E/N** Implement login/account UI, verified server sessions, logout/revocation, and CSRF protection. See [staff sign-in and 24 emulator checks](09-staff-sign-in.md); visual/browser verification remains outstanding.
- [x] **N** Bootstrap the two super admins and implement server-owned memberships and legal/accounting invitations. Staff access management is documented in [Workspace access](16-workspace-access.md); browser verification remains outstanding.
- [ ] **N** Enforce role, business, record ownership, and field-level access across APIs, jobs, exports, and file access.
- [ ] **B/E/N** Replace source rules with tested Firestore/Storage policies; prevent users from assigning their own roles.
- [ ] **N** Build a private asset/document vault and separately published image derivatives.
- [ ] **N** Add upload validation, quarantine/processing, versions, hashes, download authorization, and retention metadata.
- [ ] **N** Build append-only audit events, durable outbox/inbox, retryable jobs, and failed-work queues.
- [ ] **B/E/N** Adapt email templates; configure a fresh sending identity and delivery/bounce tracking.
- [ ] **B/N** Add rate limits to inquiry, login, invitation, checkout, and download endpoints.
- [ ] **N** Add logging redaction, error monitoring, backups, data export, and a restore procedure.

**Acceptance:** A customer cannot change their role or view another customer's records; legal/accounting scope holds through direct API requests; private files are inaccessible through public URLs; failed jobs can be retried safely.

## 2. Contacts, artwork, products, and editions

Implemented artwork foundation: shared metadata, series/tags, rights/status, archiving, search of loaded records, optimistic edit conflicts, private originals/previews, hashes, authorized downloads, and audit events. Broader task groups below remain open for credits/publication, print/proof workflows, products, and remaining browser verification.

- [x] **B/N** Adapt prospects into contacts/organizations, relationships, notes, and follow-ups. Inquiry pipelines remain a separate future workflow. See [contacts](17-contacts.md).
- [ ] **N** Implement artwork metadata, series, tags, credits, rights/publication status, search, and asset relationships.
- [ ] **N** Implement master/proof/print/preview versions and print specifications with approvals.
- [ ] **E/N** Adapt product editor/browser for artwork links, variant SKUs, options, prices, dimensions, shipping weight, and packaging.
- [ ] **N** Support open and limited editions, artist proofs, unique units, certificates, and public verification without exposing collector details.
- [ ] **E/N** Add collections, discounts, publication scheduling, stock messaging, and related art/products.
- [ ] **N** Support stocked, made-to-order, and preorder policies with production limits and honest lead times.
- [ ] **N** Implement original-art/catalog onboarding and validation; record provenance instead of assuming historical INPRNT data access.

**Acceptance:** One artwork has several sellable variants and a separate license without duplicating its master; a portfolio-only collaboration has no checkout; edition units cannot reuse a number or exceed the approved cap.

## 3. Inventory and print production

Implemented foundation: permanent variant SKUs, USD prices, stocked/made-to-order metadata, location eligibility, receiving and quarantine, reasoned count corrections, physical counted totals with discrepancy review/history, per-location low-stock thresholds and a replenishment queue, partial transfers/receipts/losses, revision checks, idempotent operations, and movement history. See [counts and replenishment](12-stock-counts-and-replenishment.md) for the latest workflow and validation. Reserved/allocated units are protected, but reservation commands and production workflows are still pending. Larger task groups remain unchecked until their full acceptance scenarios and browser verification are complete. See [inventory status](11-inventory.md).

- [x] **E/N** Adapt supplier contact concepts and build printer capabilities, quotes, and cost comparison records. See [printer quotes](18-printer-quotes.md).
- [ ] **N** Build purchase orders, print-file handoff, proof approval, production batches, and lead-time tracking. Purchase orders, proof versions, approval history, and batch records are implemented; capacity planning and lead-time automation remain.
- [ ] **N** Record partial receiving, quality acceptance, damage/rejection, reprints, supplier bills, and landed cost.
- [ ] **N** Implement storage, event, gallery, and transit locations with explicit fulfillment eligibility.
- [ ] **N** Implement stock movements, physical balances, reservations, allocations, and invariant checks.
- [ ] **N** Implement transfer dispatch/receipt, count adjustments with reasons, stocktakes, and discrepancy reports.
- [ ] **N** Implement low-stock thresholds, replenishment queues, and inventory valuation inputs.
- [ ] **N** Reserve production/edition capacity separately from physical stock for nonstocked products.
- [ ] **N** Add reservation expiry and late-payment reconciliation without releasing unsettled stock blindly.

**Acceptance:** Concurrent website/event requests for the last available unit produce one reservation; transfer-in-transit units cannot sell twice; damaged prints never enter sellable stock; partial receiving updates only accepted quantities.

Supplier directory, multi-line draft/placed purchase orders, immutable order snapshots, partial inspection receipts, and cancellation of remaining commitments are now implemented. Accepted and retained damaged units update stock atomically with the order; rejected units stay outside inventory. See [purchasing status](13-purchasing.md). Quote records, proof/file handoff, scheduling, reprint automation, supplier bills, and landed-cost allocation remain open, so their broader task groups above stay unchecked.

Manual per-SKU supplier progress, revised delivery forecasts, an outstanding production queue, immutable update history, and the in-app production tutorial are implemented. See [supplier production](15-supplier-production.md). This does not complete physical production batches, version-specific proof approval, capacity allocation, or scheduling, so the broader production tasks remain unchecked.

## 4. Financial and payment foundations

- [ ] **B/N** Adapt proposals/invoices with atomic numbering, minor-unit calculations, immutable issue snapshots, due dates, and installment schedules.
- [ ] **N** Create chart of accounts, balanced journal entries, source uniqueness, reversals, adjustments, and period locks.
- [ ] **N** Implement payment attempts, settled payments, allocations, fees, refunds, disputes, and payouts as separate records.
- [ ] **B/E/N** Build server-calculated quotes and authorized payment commands with stable attempt keys.
- [ ] **E/N** Replace webhook effects with verified durable receipts, deduplication, retries, and provider reconciliation.
- [ ] **N** Configure base currency and approved tax/recognition/costing policies; remove example rates and fee assumptions.
- [ ] **N** Build expenses/receipts, vendor bills, payables/receivables, manual bank/cash entries, and statement import with deduplication.
- [ ] **N** Link operational stock costs and revenue sources to ledger postings without double counting.

**Acceptance:** Tampering with a cart amount cannot reduce the Stripe charge; repeated/out-of-order webhooks do not duplicate payments, allocations, stock effects, or postings; every posted journal balances; payouts do not inflate sales.

## 5. Shop, checkout, fulfillment, and after-sales

Stripe test-mode implementation status, September 29 (America/Chicago): the application integration is built and verified with 66 combined emulator integration checks plus browser checks. Hosted Stripe Checkout is the implemented payment UI. The deployed flow now passes real sandbox webhook delivery, late-payment review resolution, on-time payment confirmation, packing, pickup, and stock-history verification. SO-000004 and SO-000005 are fulfilled; the temporary product and variant are archived/private with zero stock or allocations and are absent from the public shop. Live payments remain intentionally disabled. See [Stripe setup and validation](35-order-lifecycle-stripe.md).

- [x] **E/N** Implement hosted Stripe test Checkout with server-owned totals, saved account bindings, and idempotent Session creation.
- [x] **N** Verify signed webhooks and canonical Stripe Sessions; deduplicate payment confirmations and protect stock/order state.
- [x] **N** Recover missed webhook confirmations through authorized private-order status checks and suppress repeat payment for completed or uncertain checkouts.
- [x] **N** Implement 30-minute holds, customer/staff cancellation, the expiry worker endpoint, and late-payment acceptance/verified-refund review.
- [x] **N** Provide local Stripe CLI forwarding and environment setup instructions, with credentials excluded from Git.
- [ ] **N** Verify a fresh real Stripe test checkout through the local listener, including the saved paid order and unchanged physical stock until fulfillment.
- [x] **N** Deploy the latest changes, configure Vercel's account-specific Stripe test webhook and signing secret, and verify real signed payment-event delivery independently of the local listener. Verified with SO-000004 and its native Stripe event receipt.
- [x] **N** Resolve SO-000004's late-payment review, verify pickup stock deduction, run a fresh on-time deployed test checkout (SO-000005), and archive the dedicated test product. Both orders completed pickup with exactly one deduction each; the test product and variant are archived/private and no longer public.
- [x] **N** Activate and verify the automatic stock-release schedule (Google Cloud Scheduler). User confirmed it works on September 28 after following the Scheduler execution/Firestore verification instructions.
- [ ] **N** Future live launch: transition to Sadboi's account, implement live-mode enablement, and complete shipping/tax/operational readiness. This is outside the current test-only scope.

September 23 continuation: persisted cart validation and retry-safe multi-line order requests are implemented, including transactional stock protection, parent-product publication checks, immutable line/allocation snapshots, and customer/staff recovery guidance. See [public customer orders](29-store-orders.md) and [build resumption findings](32-build-resume.md). Payment/fulfillment foundations still require lifecycle fixes and integration coverage; these broader tasks remain unchecked.

- [ ] **E/N** Adapt catalog filtering, product imagery, cart drawer/page, variant selection, guest cart, and account cart merge.
- [ ] **E/N** Adapt checkout for guest/account identity, addresses, shipping/pickup, validated discounts, totals, and pending states.
- [ ] **E/N** Integrate Stripe Payment Element and eligible wallet methods with server-created payment attempts.
- [ ] **N** Connect order confirmation to inventory allocation and ledger posting through the reliable payment flow.
- [ ] **E/N** Adapt admin order and fulfillment queues for print production, pick/pack, split packages, and pickup.
- [ ] **N** Configure destinations, shipping rates, packaging, carrier/label adapter, tracking, insurance/customs fields where applicable.
- [x] **N** Implement US flat-rate standard/express shipping, selected destination states, free pickup, reviewed server totals, stale-price/rate protection and saved breakdowns across checkout, Stripe, customer/staff views and email previews. Verified locally with production build, 88 domain tests, 89 combined integration checks, 33 disabled-email checks and Chrome desktop/390px checks. See [shipping scope and evidence](38-shipping-and-checkout-totals.md). Production rate setup, tax, packaging and carrier/label work remain open.
- [ ] **N** **Deferred by user September 30:** add live carrier quotes after the studio's packaging and shipping process is settled. Continue first with staff-configured US flat rates and free studio pickup; actual carrier integration remains on the todo list.
- [ ] **E/N** Adapt order history, receipts, status emails, customer tracking, and authorized guest-order access.
- [x] **N** Implement order-received/payment-confirmed email queue, private order links, staff previews/history, Resend adapter and bounded retries. Verified with 75 combined integration checks, 27 disabled-mode checks, production build and Chrome desktop/phone-width checks. See [order emails](36-order-emails.md).
- [x] **N** Implement pickup-ready, shipment and tracking-update notifications, obsolete-unattempted-message suppression, staff previews/retry/history, and current fulfillment/tracking on private customer order pages. Verified with 83 combined and 33 disabled-mode integration checks, 81 domain tests, production build and Chrome desktop/phone-width checks. See [fulfillment notifications and required deployment indexes](37-fulfillment-notifications.md).
- [ ] **N** **Deferred by user September 30:** deploy and activate email delivery with a verified Resend sender, monitored reply inbox, approved test recipients, and real inbox-delivery verification. Domain, Google Workspace and Resend setup will wait while feature development continues; keep sending disabled. Resume using the [saved activation checklist](36-order-emails.md#setup-for-approved-test-inboxes). Delivery/collection confirmation emails, bounce tracking and customer link-request recovery remain open.
- [ ] **E/N** Build returns/exchanges, refund authorization, actual Stripe refund execution, provider status updates, and restock decisions.
- [x] **N** Implement the staff-managed first slice: full/partial Stripe test refund commands, canonical provider status and recovery, received-return records, sellable/quarantine/discard stock decisions, customer-safe summaries and in-app instructions. See [returns/refunds scope and evidence](39-customer-returns-and-refunds.md). Exchanges and customer self-service remain deferred.
- [x] **N** Verify the deployed staff refund flow against Stripe's test environment. User confirmed refunding works after the paid, unfulfilled-order cancellation/refund walkthrough on September 30. This is user-reported verification; refund amount and provider identifiers were not supplied.
- [ ] **N** Independently verify deployed refund webhook subscriptions/delivery, duplicate-event handling and scheduled refund reconciliation. A successful staff refund alone does not establish these paths. Live refunds, refund notifications, exchanges and financial journal reversals are outside the completed slice.
- [ ] **N** Build damaged/lost shipment and payment dispute workflows with evidence and resolution history.
- [x] **N** Implement staff-managed damaged/lost shipment cases and replacement shipments, with private evidence references, audited resolutions, refund/receipt links, safe stock allocation/cancellation/dispatch and customer tracking. Combined commerce regression passed 109 checks; see [scope and verification](40-shipment-cases-and-replacements.md). The broader group remains open for payment disputes.
- [ ] **N** Deploy shipment cases/replacements and verify the deployed workflow with dedicated test records. Evidence uploads, carrier claims/labels, replacement emails and customer self-service remain separate work.
- [ ] **E/N** Adapt wishlist/restock notifications where enabled, with consent and variant-aware availability.
- [ ] **N** Configure shipping/returns/privacy terms and customer support contact content.

**Acceptance:** Complete a sandbox purchase through dispatch and tracking, a split shipment, a pickup, a partial refund with damaged stock, and an exchange; customer totals, stock, fees, and ledger remain consistent throughout.

## 6. Events, galleries, and POS

- [ ] **N** Build event/gallery records, applications, booking states, calendar, contacts, contracts, and preparation tasks.
- [ ] **N** Build packing lists, event stock transfers, consignment agreements, itemized gallery reports, returns, and discrepancies.
- [ ] **E/N** Build mobile POS with SKU search/scan, cart, selected event/location, totals, discount permissions, and receipts.
- [ ] **N** Integrate Stripe Terminal server-driven reader discovery/configuration and payment attempts; validate device/region support.
- [ ] **N** Add reader locking, pending state, cancel/retry reconciliation, and confirmation before handoff.
- [ ] **N** Add order-specific QR online checkout; prevent simultaneous reader/QR attempts from producing unresolved duplicate charges.
- [ ] **N** Record cash and legacy Venmo tenders distinctly, with references and reconciliation.
- [ ] **N** Design connectivity failure handling; browser POS does not promise offline card acceptance.
- [ ] **N** Build gallery commissions, expected/actual settlement payments, event expenses, and profitability.
- [ ] **N** Build event closeout: unsold stock return, cash/processor reconciliation, missing payments, and final result.

**Acceptance:** A convention sale updates the same stock as the website and is attributed to the event; a gallery shipment generates no sale until reported sold; a settlement clears its receivable once; actual reader and connectivity failure tests pass before live use.

## 7. Projects and commissions

- [ ] **B/N** Adapt project, task, time, prospect, and proposal screens for commission/internal art workflows.
- [ ] **N** Build inquiry brief, qualification, deliverables, revision policy, estimates, milestones, budget, and optional deadlines.
- [ ] **B/N** Connect proposal acceptance, required agreement, deposit, milestone invoices, and final balance.
- [ ] **N** Build commission portal with client-safe status, messages, proof versions, annotations/comments, and explicit approvals.
- [ ] **N** Track included/extra revisions and accepted change orders; retain old scope/price versions.
- [ ] **N** Gate final deliverables using agreed approval/payment conditions and protected downloads.
- [ ] **N** Link finished artwork to the archive, licensing eligibility, and separately approved public portfolio content.

**Acceptance:** A client progresses from inquiry through deposit, revisions, version-specific approval, final payment, and delivery; one client's access cannot expose another's files or internal notes.

## 8. Agreements, licensing, and royalties

- [ ] **B/N** Adapt document organization and implement reviewed agreement templates and structured merge fields.
- [ ] **N** Add frozen agreement versions, attachments, hashes, review state, parties, and required signers.
- [ ] **N** Build unique invite-code generation, keyed-hash storage, expiry, revocation, rate limits, and verified signing sessions.
- [ ] **N** Build readable signing UI with full name, declared date, explicit consent, and signatory capacity.
- [ ] **N** Capture server timestamp and version-bound evidence; consume invitation atomically; reject replay and stale versions.
- [ ] **N** Add countersigning, declined/expired flows, executed copies/certificates, and retryable delivery.
- [ ] **N** Add amendments/supersession and import of the existing signed agreement with genuine historical provenance.
- [ ] **N** Implement license pipeline, artwork/use restrictions, exclusivity review, effective dates, renewal/termination, and obligations; omit territory tracking.
- [ ] **N** Implement fixed-fee, royalty, and hybrid compensation; rate/basis versions, tiers, minimum guarantees, and advances where applicable.
- [ ] **N** Build expected/received/corrected statements, validation, calculation, approval, invoicing, reconciliation, and reminders.
- [ ] **N** Give legal users appropriate review/export access and verify templates/signing requirements for the business's jurisdiction before live use.

**Acceptance:** One hybrid license generates fixed-fee billing and a reproducible royalty statement; stale/reused invites fail; two simultaneous submissions create one signature; amendments preserve originals; renewal does not happen without an explicit action.

## 9. Finance reporting and management compensation

- [ ] **N** Implement versioned manager fee/revenue-share policies with defined basis, deductions, accruals, and settlements.
- [ ] **N** Build processor/bank/gallery reconciliation and discrepancy resolution with source records.
- [ ] **N** Build profit/loss, balance sheet, trial balance, cash movement, aging, payables, and tax summaries.
- [ ] **N** Build artwork/product/event/commission/license profitability including cost completeness and period/currency filters.
- [ ] **N** Build royalty balances, stock valuation, and compensation statements.
- [ ] **N** Add accounting exports, source-document bundles, audit history, period close/reopen controls, and opening-balance entry.
- [ ] **N** Review posting/costing policies with the accountant; distinguish accounting reports from tax-return filing.

**Acceptance:** A worked example covering print production, sales tax, event fees, gallery deductions, Stripe fees/payout, refund, and manager compensation reconciles to source documents and balanced ledger totals.

## 10. Public design and publishing

Implemented gallery slice: `/art` and stable artwork detail pages, search/series/medium filters, publication snapshots with selected display images, caption/alt text/credits/order, unpublish and automatic withdrawal on archive/draft/rights review, related work and product links, enlarged viewer, and the shared public shop-style navbar. See [public gallery](34-public-gallery.md). Broader publishing, homepage composition, collections, and SEO groups below remain open.

- [ ] **B/E/N** Implement design tokens and shared mobile UI primitives from the [design brief](05-design.md).
- [ ] **N** Create and review actual-art mobile/desktop compositions for the hero, archive, artwork detail, shop, and collaboration story.
- [ ] **N** Build the art-first landing sequence, latest collection, appearances, collaborations, artist intro, and inquiry links.
- [ ] **B/E/N** Adapt content editing for public artwork stories, collaborations, journal, biography, and events with draft/publish controls.
- [ ] **N** Verify partner credits, permitted images, external links, and portfolio publication rights; distinguish non-sale features from products.
- [ ] **B/E/N** Adapt metadata, canonical URLs, social previews, sitemap, robots, structured data, and redirects for the chosen domain.
- [ ] **N** Add optimized artwork derivatives, accessible image viewing, reduced-motion behavior, and optional restrained animation.
- [ ] **N** Build mailing-list consent/subscription management and privacy-aware analytics if enabled.
- [ ] **N** Implement mobile dashboard/POS/commission-review/signing designs and readable financial/document surfaces.

**Acceptance:** At phone widths, visitors can explore art, buy a print, find an appearance, and read a collaboration; operators can receive stock, fulfill an order, and take payment; keyboard, zoom, contrast, and reduced-motion checks pass.

## 11. Integrated validation, transition, and operation

- [ ] **N** Run full permission-matrix and private-file access tests across staff, customers, guests, and signatories.
- [ ] **N** Test overselling, duplicate webhooks, failed writes, lost Stripe responses, expired reservations, late payments, and stale job retries.
- [ ] **N** Test tax/shipping/discount rounding, installment allocations, partial refunds, royalty tiers/recoupment, and ledger reversals.
- [ ] **N** Test signature replay/version changes/countersignature and executed artifact reconstruction.
- [ ] **N** Validate responsive/accessibility states on real phone/tablet browsers and event hardware; measure performance budgets.
- [ ] **N** Seed opening inventory, costs, the existing license, business identity, and actual art/product content with provenance.
- [ ] **N** Confirm print samples, packaging, test shipping, customer communications, and return handling before selling physical goods.
- [ ] **N** Rehearse backup restore and full business export, including private-file relationships and executed agreements.
- [ ] **N** Document failed-payment/order recovery, reconciliation, stock counts, supplier receiving, and event closeout runbooks.
- [ ] **N** Configure monitoring, retry alerts, cost/usage visibility, retention, and staff access review.
- [ ] **N** Prepare deployment and domain/redirect cutover; only activate live providers and publish when the business is ready.
- [ ] **N** Transition away from INPRNT after the replacement buying/fulfillment flow is validated; preserve responsibility and support for outstanding INPRNT orders.
- [ ] **N** After stable operation, document configuration and clean seed/export steps for possible future artist-template reuse.

**Acceptance:** Both super admins can complete the principal daily workflows; financial and stock totals reconcile; backup recovery works; no unresolved payment, authorization, signing, or fulfillment defects remain for launch.
