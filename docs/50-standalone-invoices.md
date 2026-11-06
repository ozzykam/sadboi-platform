# Standalone invoices and reusable defaults

November 5, 2026. Implemented locally alongside signed commission billing.

## Workflow

- `/admin/invoices` lists standalone invoices and retains the existing signed-agreement billing directory. New invoice does not require a proposal or agreement. Contact selection is optional; names/emails are copied into the billing snapshot.
- `/admin/settings/invoices` stores studio billing identity, net payment days, payment instructions, client notes and reusable usage language. New drafts copy these settings; existing records never follow later defaults changes. USD only.
- The Flight of the Conchords starter is an **unsaved** draft: provisional “Jermaine of Flight of the Conchords,” poster artwork $1,800 and tea towel artwork $500, $2,300 subtotal, net-30, Stripe instructions, unresolved tax, and proposed usage restricted to posters/tea towels with express written permission for other merchandise. No production invoice or contact is automatically created.
- Drafts accept missing email/address and unresolved tax. Issuance requires a confirmed billing recipient, studio billing email or address, positive total, resolved tax with explanation, and usable payment instructions. Stripe requires an HTTPS link on buy.stripe.com, invoice.stripe.com, or checkout.stripe.com; staff verify provider details separately.
- Issue freezes the input, allocates a unique `INV-000001` sequence, and calculates the due date from the actual issue date using UTC calendar days. It sends no email and makes no Stripe API calls.
- Itemized descriptions, integer quantities and integer USD cents; up to 30 lines, optional discount and manually calculated tax. Maximum subtotal/total $1m. Unresolved tax is labeled Needs review and shows a before-tax amount, never a confirmed zero-tax total.
- Usage options: none, proposed, agreed. Reusable templates start proposed. Agreed requires a private acceptance reference; editing wording resets status in the editor. This is staff-recorded evidence, not an electronic signature or a new enforceable agreement created by issuance. Existing agreement references are free text, not billing-allocation links.
- The detail view opens a readable invoice, with Edit draft, explicit issue/void, external payment records, correction by reversal and private action history. Issued inputs cannot be edited. Paid records prevent voiding until payment records are resolved; reversals do not refund money.
- A separate authenticated print page excludes action notes, acceptance evidence and payment references. Browser Print / save PDF is available; staff should inspect their exported PDF and disable browser headers/footers. It is not a public customer URL.

## Persistence and authorization

- `businesses/sadboi/studioInvoices/{uuid}` stores one invoice, immutable input after issue, payment records and revision. Append-only `history/{revision}` includes full historical invoice snapshots, actor and private note.
- `inventoryState/invoiceDefaults`, `inventoryAudit`, `studioInvoiceOperations`, and `counters/studioInvoice` store defaults, audit, actor-scoped fingerprinted operation results and numbering. Firestore transactions enforce expected revisions, retry idempotency, and atomic sequence allocation.
- Super admins write; accounting reads/prints; legal and anonymous users cannot access this billing workflow. APIs require staff mode, bounded strict schemas, authenticated role checks, exact origin and CSRF validation. Direct client Firestore remains denied.
- Invoice changes are limited to 200 revisions, 50 payment records including reversals. Duplicate active payment method/reference pairs are rejected within each invoice. Staff must reconcile allocations across invoices and the separate commission billing workflow manually. Directory fails explicitly above 500 records pending pagination.
- Browser mutations retain their exact pending command in memory/sessionStorage until confirmed and offer same-command Retry, including after same-tab reload. Storage failure still allows in-memory retry. Known rejected requests clear pending state; concurrent edits require reloading.

## Validation and remaining scope

- Core tests cover totals, tax blockers, overflow, provisional recipient, immutable issuance, UTC month/leap boundaries, unsafe Stripe URLs, proposed/agreed evidence, partial/full/overdue payment status, reversal and void rules.
- `pnpm test:invoices` runs authentication and standalone-invoice integration checks against disposable Firebase emulators. It covers role/CSRF/origin checks, duplicate requests, concurrent edits and sequence allocation, defaults snapshots, missing tax/payment fields, print privacy, reversals, foreign records and no shop/stock/agreement/email side effects.
- Validation: all 144 core tests passed. The disposable emulator run passed 31 grouped authentication/invoice checks and shut down cleanly. Rendered HTML checks verified the starter, provisional and unresolved-tax labels, read-only accounting view, and absence of private notes/references/evidence on print pages.
- `SADBOI_AUTH_TEST=1 pnpm check` passed: type checking, full lint, 144 domain tests, seven credential tests, two runtime tests and the production build. The build used isolated `.next-auth-test` output so the live development server's build files were preserved.
- Visual/browser PDF QA remains pending: the browser automation API failed before navigation with `Cannot read properties of undefined (reading 'timeoutMs')`, including after reconnecting and resetting its session. No browser layout or actual exported PDF verification is claimed.
- No automatic tax calculation, Stripe invoice creation/collection/webhook synchronization, invoice email, client public invoice portal, downloadable server-generated PDF, credit notes/refunds, ledger posting or standalone agreement-signing extension. Existing signed-proposal Agreements and commission allocation workflows remain separate.
