# Shipping and fulfillment

Updated September 25, 2026. Paid-order fulfillment now uses the exact location allocations recorded by checkout. The staff workflow is at `/admin/orders`, with instructions at `/admin/how-to#fulfillment`. Pending-order cancellation and reviewed reopening after late payment use the separate [order lifecycle workflow](35-order-lifecycle-stripe.md); cancelled paid fulfillment remains terminal.

## Staff workflow

Super admins can save fulfillment; accounting can review it. Orders is linked in the staff navigation. The editor loads the saved recipient, US shipping address, method, tracking, notes, revision, and status. New records start from checkout details. Pickup requires no postal address. Pending-payment orders remain read-only.

| Current state | Allowed next states | Stock effect |
| --- | --- | --- |
| Unfulfilled | Unfulfilled, packed, cancelled | Cancellation releases exact allocations |
| Packed, shipping | Packed, shipped, cancelled | Shipping consumes allocated and on-hand units |
| Packed, pickup | Packed, delivered/collected, cancelled | Collection consumes allocated and on-hand units |
| Shipped | Shipped, delivered | No additional stock deduction |
| Delivered or cancelled | None | Terminal; exact prior requests remain recoverable |

Shipping locks the recipient, address, and method. Tracking and notes can still be corrected before delivery. All order lines must be ready before packing/dispatch; made-to-order work does not allocate physical stock or automatically schedule production.

Delivery sets the order to `fulfilled`; pre-dispatch cancellation sets it to `cancelled`. Cancellation leaves the payment record intact and **does not issue a refund**. Post-dispatch cancellation/returns and partial shipments are not implemented.

## Transactions and recovery

`POST /api/store/fulfillment` accepts `{ operationId, expectedRevision, input }`. Authentication, super-admin role, origin, CSRF, body size, strict request shape, UUID operation identity, and a safe order ID are checked. Validation errors return 400; stale revisions, invalid transitions, and allocation problems return 409.

Each operation is scoped to the staff UID and stores a fingerprint of the normalized input and revision. Exact retries return the original result, including after later updates or terminal states. Changed details with the same ID conflict. Concurrent different operations cannot overwrite one another because the transaction checks the fulfillment revision.

The server validates immutable checkout line policies and per-location quantities against the order input. It never selects stock from the current list of online locations or reads a changed variant policy. Original locations may now be archived/offline. Every stocked allocation must be covered by its matching balance. Made-to-order lines must have empty allocation lists.

All reads precede writes. Balance changes, physical location rollups, fulfillment/order status, per-allocation `order_dispatch` or `order_cancel` movement records, audit history, and operation recovery commit together. Reserved/unavailable units and other orders' remaining allocations are preserved. Location on-hand totals change only on physical dispatch/collection. No stock effect occurs when merely packing, editing metadata, or confirming a shipped delivery.

The form prevents duplicate submission and freezes an uncertain request for **Retry same save**, retaining its exact ID and details in memory. It warns before leaving during a save/uncertain result. No customer details are persisted by this editor. After closing an uncertain page, inspect the saved order before making another change. A successful save with a failed list refresh is reported as saved; Refresh orders loads current data. Reload saved order after a conflict discards unsaved fields and loads the latest record.

## Historical records and limits

Missing, duplicate, mismatched, or oversized allocation histories require review. Fulfillment records predating `schemaVersion: 1` also require reconciliation: the previous handler's physical stock effects cannot safely be inferred from status. No automatic migration guesses allocations from pooled stock. Staff can see a review warning and valid historical details; mutations fail closed. Review original commitments, movement history, and physical stock before an explicit administrative migration.

Maximum 20 order lines and 100 allocation entries per fulfillment, keeping the atomic write set bounded. The order list still caps at 500 records and needs pagination before growth beyond that. Whole-order fulfillment only; no labels/rates, international shipping, tax calculation, customer notifications, automatic refunds, or production capacity scheduling.

The subsequent [payment-event slice](30-stripe-payment-confirmation.md) repairs the late-failure ordering issue and adds payment review history. Neither slice activates paid checkout or connects Stripe. Pending-order expiry and late-payment resolution remain open.

## Verification

Core tests cover address rules, transitions, terminal protection, and invalid allocation snapshots. `pnpm test:fulfillment` runs checkout plus fulfillment against disposable Auth/Firestore emulators. It covers roles/CSRF, invalid requests, paid/packed prerequisites, uneven multi-line/multi-location allocations, offline original locations, other-order stock preservation, made-to-order/pickup, concurrent retries, stale edits, dispatch/cancel contention, terminal replay, balance/rollup failure rollback, legacy review, staff rendering, and linked instructions.

September 25 results: `pnpm check` passed typecheck, lint, all 67 core tests, 7 Firebase credential tests, 2 Firebase runtime tests, and the production build. The combined checkout/fulfillment harness, including its browser preview, passed all 45 integration checks. Connected Chrome verified shipping through delivery, made-to-order pickup, cancellation, saved tracking/notes, terminal read-only controls, a two-tab stale-save conflict and reload, and contextual help. Pickup at 390×844 had no horizontal overflow and 16px controls; keyboard focus advanced through fields. No console errors were observed. Full screen-reader and real-device testing remain outstanding. All mutations used disposable emulator records.

For a disposable browser preview, run `pnpm firebase emulators:exec --only auth,firestore --project demo-sadboi-platform "node scripts/auth-integration.mjs --store-orders --fulfillment --fulfillment-preview"`. The harness prints local fixture credentials and waits up to ten minutes for `web-app/.next-auth-test/fulfillment-preview.done`. It uses localhost:3102 to isolate cookies from the normal 127.0.0.1:3100 session. Never seed live business records to test this workflow.
