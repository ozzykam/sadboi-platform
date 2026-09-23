# Printer quotes and cost comparison

Updated September 21, 2026.

Purchasing → Quotes records estimates from an active supplier for an active inventory variant. Each quote stores the run quantity, unit price, setup charge, shipping, expected and expiry dates, specification, status, and notes. The page calculates:

`estimated total = quantity × unit cost + setup + shipping`

`effective unit cost = ceiling(estimated total ÷ quantity)`

Use **Received** while comparing options. Set the selected record to **Accepted**, then choose it on a draft purchase order. The server verifies that the order uses the same supplier and includes the quoted SKU. The draft keeps a snapshot of the quote reference, totals, and specification so later quote edits do not rewrite the order agreement.

Quotes do not change stock, contact suppliers, approve proofs, or create bills. Rejected and expired quotes remain history. Super admins can create and edit quotes; accounting can view them. The quote list is currently capped at 500 records. Writes use revision checks and idempotent operation keys; if a save is uncertain, retry the same form and inspect the list before submitting a new record.

See the in-app walkthrough at `/admin/how-to#quotes` and the broader [purchasing guide](13-purchasing.md).
