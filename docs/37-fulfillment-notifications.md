# Pickup and shipping notifications

September 30, 2026: extends the [order-email queue](36-order-emails.md). Domain, Google Workspace and Resend activation remain explicitly deferred. Keep `SADBOI_ORDER_EMAIL_MODE=disabled`; building and previewing these features does not require an email account.

## Workflow

- A paid order saved as **Packed** with **Studio pickup** queues **Ready for pickup**. Switching an already-packed shipping order to pickup also queues readiness. Customers are asked to confirm the time and location with the studio; no studio address or opening hours are invented.
- Saving **Shipped** queues **Order shipped**, with the saved tracking number or an explicit missing-tracking message.
- Changing or clearing tracking while Shipped queues **Tracking updated**. Notes-only edits and unchanged saves do not notify again. Delivery/collection confirmation emails are outside this slice.
- Fulfillment, stock effects, audit, operation recovery and the notification commit in the same Firestore transaction. Email delivery itself happens later. Stable event IDs include the fulfillment revision; identical request retries return their original result without another message. A competing stale save fails without an email or partial stock movement.
- Only orders with the original recoverable private-link pointer can queue notifications. Historical orders are not backfilled. Templates remain TEST-labeled, are frozen per event and omit recipient names, addresses and internal notes. Tracking is escaped and displayed as text; no automatic carrier URLs or scans are provided.

## Latest customer status and staff review

The existing private order link now shows Preparing your order, Ready for pickup, Packed for shipping, Shipped, Collected, Delivered or Fulfillment cancelled, as appropriate. Shipped/delivered orders show the latest tracking number or its absence, plus the saved update time. Order and fulfillment are read consistently after existing capability authorization and payment reconciliation. The response includes only status, method, tracking and update time from fulfillment; internal notes and addresses are excluded. Invalid historical fulfillment records are omitted for staff reconciliation.

In **Orders**, reopen the saved order and use **Load email history** / **Refresh email history**, then **Preview email**. Accounting remains read-only. Existing super-admin processing/retry, CSRF protection, recipient restrictions and bounded provider retry behavior apply to all new message kinds. History shows the most recent 50 messages and explicitly flags older retained records. The active per-order processing query excludes completed/disabled records so older history cannot block new messages.

Before the first provider attempt, the worker compares a fulfillment event with the current saved order, status, method, latest notification revision and shipped tracking. An obsolete event becomes **Not sent: order changed**, with zero attempts. This covers cancellation, collection/delivery, method changes and newer tracking corrections. Disabled previews remain disabled and are never automatically activated.

Once any delivery attempt has begun, its outcome may be uncertain. Recovery retains the original provider key and payload even if fulfillment changes afterward. It does not rewrite, recall or cancel a potentially accepted message. There is also a normal race between claiming a message and an ensuing fulfillment edit; messages describe recorded events and direct the customer to the current private page. This is not a guarantee that old messages can never arrive after a later update.

## Deployment and verification

Deployment is deferred; no provider settings or production records are changed by this feature build. Before deploying this slice, deploy the `orderEmails` composite indexes in `firestore.indexes.json` and wait until ready (`pnpm exec firebase deploy --only firestore:indexes` against the intended project). They support recent history and active per-order processing. Then deploy the application with sending disabled. Actual Resend activation follows the separate [saved checklist](36-order-emails.md#setup-for-approved-test-inboxes).

Validation commands: `pnpm check`, `pnpm test:order-emails-disabled`, and `pnpm test:order-emails`. Integration checks use disposable Firebase emulator data and a loopback mail fixture, never real inbox delivery. The in-app walkthrough is `/admin/how-to#order-emails`, with fulfillment guidance and a contextual link from each order.

Validation completed September 30, 2026:

- `pnpm check` passed: type checking, lint, 81 domain tests, 7 credential tests, 2 Firebase runtime tests, and the production build.
- `pnpm test:order-emails-disabled` passed 33 integration checks. New fulfillment messages remain inactive previews with zero delivery attempts.
- The combined checkout/fulfillment/payment/lifecycle/email suite passed 83 integration checks, including competing saves, duplicate operations, tracking corrections/removal, obsolete unattempted notices, identical retry payloads after collection, recipient restrictions, private-link authorization, safe guest fields, latest-50 history, and legacy/unpaid orders. All provider delivery used the local fixture.
- An initial combined run stopped with a local `ECONNRESET` while fetching a CSRF token at the start of lifecycle checks. The complete rerun passed with no application changes; browser inspection waited for the harness preview marker on the successful run.
- Connected Chrome verified Ready for pickup and Shipped on the private customer pages, missing-tracking copy, removal of the token fragment from the address bar, the staff walkthrough, event-specific history, obsolete-message zero attempts, and keyboard expansion of the tracking-removal preview with its private link hidden. No captured browser errors. At 390px viewport width, customer pages had 390px client/scroll widths; staff history had 375px client/scroll widths with the scrollbar, a single column, and readable wrapping. Temporary viewport settings and tabs were cleaned up; all emulators stopped successfully.

Real inbox delivery, full screen-reader/real-device validation, carrier integrations, partial shipments, pickup scheduling, post-delivery corrections, and live customer sending remain outside this slice. No production orders, provider settings, environment secrets, or deployments were changed.
