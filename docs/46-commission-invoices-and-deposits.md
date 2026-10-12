# Commission invoices and deposits

## Staff workflow

Open **Invoices** (`/admin/invoices`) to see signed commissions and their billing totals. A signed agreement also has **Open invoices**. The detail page is `/admin/projects/invoices?proposalId=...`; billing remains attached to the proposal series through inquiry-to-project conversion. Super admins manage invoices and payment records; accounting can review and print. Legal users cannot access commission billing.

1. Choose **Add invoice**, select Deposit, Milestone or Final balance, and enter a client-facing title, description, amount in USD, UTC due date and payment instructions. Add a **Private action note** and **Save invoice draft**.
2. Review the saved document. Enter a new action note and **Issue saved invoice**. Pending edits disable issuing. Issuing assigns an atomic `CI-000001` number and freezes the invoice; the due date must be current or future.
3. Use **Print / save PDF** and share the file manually. Disable browser headers and footers to omit the staff URL. The document contains the saved client and agreement references, installment description, amount, recorded payment total, balance and payment instructions. Staff notes and payment evidence are excluded.
4. After verifying an external receipt, enter its amount, date, method and private evidence/reference, plus an action note, then **Record received payment**. Partial and full payments update the balance. The app does not collect or independently verify this money.
5. For a mistaken entry, add a reason and **Reverse payment record**. The original receipt and its previous snapshots remain available. This is an entry correction, not a refund. Void an unpaid invoice to replace it with a new draft; do not reverse a genuine receipt to bypass the paid-invoice restriction.

The in-app tutorial is `/admin/how-to#commission-billing` and is also available in the directory and billing detail. It includes a worked $550 commission with a $275 deposit, $275 final installment and $100 partial payment, plus field examples and recovery instructions.

## Balances and safeguards

All amounts are integer USD cents. Invoice allocations include the accepted proposal's saved discount and tax; installments divide the existing total and never add new tax or fees. Both drafts and issued invoices reserve amounts. Their combined allocation cannot exceed the signed agreement total. A final-balance draft must cover the unallocated amount, including consideration of other unpaid installments. If another draft is voided or reduced, update the final draft before issuing it.

- **Unallocated after drafts:** agreement total minus all active draft and issued amounts.
- **Issued:** non-void issued amounts.
- **Payments recorded:** unreversed, staff-recorded receipts.
- **Outstanding invoices:** issued amounts minus recorded receipts.
- **Remaining agreement balance:** agreement total minus recorded receipts, including amounts not yet invoiced.

An unpaid issued balance becomes overdue after its UTC due date. No reminders are sent. Receipts cannot exceed the selected invoice balance or use future received dates. Duplicate active method/reference combinations within a commission are rejected. When allocating one real receipt across multiple invoices, record only each allocation and give it a distinct reference; staff must verify the total allocation independently.

New drafts and issuing require an active contact and a signed, non-voided agreement. Billing validates the agreement's signed document hash and full accepted-proposal total, then freezes its source snapshot. Existing receipts, corrections and invoice voids remain available after agreement voiding for reconciliation. Agreement voiding does not automatically cancel invoices or refund payments.

## Persistence and recovery

`businesses/sadboi/commissionBilling/{proposalId}` stores the source snapshot, invoices and revision. Immutable `history/{revision}` documents store the changed invoice, action, private note, actor and timestamp. `commissionBillingOperations` stores actor-scoped request fingerprints and results. `counters/commissionInvoice` assigns numbers in the same transaction as issue/history/operation writes. Expected revisions serialize concurrent allocation and payment changes; duplicate identical requests return their original result.

The UI retains uncertain commands in memory and session storage where available. **Retry same billing action** repeats the original request. **Recover interrupted action** retrieves it in the same browser tab. **Reload billing** discards unsaved edits; unresolved commands must be retried before new mutations. If browser storage is unavailable, inspect the saved invoice and history before repeating an action.

Staff APIs enforce authentication, roles, strict bounded payloads, origin and CSRF. Direct Firestore client access remains denied. No new environment variables, provider settings or composite indexes are needed.

## Validation

October 5 continuation (October 6 UTC): `pnpm check` passed with typecheck, lint, **118 domain tests**, seven Firebase credential tests, two runtime tests and the production build. `pnpm test:commission-billing` is the focused regression entry point. Its Auth/Firestore run with the browser-preview flag passed **33 grouped integration checks**, including the shared authentication suite; emulators shut down successfully.

Checks cover unsigned/changed/foreign agreement rejection, role/CSRF protections, draft allocation caps, stale writes, concurrent issue retries, unique numbering across commissions, duplicate receipts, overpayment/future-date rejection, partial balances, reversal history, void restrictions, source/contact restrictions, history caps, staff rendering, printable-document privacy, and no shop/stock/email side effects.

Chrome verified final-balance autofill, draft save, unsaved-edit issue blocking, keyboard issuing, partial payment entry, payment-record reversal and visible balance updates. The 390px viewport had no page overflow; the invoice table scrolls inside its wrapper. Desktop layout and captured error logs were checked (no browser errors). The temporary tab and viewport override were cleaned up. Native date entry was exercised through keyboard input after browser automation's fill did not populate the required date.

Manual print/PDF output, full screen-reader/real-device review and deployed smoke testing remain pending. The printable HTML projection is covered by integration checks; an actual exported PDF was not verified. No production records, funds, emails, provider configuration or deployment changed.

## Remaining scope

Limits: 20 invoices including voids per agreement, 20 receipt records including reversals per invoice, 200 billing changes per agreement, 500 agreement/billing records in the directory. USD only. These bounds fail explicitly instead of silently truncating billing history.

This slice tracks agreed installment invoices and external receipts. Stripe collection and reconciliation, private client payment access, credit notes/refunds, reminder/email delivery, tax allocation suitable for jurisdiction-specific invoice reporting, issuer billing identity/address configuration, ledger posting, accepted change orders and payment-gated deliverables remain separate work. Invoice kinds do not enforce project milestone completion. The user has deferred Stripe commission collection; the next proposed slice is client proof review and version-specific approvals. Existing live-payment/email activation and carrier/dispute follow-ups remain deferred.
