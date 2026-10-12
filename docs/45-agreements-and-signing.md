# Agreements and private signing invitations

Open **Agreements** in staff navigation, or **Open agreement** on an accepted proposal. Super admins and legal staff manage agreements; accounting reads documents and history. The agreement page and directory include a role-accessible how-to.

## Workflow

1. Start with an accepted proposal. Enter reviewed agreement terms and dates, add a private action note, and save the draft. No legal template is supplied. The full client-facing accepted proposal and client snapshot are preserved; its total cannot be changed through the agreement.
2. Review the saved document and choose **Create signing link**. The browser creates a random 256-bit invitation code, the server saves only its hash, and the saved document is frozen. Share the private link yourself. The code is in the URL fragment, not query parameters or server page requests. No email is sent.
3. The signatory opens the link and chooses **Load agreement**. Only the agreement, attached accepted proposal, client name/email and public signature information are returned. Private staff notes, external signature evidence and proposal response references are excluded.
4. The signatory enters a full name and declared date and explicitly consents before choosing **Sign agreement**. The server checks the current invitation, expiry, revision and document hash, then atomically stores the signature, exact consent text, server timestamp and immutable history.
5. Staff can inspect saved historical documents and print the displayed document. Browser headers/footers must be disabled when sharing a PDF to omit private URLs. PDF rendering and real-device verification must be checked separately from API tests.

Links expire seven days after creation. **Replace signing link** revokes the old code. **Revoke link and reopen draft** revokes signing access before edits. Signed agreements cannot be reopened or edited. **Void agreement** revokes access and preserves signature/history; it records studio status, not automatic cancellation of external obligations. Staff can separately **Record external signature**, which is labelled staff-recorded and revokes any client invitation.

## Recovery and storage

Commands use expected revisions and actor-scoped operation IDs. Staff and client UIs retain uncertain commands in memory and, where available, session storage. Retry repeats the original request. Staff can recover interrupted actions in the same tab; clients loading a link recover their pending signature. Lost sharing links must be replaced. Revoked/expired links cannot retrieve documents or submit a signature, including old retries.

One agreement is stored at `businesses/sadboi/commissionAgreements/{proposalId}`, where the proposal ID is the shared inquiry/proposal series ID. Immutable snapshots are in `history/{revision}`; `agreementOperations` and `agreementSigningOperations` hold request fingerprints and receipts. Plaintext invitation codes are not persisted in Firestore or history. The document hash covers normalized terms, client snapshot and full accepted proposal. Reads validate the hash before exposing a signing document.

API routes enforce staff roles, origin/CSRF for staff commands, origin/JSON/bounded bodies for public access, and a high-entropy capability for every public read/sign request. Public endpoints return no-store responses and do not log request bodies or invitation secrets. Existing Firestore client deny rules remain in force. No new provider configuration or index is required.

## Scope and limits

One agreement per accepted proposal series, up to 100 history entries, USD only. An invitation requires an active contact and room for its signing history entry. Client signature and revocation races cannot both commit. Agreement actions do not alter project status, invoices, stock, payment or email records.

This is a single-signatory workflow based on possession of a private invitation, not independent identity verification. Countersigning, legal templates, attachments, amendments, reminders and automatic email are later work. Signed agreements now link to [commission invoices and deposits](46-commission-invoices-and-deposits.md), a separate staff billing workflow; signing itself never creates an invoice or collects money. Existing starter agreements without a proposal snapshot must receive a fresh invitation before client signing.

## Validation

Run `pnpm check`, then `pnpm test:agreements` sequentially. The agreement integration suite uses disposable Auth/Firestore emulators. It covers roles/CSRF, canonical accepted sources, immutable pricing, parallel edits, request replay, private-data projection, invalid/cross-record tokens, expiry, replacement/revocation, consent/date/hash guards, parallel signature retries, frozen history, staff pages, and absent commerce/email effects.

Validation on October 5: `pnpm check` passed with 112 domain tests, seven credential tests, two runtime tests, lint, typecheck and the production build. The focused agreement/auth emulator run passed **29 integration checks** and shut down successfully. Chrome loaded the fictional agreement, verified required-date validation, submitted consent/name/date, and displayed the saved signature. The 390px viewport had no horizontal overflow; captured browser errors were empty. The viewport and temporary tab were cleaned up.

Manual PDF output verification, staff form interaction in a browser, real-device/accessibility review and deployed smoke testing remain outstanding. Staff pages and role-specific help were rendered through authenticated HTTP integration checks. No real agreement, payment, email, deployment or provider configuration was changed.
