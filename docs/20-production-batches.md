# Physical production batches

Updated September 21, 2026.

Placed purchase orders now support production batches for each SKU. A batch records a supplier run number, planned quantity, estimated waste/spoilage, status, and notes. Batch quantities are checked against the quantity ordered for that SKU, and cancelled batches do not consume the order allowance.

Use **Planned** before the run, **In production** while it is underway, and **Completed** when the supplier confirms the run is finished. Record retained waste or spoilage for planning; receiving still determines accepted, quarantined, and rejected stock. Batch records do not add inventory or replace delivery inspection.

See `/admin/how-to#batches` for the operating walkthrough. Supplier capacity estimates feed the production queue. Reprint requests are tracked separately from the original batch; machine scheduling and calendar-based lead-time forecasts remain future work.
