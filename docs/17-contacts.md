# Contacts and organizations

Contacts at [Contacts](http://127.0.0.1:3100/admin/contacts) provide the shared relationship directory for people and organizations around the studio: clients, collectors, galleries, licensees, printers, suppliers, patrons, and collaborators. The [in-app Contacts tutorial](http://127.0.0.1:3100/admin/how-to#contacts) matches the current interface.

## Workflow

- Super admins choose **Add contact**, select Person or Organization, enter contact details, optionally link a person to an active organization, add up to three relationship labels, notes, and a follow-up date, then choose **Save contact**.
- People and organizations are separate records. A person can reference one active organization; organizations cannot be nested.
- Search covers name, email, and relationship labels. The directory filters People and Organizations separately.
- Use **Edit contact** to update details. Set Status to **Archived** when the relationship is no longer active. Archived records remain in the directory/history and cannot be selected as a new person's organization.
- Legal and accounting can read the directory; only super admins can create, edit, or archive records.

## Connected behavior and limits

Contacts are an internal relationship directory. Notes and follow-ups do not send messages, create invoices, alter supplier purchase orders, change artwork rights, or create commission records. Staff can now select an active contact when creating an inquiry in Projects; see [commission inquiries and projects](42-commission-inquiries-and-projects.md). Commission records preserve contact snapshots at intake or reassignment, so later directory edits do not rewrite their history. Supplier order details remain in Purchasing, while a supplier relationship can also be represented here.

The directory supports 1,000 contacts and organizations, including archived records, until pagination is added. Each record supports up to 20 relationship entries in the domain schema; the current UI presents three practical relationship rows. Email, dates, names, labels, notes, and websites have bounded validation. An organization must be active before a new person can link to it.

## Consistency and history

Contact writes require the current super-admin membership, exact origin/CSRF proof, strict schemas, and a current revision. Concurrent edits return a conflict instead of silently replacing a newer record. Actor-scoped operation IDs make retries idempotent. Contact records, operation records, and audit events are server-owned under `businesses/sadboi`; no new client Firestore permissions or composite indexes are required.

If a save is uncertain, keep the form open and retry the same entry. After reloading, refresh the directory before repeating it. If the record changed, review the latest values and edit again. Archiving is reversible by editing the record back to Active; it does not delete history.

## Validation

```powershell
pnpm typecheck
pnpm test:contacts
```

The Contacts suite uses disposable local Auth/Firestore emulators and covers read/write roles, origin/CSRF enforcement, idempotent creation, validation, organization links, concurrent edits, archive behavior, audit/idempotency records, and tutorial/page discovery. Browser visual and interactive verification remains outstanding while no browser is connected.
