# Balanced journal entries

Updated September 21, 2026.

Purchasing → Journal records double-entry postings against a source vendor bill. A posting requires a date, memo, debit account, credit account, and amount. The server rejects unbalanced lines and rejects duplicate journal entries for the same source bill.

The current starter flow posts a vendor bill to Inventory and Accounts payable. It records the accounting event without changing stock, paying the bill, or rewriting the source invoice. Account configuration, reversals, period locks, payment attempts, and reconciliation remain future work.
