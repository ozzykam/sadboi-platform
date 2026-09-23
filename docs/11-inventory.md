# Products, variants, and stock

This slice connects the staff Inventory page to Firestore. Products link to existing artwork, each sellable size or style has a permanent SKU, and physical stock is tracked separately at each location.

The next slice adds [physical counts, replenishment, and setup guidance](12-stock-counts-and-replenishment.md), with the latest validation results recorded there.

## Using inventory

Open [Inventory](http://127.0.0.1:3100/admin/inventory) after signing in.

1. In **Products & variants**, add a product linked to an artwork, then add its variants. Each variant records its SKU, options, USD price, optional weight, and stocked/made-to-order policy.
2. In **Locations**, add the studio, galleries, or events. Enable website fulfillment only for appropriate locations. Transit holding locations cannot fulfill website orders.
3. Choose **View stock** for a variant. Receive accepted units or receive damaged/unapproved units directly into quarantine. An optional unit cost is recorded with the receipt.
4. Use **Set stock aside**, **Approve stock for sale**, or **Discard unavailable stock** for quality handling. A count correction records a signed difference, with a required reason.
5. Dispatch stock between locations. Units leave the source immediately and stay in transit until an accepted receipt, quarantined receipt, or loss is recorded. Partial outcomes are supported.
6. Review balances, open transfers, and paginated movement history. Use **Refresh stock** to obtain current balances before retrying a stale correction.

Product and variant archiving preserves stock history. Archived products/variants cannot receive new supply; existing units can still be reconciled or transferred. SKU claims remain permanent after archiving. Locations cannot archive while holding physical units or incoming/outgoing transfers.

## Permissions and persistence

Super admins can view and manage inventory. Accounting has read-only access to product data, costs, balances, and history; artwork studio notes are never loaded into inventory responses. Legal and signed-out users have no inventory access. Both the server-rendered page and every API endpoint enforce access. Writes validate origin, CSRF, input fields, and active membership, with membership checked again inside the transaction.

Records live beneath `businesses/sadboi` in `products`, `productVariants`, `skuClaims`, `stockLocations`, `stockBalances`, `stockTransfers`, `inventoryMovements`, `inventoryOperations`, `inventoryAudit`, and `inventoryState`.

All mutations run in Firestore transactions. They use actor-scoped operation IDs and normalized payload fingerprints; retries return the committed result, while reuse for a different request fails. Metadata edits use revisions. Stock corrections also require the displayed balance revision. Transfers and receipts validate current availability/remaining units inside their transaction. Counts must remain nonnegative integers, and stock movements cannot consume reserved, allocated, or unavailable units.

Metadata changes have before/after audit records. Stock movements retain the product/SKU/location names at the time, reason, reference, actor, timestamp, cost where supplied, and relevant balance snapshots. Mutation, balance, counter, transfer, and history writes commit together. The form retains the original operation after an uncertain response and offers **Retry same entry**.

## Indexes and live setup

`firestore.indexes.json` defines the two collection-scoped compound indexes required for movement history and open-transfer queries. Both are deployed in the current project. For another environment, deploy them before using live stock views:

```powershell
pnpm exec firebase deploy --only firestore:indexes --project sadboi-platform --account ozzykam@gmail.com
```

Index deployment/build status is recorded below with validation results. Emulator success alone cannot verify indexes: the [Firestore emulator does not enforce compound indexes](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production). See [Firebase index deployment](https://firebase.google.com/docs/firestore/query-data/indexing).

## Validation

Run from the project root:

```powershell
pnpm check
pnpm test:inventory
```

`test:inventory` starts disposable Auth, Firestore, and Storage emulators and a separate Next server on port 3102. It runs the existing authentication/artwork checks followed by inventory tests. It does not create live accounts, artwork, products, or stock.

Verification on September 17, 2026:

- **91 integration checks passed**: 59 existing authentication/artwork checks plus 32 inventory checks.
- **20 domain tests passed**, including 8 inventory tests.
- Type checking, lint, and the production build passed through `pnpm check`.
- The development server is running at `http://127.0.0.1:3100`; the sign-in page returned HTTP 200.
- Both inventory indexes were deployed to `sadboi-platform`; the user confirmed that both finished building on September 17, 2026.

The integration checks cover permissions, CSRF, shared data, SKU contention, metadata conflicts, receiving/transfer retries, damaged stock, concurrent dispatch/receipt, reserved/allocated stock protection, location totals, archiving, audit completeness, pagination with equal timestamps, and rendered admin/accounting pages.

## Boundaries and next work

- Catalog limits are 500 products, 500 variants, and 100 locations including archived records. A variant supports at most 100 open transfers. History loads 50 rows at a time. These limits fail explicitly rather than silently hiding records.
- Prices and reference costs are USD minor units. Recorded receiving costs do not post ledger entries, compute landed cost, or establish inventory valuation policy.
- The displayed website-eligible count excludes inactive products/variants/locations, transit locations, non-eligible locations, and made-to-order variants. Reservations, allocation commands, production capacity, and checkout are still to be implemented.
- Product packaging/shipping dimensions, edition numbering/caps/certificates, supplier purchase orders, multi-item stocktake sessions, and production workflows remain open. Individual physical counts and replenishment thresholds are implemented in the next slice.
- Product publishing, customer sales, public images, financial posting, and reviewed browser-draft import remain separate work in the build checklist.
- Browser discovery returned no connected browser in this session. Responsive styles are implemented; actual mobile/desktop visual and form-interaction verification remains outstanding.
- Uncertain operations can be retried safely while the form is open. Recovery across closing/reloading the page is not yet a durable client-side queue; inspect movement history before re-entering an uncertain physical movement.

## Reuse

This finishes the inventory schemas, server transaction code, and metadata form begun in the prior session. It adds the stock/transfers panel, page wiring, responsive styles, quarantined receiving, required indexes, and emulator integration coverage. Shared buttons and inputs reuse the project's established UI conventions. No inventory writes or role-grant behavior was copied from the legacy ecommerce project.
