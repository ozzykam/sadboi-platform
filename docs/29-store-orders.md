# Public customer orders

Updated September 23, 2026.

The public `/shop` page now accepts a customer name, email, quantities, and notes. The server rechecks that every selected variant is active and public. Stocked quantities are allocated transactionally from online-eligible locations; made-to-order quantities do not require on-hand stock. Orders begin in `pending_payment` and receive an order number.

Creating an order does not mark payment received or reduce on-hand units; it increases allocated stock for stocked variants. Provider-neutral payment confirmation and a staff fulfillment foundation exist, but provider integration, customer accounts, cancellation/returns, and full fulfillment validation remain open.

The shop now combines multiple product variants into a client-side cart before submitting one order. Checkout collects the customer identity, fulfillment method (`pickup` or `shipping`), and a US shipping address when shipping is selected. Stripe payment confirmation remains a separate provider integration; the order is still created as `pending_payment`.

## Reliable checkout and recovery

`POST /api/store/orders` requires `{ operationId, input }`, with a UUID operation ID. The server validates the complete request, rejects duplicate variant lines and client-supplied totals, and checks both the parent product and variant for active/public status. Prices come from the current server catalog.

All transaction reads finish before stock writes begin, including every cart line's balances. Stock allocation, order creation, sequential order numbering, and the recovery record commit together. Any unavailable line rolls back the entire request. Reserved and unavailable stock cannot be allocated. New line snapshots retain product details, fulfillment policy, and exact location quantities for future fulfillment work.

Retrying the same operation and details returns the original order ID, number, and total, even after publication or stock changes. Reusing an ID with different details returns a conflict. Recovery IDs are random bearer capabilities, stored as hashes in the server operation collection; responses contain no customer/address data. Concurrent submissions of one operation create one order.

The shop disables repeated submission and locks unresolved request details until recovery succeeds or the server definitively rejects the checkout. **Retry order request** resends the same request. Pending details are held in session storage for recovery after reloading the same tab; they are cleared after success or definitive rejection. The saved request includes contact/address fields: it is not stored in the longer-lived cart storage. When storage is blocked, recovery only survives in the open page. After closing a page with an uncertain result, staff must check Orders before the customer submits again.

Saved cart data is validated before rendering and rebuilt from the public catalog. Corrupt lines and unavailable variants are dropped, quantities are capped to availability and order limits, prices/names are refreshed, and storage failures do not crash the shop. Cart merging does not mutate prior React state. The last successful confirmation is cleared when starting a new cart.

## Help and verification

The cart includes **How order requests work**. Staff instructions are at `/admin/how-to#store-orders`, linked from Orders and the tutorial topics.

`pnpm test:store-orders` uses disposable Auth/Firestore emulators and checks multi-line stocked/made-to-order requests, exact allocation snapshots, lost-response recovery, concurrent first submissions, conflicting request IDs, validation, origin/CSRF, parent/variant publication, atomic shortage rollback, and competition for the last unit. Core cart tests cover malformed persistence, current catalog metadata, immutable merging, and quantity/line limits.

September 23 verification: `pnpm test:store-orders` passed all 35 authentication/checkout integration checks. `pnpm check` passed typecheck, lint, all 59 domain tests, and the production build.

## Remaining limits

This is an order request flow, not a completed paid checkout. Shipping/tax calculation, automatic customer email, payment collection, allocation expiry, rate limiting, cancellation/returns, and full fulfillment lifecycle validation remain open. Made-to-order lines do not reserve production capacity. The server authoritatively prices at submission; a price-change confirmation step is still needed. Recovery is scoped to an attempt, not separate independent checkouts in different tabs. Legacy orders have no per-location allocation snapshots. Do not assume the older fulfillment handler uses the new snapshots yet. Browser interaction and responsive verification remain outstanding because no browser is connected.
