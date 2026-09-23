# Physical counts and replenishment

This slice adds counted totals, discrepancy history, low-stock thresholds, and product/variant setup guidance to the shared inventory workflow. The [initial inventory documentation](11-inventory.md) describes receiving, quarantine, transfers, and access.

## Product setup guidance

The Products & variants page now explains the sequence: original artwork → product → variant → stock at a location. Product and variant forms include examples and clarify that every separately priced or stocked version needs its own permanent SKU. Creating a product offers **Add first variant**; creating a variant offers **Record stock**. The page also explains archiving and preserves the existing archive/history behavior.

## Recording a physical count

1. Open **Inventory → Products & variants → View stock** for a variant.
2. Under **Counts & low-stock thresholds**, select a location and choose **Count physical stock**.
3. Enter the actual total physically present. Include reserved, allocated, and quarantined units that are physically there; exclude units still in transit.
4. Enter the count reason and an optional count-sheet reference.
5. Review the recorded count, counted total, and proposed adjustment. Confirm the review checkbox and select **Record counted total**.

A recorded 10 and counted 7 produces an adjustment of −3. A matching count still records an observation. Zero is a valid physical count. Both count observations and discrepancies appear in Movement history with before/after balances, counted total, reason, reference, actor, and timestamp.

The form keeps the balance revision from when counting began. If receiving, transfers, another count, or another stock change occurs first, the transaction rejects the stale count. Use **Refresh stock**, then **Start a fresh count**, and physically recount before submitting again. Counts below reserved, allocated, and unavailable quantities are rejected; those commitments or quality records must be reconciled first. Archived products/variants may still be counted at active locations so their remaining physical units can be reconciled.

These are individual variant/location counts. Named multi-item stocktake sessions, freeze windows, and separate approval workflows are not implemented yet.

## Low-stock thresholds

Within the same stock view:

1. Select **Low-stock threshold** and the location.
2. Set **Flag when available units reach**. An alert appears at or below that number; zero monitors an empty location.
3. Set **Target available units**, which must exceed the threshold.
4. Enable monitoring and select **Save threshold**.

Open **Inventory → Low stock** to see affected variants and locations. Suggested replenishment is the target minus available units. Availability excludes reserved, allocated, and quarantined stock. A location with no balance record is treated as empty. Incoming transfers do not count as available before receipt; review incoming transfers and supplier commitments before arranging more stock. Suggestions do not place orders or move inventory.

Policies are specific to a variant and location. Active stocked variants at active studio, gallery, and event locations are eligible, whether or not that location fulfills website orders. Archived products/variants/locations, transit locations, and made-to-order variants are excluded from the queue. An existing threshold can still be disabled after a related record is archived. Only explicitly configured and enabled policies are monitored.

Use **Edit latest threshold** after refreshing to replace a stale edit with the current settings. Concurrent saves require the displayed policy revision and cannot silently overwrite each other.

## Permissions and storage

Super admins can record counts and edit thresholds. Accounting can view thresholds, discrepancy history, and the replenishment queue; legal and signed-out users cannot access these features. Mutations use the existing session, origin, CSRF, and transaction-time membership checks.

Counts are immutable `inventoryMovements` with kind `stocktake`; they change the balance and location total in the same idempotent transaction. Matching counts advance the balance revision and add a history entry. No historical movement is edited or deleted.

`businesses/sadboi/stockPolicies` contains one revisioned policy per variant/location pair. Threshold changes write before/after records to `inventoryAudit`. Actor-scoped operation IDs prevent retry duplicates. The workspace supports up to 1,000 policy records, including disabled policies; editing an existing policy does not consume another slot. Queue reads are bounded and retrieve corresponding balances in groups of 100.

The new policy queries use automatically maintained single-field indexes. No new composite indexes, rules, cloud services, or live test records are required. The two existing movement/transfer indexes remain in use.

## Validation and remaining work

Run `pnpm check` and `pnpm test:inventory`. The latter now includes `scripts/inventory-planning-integration.mjs` after the existing artwork/inventory checks, using disposable emulators and the separate test server on port 3102.

Validation on September 17, 2026:

- **110 integration checks passed**, including 19 new checks for counts and replenishment and all 91 existing authentication/artwork/inventory checks.
- **28 domain tests passed**, including 8 new count/replenishment tests.
- Type checking, lint, and the production build passed through `pnpm check`.

The new checks cover zero/matching counts, shortages, count revisions, receiving/count races, duplicate submissions, protected quantities, threshold validation and contention, empty locations, quarantine, incoming transfers, accounting access, archive behavior, history, and location-total reconciliation.

The dev server remains on `http://127.0.0.1:3100`. Browser visual/form-interaction verification remains outstanding because no browser was connected. The new UI follows the existing responsive form/card styles.

Supplier records, purchase orders, and inspected deliveries are now implemented in the [purchasing slice](13-purchasing.md). Remaining inventory work includes multi-item stocktake sessions, reservations/allocations, production capacity, and valuation. Public catalog publishing, checkout, and financial posting remain separate checklist work.
