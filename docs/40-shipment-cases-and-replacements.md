# Shipment cases and replacement shipments

September 30, 2026. The user explicitly requested replacement shipments in the first damaged/lost shipment feature. Staff manage the workflow; accounting reads history. Payment disputes, exchanges/customer self-service, carrier integrations and external email activation remain separate scope.

## Staff workflow

Orders → View order/Open fulfillment → Load shipment case. Only trustworthy dispatched shipping orders are eligible, including orders already marked delivered. Pickup and unshipped orders use the existing cancellation/returns flows. Open a case with damage/loss, affected variant quantities, carrier/claim reference, evidence references and notes. Quantities must belong to the original order and cannot exceed dispatched quantities. Evidence is plain text referring to existing secure records, not uploaded files or automatically fetched URLs.

Use Investigating for follow-up. Resolve as Refund issued, Replacement sent, Shipment located (loss only) or Closed without refund or replacement. Every save adds an immutable history entry. Reopen a resolved case as Investigating before changing it; explain why in the new note. Orders shows the case's status.

Refund resolution links a saved successful refund for the same order, matching its verified provider summary. The existing Returns and refunds workflow issues money; the case does not. A receipt link must belong to the same order and an affected variant. It never applies stock effects again. Receiving a damaged item into quarantine uses the existing receipt workflow. Never record lost items as received stock.

## Replacements

Save case quantities first. Prepare replacement shipment covers all affected items using original SKU snapshots. Choose one stock location per stocked variant; made-to-order variants have no stock location. Preparation allocates fresh sellable units, respecting reserved, allocated and unavailable buckets. A shortage or invalid location rolls back every line. The replacement uses the original fulfillment address shown before preparation. No additional payment or shipping charge is collected.

Pack every item, then record Shipped with its own tracking number. Dispatch consumes the replacement allocation and on-hand units exactly once and updates location totals. Cancel before dispatch to release only the replacement allocation; cancellation cannot reverse dispatched goods. Tracking corrections and delivery make no stock changes. Existing allocations can complete/cancel even after a location is archived, provided its balance and totals remain valid. Made-to-order items must be produced manually before dispatch.

A prepared replacement blocks case resolution and changes to affected quantities. Cancel it before correcting quantities. A dispatched replacement keeps those quantities fixed. Resolve as Replacement sent only after dispatch. A subsequent refund may be linked and explained; closing a case never automatically refunds or reverses a replacement. Payment review flags or pending refunds block preparation/dispatch, while cancellation remains available.

Customers see replacement status/tracking on their private order page. Original total, payment, shipping charge, order status and original fulfillment tracking remain unchanged. Staff case notes, evidence, carrier claims, refund reasons, receiving locations and replacement notes stay private. Status is staff-entered, not live carrier tracking. No replacement email is queued by this slice.

## Records and recovery

- `businesses/sadboi/storeShipmentCases/{orderId}`: one case per order, current snapshot and original tracking/SKUs. `history/{revision}` is append-only, including actor, notes, references and resolution.
- `shipmentCaseOperations/{sha256(staffUid:operationId)}`: request fingerprint and committed result. Exact retries recover the prior result even after later updates. Changed-payload reuse/stale revisions fail.
- `orderReplacements/{id}`: immutable item allocations/destination, current status/tracking and revision. `history/{revision}` retains all state transitions and notes.
- `replacementOperations/{sha256(staffUid:operationId)}`: atomic retry results. Concurrent preparation allows one non-cancelled replacement; competing ship/cancel commands commit one result.
- Replacement commands update stock balances, location totals at dispatch, inventory movements, audit records and the order's customer-safe replacement summary in one transaction. No ledger cost or revenue is invented.
- All staff routes enforce role checks; writes require same-origin CSRF and bounded strict input. Private customer access keeps the existing order capability. Firestore direct client access stays denied.
- UI stores uncertain commands in session storage where available. Retry same shipment save recovers the exact request. Reload shipment case replaces unsaved edits. Browser-storage failure leaves an in-memory retry; keep the page open while uncertain.

## First-version limits and deployment

One case and one non-cancelled replacement per order. Up to 100 case revisions, 100 replacement attempts (including cancelled preparations), and 100 revisions per replacement. A cancelled preparation may be replaced by a new one. Split replacements, substitute SKUs, address changes, replacements of replacements, and receipt quantities beyond the original order need a later workflow. No automatic hold expiry for prepared replacements: staff must dispatch or cancel them. Do not delete case/replacement/operation records to reset stock.

Evidence uploads, carrier claim submission/reimbursement, labels, automatic carrier statuses, payment disputes, customer self-service, replacement emails and financial journal postings remain open. Existing Google Workspace/Resend/domain setup and live carrier quotes remain explicitly deferred. Stripe stays test-only. No new environment variables, provider subscriptions or composite indexes are required; deploy the application code normally. In-app guide: `/admin/how-to#shipment-cases`.

## Validation

Completed locally October 1, 2026 after recovering the interrupted session.

- The recovered session records a passing `pnpm check`: typechecking, lint, 94 domain tests, Firebase configuration/runtime tests and the production build. No application code changed during recovery.
- The recovered shipment-only emulator run passed 32 checks. Chrome exercised opening a damage case, preparing and dispatching a replacement with separate tracking, resolving the case and viewing the private customer summary. Staff and customer phone-width checks passed; browser error logs were empty. Temporary tabs and viewport overrides were cleaned up.
- The resumed `pnpm test:shipment-cases` completed successfully with **109 combined integration checks** across authentication, checkout, fulfillment, payments, lifecycle, email fixtures, shipping, refunds/returns and shipment cases. Coverage includes concurrent preparation/dispatch/cancellation, exact retries, shortage rollback, stock buckets/location totals, refund and receipt links, access controls and customer-data privacy. The disposable emulators shut down successfully.
- A final `pnpm typecheck` regenerated normal Next.js route types after the emulator run and passed for both packages. `git diff --check` passed.

Application deployment and a deployed shipment/replacement smoke test remain pending. No production mutations, external communications or provider changes were made during this build. Payment disputes and the other first-version limits above remain open.
