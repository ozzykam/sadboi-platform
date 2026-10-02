# Commission inquiries and internal projects

First internal workflow, October 1, 2026. Open **Projects** in staff navigation; help is `/admin/how-to#commissions`.

## Workflow

1. Create the client in Contacts, then choose **Add inquiry**. Record the brief, deliverables, optional USD planning budget, desired deadline, qualification, private notes and follow-up date.
2. Save a stage of New, Reviewing, Estimating, Accepted or Declined with an update note. Accepted means the studio's internal decision; it is not a signed agreement or evidence of a deposit.
3. Open a saved, unarchived Accepted inquiry, add a conversion note and choose **Create project from inquiry**. Conversion requires an active linked contact and uses the saved brief. It atomically creates one linked project, preserves the accepted brief and makes the original inquiry read-only.
4. Add milestones and tasks with progress, optional dates and private notes. Tasks may reference a milestone on the same project. Save the complete plan with an update note; each save creates a history version.
5. Track Planned, Active, On hold, Completed or Cancelled. Completion requires all tasks done/cancelled and milestones completed/skipped. A milestone cannot complete while its own tasks remain open. Explicitly reopen completed/cancelled work before changing it.

Super admins create/update/convert; accounting reads. Legal, anonymous and customer access is denied. Contact access remains governed by the existing Contacts workflow. Records are private and do not appear on public pages or customer order pages.

## Changes, archive and recovery

Contact name/email snapshots are captured at intake or reassignment. Directory edits do not silently rewrite commission history. Existing inquiries can keep an archived contact for historical edits, but new selection and conversion require an active contact. The original accepted brief remains on the project even when later internal scope or budgets change.

Unconverted inquiries and projects can be archived and restored through Visibility and the list's Show filter. Archiving is not cancellation or deletion. Restore an archived project before editing it. Converted inquiries retain their accepted snapshot and link; manage subsequent work and archival on the project.

Saved tasks/milestones cannot be removed; cancel tasks or skip milestones. Newly added unsaved rows can be removed. Cancelling a project preserves the work plan and collects/refunds no money.

Every write requires the saved revision and an actor-scoped operation ID. Exact retries return the original result, including conversion retries after later project edits. Reusing an ID for changed content fails. Concurrent conversions cannot create duplicate projects; stale updates cannot replace a newer plan. All related records/counters/history/operation results commit atomically.

The browser freezes editing during an unknown save. **Retry same commission save** reuses the exact request; **Recover interrupted save** restores it from session storage after reopening the same tab. Authentication failures retain the request for retry after sign-in. Storage can be unavailable: check saved records before creating a new request. Reload saved record or Back to list discards unsaved form edits.

## Records and limits

- `commissionInquiries` and `commissionProjects` hold current plans, contact snapshots, revisions and source links. Project IDs derive from the source inquiry, independently of request identity.
- Each record's `history` subcollection stores immutable full plan snapshots, update notes, actor and time. The screen shows the latest 20; earlier versions remain stored.
- `commissionOperations` holds actor-scoped request fingerprints/results; `commissionAudit` holds audit events; `commissionState/counts` bounds workspace growth.
- Up to 500 inquiries and 500 projects, 200 versions per record, 40 tasks and 20 milestones per project. The contact selector supports the existing 1,000-contact directory. No new client Firestore permissions, composite indexes, provider settings or environment variables are needed.

Planning budgets use integer USD cents; blank is unknown and zero is explicitly zero. The budget is not a price quote, invoice, deposit, payment or ledger posting. Dates are optional planning dates and do not send reminders. Commission planning does not change stock, store orders, artwork publication or external communication.

## Validation

Commands: `pnpm check` and, sequentially, `pnpm test:commissions`. The latter runs Contacts and Commission tests against disposable Auth/Firestore emulators. Browser preview: add `--commission-preview` to the integration script's `--contacts --commissions` arguments.

`pnpm check` passed with 102 domain tests, 7 credential tests, 2 runtime tests, type checks, lint and the production build. Domain coverage includes exact budget parsing, strict dates/fields, project completion and milestone relationships, retention of saved work and explicit reopening. Integration coverage includes roles/CSRF, contact eligibility and snapshots, concurrent creation/edit/conversion, retry recovery, history, archive/restore and record limits.

The combined Contacts/Commissions emulator run passed **43 integration checks**. It included browser preview and completed the remaining session-revocation checks afterward. Emulators shut down successfully; the temporary browser tab and viewport override were cleaned up. Deployment and deployed verification remain pending.

After the final browser-driven spacing changes, `pnpm check` passed again, including lint, 102 domain tests and the production build; normal Next.js route types were regenerated. `git diff --check` passed.

Chrome used disposable emulator records to create an accepted $650.25 inquiry via keyboard submission, convert it, add a linked milestone/task, verify premature-completion rejection and save completion with three history versions. The accepted source inquiry stayed read-only. Project filtering and linked help rendered at 390px without horizontal overflow; no browser console errors were captured. Paragraph/action spacing was adjusted during review. Full screen-reader and real-device testing remain outstanding.

## Deferred

Formal estimates/proposals and staff-recorded client responses are now available as a [linked workflow](43-estimates-and-proposals.md). Public intake, standalone internal-art projects, assignments/time tracking, agreements, deposits/installment invoices, client messages/proof review, revision tracking/change orders, protected final delivery and artwork links remain later slices. The inquiry/project workflow itself creates staff planning records only.

Deployed dispute testing remains deferred by the user. Domain/Google Workspace/Resend activation and live carrier quotes remain deferred; live payments and email sending remain disabled.
