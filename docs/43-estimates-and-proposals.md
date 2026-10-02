# Estimates and proposals

Projects → open an inquiry/project → **Estimates and proposals**. Super admins manage; accounting reads/prints; legal and anonymous users cannot access. The in-app tutorial is `/admin/how-to#proposals`.

## Workflow

- Prepare a client-facing estimate using the saved commission title, brief and deliverables. Private source notes and qualification are never copied. Set timing, revision allowance, optional additional terms, validity date and itemized USD pricing.
- Quantities are whole numbers. All calculations use integer cents. A fixed discount cannot exceed subtotal; manually entered tax is added afterward. Subtotal and final total are capped at $1,000,000. Tax treatment must be resolved before issue; the platform supplies no tax policy or calculation service.
- Save/review a draft, then **Issue saved proposal**. Issue requires a positive total, nonexpired validity and an active contact/open commission. Numbers `PR-000001` onward are allocated transactionally on first issue. The same number is retained across versions.
- The client name/email comes from the commission's intake/reassignment snapshot. Directory changes do not rewrite it. A changed inquiry client requires another draft save before issue. Proposal fields stop following source edits after the first draft.
- Issue freezes the current version. **Create revised draft** copies it to the next version and supersedes the earlier offer immediately. Declined/withdrawn offers can also be revised. Accepted offers are terminal in this slice; corrections/amendments need the future change-order workflow.
- **Record client acceptance/decline** requires a private evidence/reference identifying the response received elsewhere. Acceptance only applies to a currently issued, unexpired version. Validity includes the selected date in UTC. This records staff-observed acceptance; it is not electronic signing.
- Print/save PDF uses only the displayed client document. Private change notes, response evidence, navigation and staff identity are excluded by print CSS. Review the client-facing text yourself and disable browser headers/footers to omit the private URL. This is a staff-only page, not a shareable public link. Sending, delivery tracking and signing are not implemented.
- Conversion shares one proposal series between the inquiry and project. It does not duplicate or renumber the offer. Proposal actions do not change the inquiry stage/project status, reserve stock, create invoices/journals/payments, send email or collect deposits.

## Storage, recovery and limits

`businesses/sadboi/commissionProposals/{inquiryId}` holds the current proposal. Its `history/{revision}` subcollection stores every saved snapshot, action, private note and actor. `proposalOperations` stores actor-scoped request fingerprints/results; `proposalState/numbering` holds the counter. Writes, history, numbering and operation receipts commit atomically. Firestore clients remain denied; server APIs check roles, same-origin/CSRF and strict command schemas.

Each command checks the expected revision. Competing commands conflict, and an identical operation retry returns its original result even after later changes. The browser retains a pending command until the result is loaded; **Retry same proposal action** and **Recover interrupted proposal action** reuse it. Recovery uses session storage scoped to the shared proposal series; when storage is unavailable, check history before trying a new action. **Reload proposal** discards unsaved edits.

Limits: one series per inquiry/project, 20 price items, 20 commercial versions and 100 saved changes. Full bounded history is available; nothing is deleted. All proposals are USD. No external service, environment variable or composite index is added. Deploy the application when authorized, then smoke-test with dedicated records. Production deployment and real client activity are not part of this build.

## Verification

Domain tests cover exact totals, invalid money/quantities, immutable states and expiry/tax/positive-total guards. `pnpm test:proposals` passed **50 integration checks** across contacts, commissions and proposals on disposable Auth/Firestore emulators, including roles/CSRF, concurrent creation/editing/issue, replay, unique numbering across separate proposals, source conversion/reassignment, immutable snapshots, response references, limits and absent shop/stock/email effects. Emulators exited successfully.

Chrome verified keyboard draft submission, the $600 subtotal less $50 discount = $550 total, unresolved-tax issue rejection, issuing, revision/superseded history, staff-recorded acceptance and its read-only document. The document excluded private draft notes/response evidence. The 390px document layout was readable without horizontal overflow; captured console errors were empty. Test tabs and viewport overrides were cleaned up. The native print dialog blocked automation after invoking Print / save PDF; its tab was closed safely. **Manual PDF output verification remains pending**, including browser header/footer settings.

Final `pnpm check` passed: typecheck, lint, **105 domain tests**, seven credential tests, two runtime tests and the production build. An initial lint error from JSX inside page-level try/catch was corrected by keeping only the data load in the catch boundary. `git diff --check` passed. No live records, provider settings, emails, deployment or git push were changed.

Next: agreements linked to the accepted proposal, then deposits/invoices and client proof/delivery workflows. User-deferred dispute testing, email/domain setup and live carrier quotes remain deferred.
