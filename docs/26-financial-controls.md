# Financial controls

Updated September 21, 2026.

The finance API now supports payment allocations, payment disputes, account reconciliation records, and accounting period locks. Allocations cannot exceed a settled payment. Disputes preserve the original payment. Reconciliation records store statement opening/closing balances and status. A locked `YYYY-MM` period rejects new journals, payments, refunds, and reconciliations dated in that period.

These controls are server-enforced and audited. Unlock workflows, provider feeds, automatic bank matching, reversal approvals, and close reports remain operational follow-up work.
