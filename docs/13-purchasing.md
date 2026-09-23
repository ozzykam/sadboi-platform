# Suppliers, purchase orders, and delivery inspection

Purchasing connects supplier commitments to physical inventory. Open [Purchasing](http://127.0.0.1:3100/admin/purchasing) from the staff navigation. Super admins can manage records; accounting has read-only access; legal and signed-out users have no access.

The later [supplier production slice](15-supplier-production.md) adds per-SKU progress, revised delivery forecasts, an outstanding work queue, and update history between placement and receipt. Staff instructions live in [How-to](http://127.0.0.1:3100/admin/how-to#purchasing).

## Workflow

1. In **Suppliers**, add the print shop or supplier, contact details, capabilities, usual lead time, and purchasing notes. Notes are visible to both super admins and accounting.
2. In **Purchase orders**, select **Create purchase order**. Choose an active supplier and add up to 20 distinct SKUs with quantity, agreed USD unit cost, and production specifications. Add the supplier quote/reference and expected delivery date when known.
3. Save the draft and review its server-calculated production subtotal and saved supplier/SKU/specification details. Draft edits use revisions so simultaneous edits cannot overwrite each other.
4. After arranging the order with the supplier outside the app, enter the confirmation reference/reason, check the review confirmation, and select **Record order placed**. This freezes the saved order details. It does not send an email, place an external order, pay the supplier, or approve a proof file.
5. As units arrive, choose **Record a delivery** on the order. Select a delivered SKU and active receiving location, then record accepted, retained damaged/unapproved, and rejected quantities with inspection notes.
6. Review delivery history and the corresponding inventory movements. Partial deliveries leave the remaining units outstanding. Once every ordered unit has a recorded outcome, the order is **Received**.
7. Use **Close this order** with a reason to close the commitment. Outstanding quantities are explicitly cancelled; existing deliveries and inventory remain intact. A draft or unreceived order closes as **Cancelled**. Reopening is not supported in this slice.

## Inspection and stock behavior

| Outcome | Physical stock | Available stock | Order outstanding quantity |
| --- | --- | --- | --- |
| Accepted | Increases | Increases | Decreases |
| Damaged/unapproved and kept | Increases | No increase; units enter quarantine | Decreases |
| Rejected and not kept | No increase | No increase | Decreases |

Rejected units mean the supplier retained them or they were returned during inspection. If damaged units remain physically with the business, record them as quarantined instead. Later approval/discard uses the existing inventory quality workflow.

All outcomes count against the original ordered quantity. Arrange replacements as a new order with a reference to the original; automatic reprint/replacement commitments are not implemented. **Received** means deliveries have accounted for ordered quantities, not that all units passed inspection or that the supplier bill has been settled.

Use the purchase-order delivery form for ordered goods. Recording the same physical delivery separately through generic inventory receiving would be a distinct manual movement; the system cannot infer that two independently entered delivery records describe the same shipment.

## Consistency and history

- Order numbers are sequential within the business and assigned atomically when drafts are created. Cancelled numbers remain used.
- Drafts preserve supplier and variant snapshots. Editing a draft refreshes those snapshots; placing the reviewed draft freezes them. Later supplier/catalog edits do not rewrite agreed order details.
- All mutations validate staff session, origin, CSRF, input fields, and current membership. Membership is checked again inside each transaction.
- Actor-scoped operation IDs recognize retries. A repeated receipt cannot add stock twice; reuse for different input fails.
- A delivery transaction updates the order, receiving balance, location total, immutable receipt, operation record, and inventory history together. Quarantined units never briefly become available.
- Two concurrent receipts cannot exceed the same outstanding quantity. Delivery receipt revisions also prevent a stale closing action from cancelling an intervening delivery.
- Archived suppliers and variants stop new commitments. Already placed orders may still receive their deliveries at active locations, preserving the ability to reconcile goods already ordered.
- Supplier/draft/status changes have before/after audit records. Delivery history and inventory movements share the operation ID and reference the purchase order.

Records live beneath `businesses/sadboi/suppliers` and `businesses/sadboi/purchaseOrders`; each order has a `receipts` subcollection. The existing inventory balances, movements, audit, operations, and counters are reused.

## Scope and limits

- Up to 500 supplier records and 500 orders, including archived/cancelled records; limits fail explicitly. Catalog growth beyond this needs paging before raising limits.
- Up to 20 distinct SKU lines and 500 delivery records per order. Delivery history is paginated in batches of 50.
- Production subtotals reflect original ordered quantities and agreed costs. They exclude tax, freight, landed-cost allocation, supplier invoices, payments, and financial journal posting. Closing/rejection does not silently change the original commitment subtotal.
- Supplier quotes as separate records, attachments, secure print-file handoff, proof versions/approvals, automated reprints, supplier bills, and production scheduling remain future work.
- This is a supplier directory, not the full contacts/organizations/relationship module.
- No new composite indexes or security rules are required. Receipt history uses the automatic single-field timestamp index; existing inventory indexes continue to serve movements.
- Uncertain saves retain their operation while the form is open. Recovery after closing/reloading the page still requires checking recorded history before re-entering a physical receipt.

## Validation

Run from the project root:

```powershell
pnpm check
pnpm test:purchasing
```

The purchasing suite includes all authentication, artwork, inventory, count, and replenishment checks before purchasing tests. It uses disposable local Firebase emulators and the test server on port 3102, leaving live records untouched.

Run the build/check and emulator suites sequentially. Next.js updates shared TypeScript route references even when separate build-output directories are used; concurrent build/test runs can read partially generated files or cause transient route failures.

Validation on September 17, 2026:

- **132 integration checks passed**, including 22 purchasing checks and all 110 existing checks.
- **35 domain tests passed**, including 7 purchasing tests.
- Type checking, lint, and the production build passed through `pnpm check`.
- The first overlapping build/test run hit generated-route-file interference. Both suites passed when rerun sequentially.

Browser visual/form-interaction verification remains outstanding because no browser was connected; the interface follows the existing responsive forms and cards. The live development app remains on port 3100.
