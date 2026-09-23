# Supplier production progress

Purchasing now includes a **Production** tab for outstanding supplier work. Open a placed order and use **Supplier production** to record per-SKU progress and revised expected delivery dates. The [in-app production tutorial](http://127.0.0.1:3100/admin/how-to#production) explains the complete flow, corrections, and recovery.

## Implemented workflow

- The queue includes SKU lines with outstanding quantities on ordered/partially received purchase orders. Drafts, fully accounted-for lines, cancelled orders, and closed orders are excluded.
- Search by supplier, order number, SKU/name, or confirmation reference; filter by stage. Known expected dates sort first, with unknown dates last.
- Record Queued with supplier, Proof in progress, In production, Ready for collection / dispatch, Shipped by supplier, or On hold, with a required note and optional reference.
- Progress describes the remaining units for one SKU. Stages may move backwards to represent corrections or supplier changes; every report remains in history.
- Until a first report, the queue uses the original order expected date and shows No update yet. A report's date becomes the current forecast; a deliberately blank date means unknown, not a fallback to the old expectation.
- Original supplier/line/specification/price snapshots, expected delivery date, quantities, and stock are preserved. A production report never creates an inventory movement. Shipped units remain outstanding until received.
- Partial deliveries reduce the queued quantity. Fully accounted-for SKU lines leave the queue. Existing production history remains visible on received/closed/cancelled orders, which reject further updates.
- Previously placed commitments can still be tracked after supplier/variant archiving.

## Permissions and consistency

Super admins write; accounting reads; legal and unauthenticated users have no purchasing access. Mutations require session, origin/CSRF proof, strict schemas, and current membership inside the transaction.

Updates require the reviewed order revision. Production, receipt, and closing transactions all advance that revision, preventing a stale report from overwriting newer progress or ignoring an intervening delivery. A receipt still validates actual remaining quantities atomically.

Actor-scoped operation IDs make retries idempotent. Updated latest-per-SKU summaries, the immutable history event, operation record, and audit event are committed together. History records contain actor and server time. The UI retains the same operation for an uncertain save while the form is open; after leaving/reloading, inspect history before re-entering it.

New records live under `businesses/sadboi/purchaseOrders/{orderId}/productionUpdates`. The order stores at most one current summary per SKU (up to the existing 20 lines) and a count capped at 500 reports per order. History pages contain 50 reports and use order-scoped snapshot cursors with timestamp/document-ID ordering. Existing orders without production fields default to an empty history/summary and require no migration. No new composite index or client security-rule changes are needed.

## Limits and next steps

This slice tracks manual supplier progress. It does not implement version-specific proof approval, file handoff, physical batch/lot lineage, capacity allocation, automated scheduling/reminders, live shipment tracking, or supplier communication. Proof in progress is a progress label, not approval evidence. Separate reprint orders, bills, and landed-cost workflows remain as described in the purchasing guide.

Production summaries use the existing capped purchasing catalog, not a paginated cross-order reporting service. Larger catalogs need pagination before increasing the existing 500-order limit.

## Validation

Run sequentially from the project root:

```powershell
pnpm check
pnpm test:purchasing
```

Domain tests cover schema validation, remaining quantities after mixed inspection outcomes, stage/date fallbacks, and queue selection/order. The purchasing integration suite includes production permissions, legacy records, retries, invalid/stale reports, concurrent reports and deliveries, corrections, per-SKU independence, closed commitments, audit linkage, scoped pagination including tied timestamps, and authorized tutorial rendering.

Validation on September 17, 2026:

- **145 integration checks passed**, including 13 new production/tutorial checks and all 132 previous checks.
- **39 domain tests passed**, including four new production schema/queue tests.
- Type checking, lint, and the production build passed through the final `pnpm check`.
- The first integration run found invalid IDs in the seeded pagination fixture. The fixture was corrected to use the required hexadecimal IDs, and the full suite passed on rerun.
- Tests used disposable local emulators; live business records were not modified.

Browser discovery found no connected browser; visual and interactive browser checks remain outstanding.
