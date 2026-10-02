# Public contact and inquiry intake

The public form is `/contact`, linked from the public header as **Contact**. It gives visitors one place to start a conversation while asking what the message is about: commission/custom artwork, shop/order help, wholesale/stockist, press/collaboration, or a general question.

The guide explains each purpose before the form. Visitors provide name, email, subject, message and an optional order/artwork reference. A consent checkbox confirms that the studio may review and respond. The form does not request passwords or payment details, does not subscribe anyone to a mailing list, and does not create a commission, Contact record, order, agreement or payment.

## Staff review

Super admins and accounting open **Inquiries** in the staff navigation or `/admin/inquiries`. The private inbox is a table showing purpose, sender, subject, received date and status. Click a row or its subject to open the full message in a review dialog. Super admins can add a private note, leave a message New, set Reviewing/Replied/Closed/Spam, archive it, or restore an archived message. Accounting is read-only; legal and anonymous users are denied.

Each row has quick icon actions: archive, mark read (moves New to Reviewing), and mark spam (sets Spam and archives). The status filter and Show archived checkbox control the table. Notes and status/archive changes use the existing same-origin/CSRF and revision checks. The inbox does not send email automatically; use your chosen channel and mark Replied afterward.

## Safety and recovery

The server accepts same-origin JSON only, bounds requests at 32 KB, validates all fields strictly, requires a blank honeypot and consent, and stores only a bounded private record. A request ID makes browser/network retries idempotent; reusing it with different content conflicts. The inbox is capped at 10,000 records and the public directory is capped at 500 loaded records until pagination is added. Firestore clients have no direct access.

Public messages are stored under `businesses/sadboi/publicInquiries`; request receipts, counters and per-message private status history are separate records. The initial submission is atomic with its receipt and counter. Archive state and the latest private note are retained on the message. No email, CRM contact, project, proposal, shop order, stock, Stripe or payment record is created.

## Verification and limits

Core validation covers all purpose values, consent, honeypot, email, length and strict-field rules. `pnpm test:public-inquiries` passed **29 integration checks** for anonymous/staff access, origin and validation, duplicate retries, conflicting request IDs, private inbox reads, CSRF-protected staff updates and help/page discoverability. `pnpm typecheck` and final `pnpm check` passed; the production build includes `/contact`, `/admin/inquiries` and `/api/public-inquiries`. Public anti-abuse controls beyond the honeypot and request bounds, attachments, automatic routing, email delivery, unsubscribe preferences and client portal messaging remain future work.
