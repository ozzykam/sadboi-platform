# Build resumption — September 23, 2026

## Recovered context

Reviewed the project source, feature guides, checklist, and the local Codex session titled **Resume Next project build**, including its final September 22 messages. No Git repository existed at the start of this review, consistent with the original project direction. The user subsequently requested Git initialization and a private GitHub repository on September 23; the current repository is linked from the README.

The last completed work was storefront cart persistence and order confirmation, followed by product dialog styling: a sticky product title, description spacing, close-button stacking, and consolidation of `.shop-dialog-description`. The accepted cart border artwork, left-only repeating border, shadow, minimum 250px product cards, custom scrollbars, and automatic close after adding to cart remain the current design baseline.

Stripe setup remains deferred until the business/Stripe account is ready. Existing code includes staff access, artwork/private assets, products/inventory, contacts, purchasing/production records, financial foundations, public catalog/order requests, and initial fulfillment. These are foundations; broad checklist groups remain incomplete.

## Continued work

Completed a coherent reliability pass on public order creation and the persisted cart. See [public customer orders](29-store-orders.md) for behavior and limitations. Added a dedicated checkout emulator suite and in-app customer/staff guidance. No live business records were seeded or changed.

The initial `pnpm check` passed typecheck, lint, 55 domain tests, and the production build. After the changes, the final `pnpm check` passed typecheck, lint, 59 domain tests, and the production build; `pnpm test:store-orders` passed 35 authentication/checkout integration checks. Results are also recorded in [implementation status](07-implementation-status.md). Browser discovery returned no connected browsers, so visual/form interaction checks are not claimed.

## Next continuation

1. Validate and repair fulfillment against exact order allocations, including multiple locations, made-to-order lines, idempotent delivery/cancellation, and historical orders without allocation snapshots. The existing fulfillment handler uses aggregate allocated stock, and its cancellation/state handling needs regression coverage.
2. Harden provider-neutral payment events against late failed events and reused event identities before connecting Stripe. The current event handler can regress an already-paid order on a new failed event; this is a review finding, not fixed by the checkout slice.
3. Add pending-order cancellation/expiry and safe late-payment reconciliation, then shipping rates/tax decisions, customer access/notifications, and the deferred provider connection.
4. Run browser/mobile/keyboard validation when a browser is connected. Continue the larger dependency-ordered build checklist after these commerce boundaries are reliable.
