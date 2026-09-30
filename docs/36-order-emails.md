# Order confirmation and payment emails

This slice adds durable order-received and payment-confirmed emails with the existing private order link. Sending defaults to **disabled**. Resend and a sender domain have not been configured; no real customer emails were sent during development. The user plans to use Resend for automated messages and possibly Google Workspace for the reply inbox.

## Behavior and access

- A new order transaction writes its order-received message; the transaction that confirms payment writes its payment-confirmed message. Verified late-payment acceptance also queues the payment message. Pending review and failed payment reports do not claim payment confirmation.
- Stable IDs (`orderId_kind`) and existing order/payment transaction guards prevent duplicate queue records. Email/provider failures occur outside these transactions and do not undo orders, payments, or stock.
- Templates are frozen when queued. They are labeled TEST, include USD totals and item descriptions, escape catalog HTML, distinguish an order request from a paid order, and direct the customer to the current order status instead of assuming an old email is still current.
- The queue stores an operation reference, not a plaintext private token. The worker retrieves the original creation result from the existing server-only operation record and verifies its order ID, recipient, and token hash against the order. No new access bypass or client-readable Firestore collection is introduced. The token stays in the URL fragment and the existing customer page exchanges it through authenticated-by-capability POST requests. Full emailed links work in a new browser session; bare order URLs do not.
- Staff previews replace the link with a placeholder. Super admins can process due messages and retry provider-rejected messages. Accounting can only read history. Legal/anonymous users cannot access email history or sending routes. Mutations require the existing same-origin CSRF protection.
- Historical orders are not backfilled. Messages created with sending disabled remain disabled previews even after configuration changes; this avoids unexpectedly mailing old test orders.

## Setup for approved test inboxes

**Deferred by user on September 30, 2026:** domain setup, Google Workspace, Resend configuration, and actual email activation will wait while feature development continues. Keep `SADBOI_ORDER_EMAIL_MODE=disabled`. This is an external setup task, not a blocker for building and testing the remaining features.

When ready to resume:

1. Choose the studio domain, sender address, and monitored reply address.
2. Set up Resend and verify the sending domain using its supplied DNS records.
3. Set up the reply inbox (Google Workspace if chosen); an existing monitored inbox can be used while Workspace is pending.
4. Add the server-only variables below to the intended Vercel environment, including explicitly approved test recipients, and deploy the email implementation.
5. Create a fresh test order and complete a Stripe test payment. Verify both messages in the approved inbox and confirm the full private order link works in a new browser session. Provider acceptance alone is not proof of inbox delivery.

Messages created while sending is disabled remain previews; enabling delivery later does not send that backlog.

Configure these server-only environment variables in the intended environment. Do not use `NEXT_PUBLIC_` or commit real values. Placeholders are in `web-app/.env.example`.

| Variable | Purpose |
| --- | --- |
| `SADBOI_ORDER_EMAIL_MODE` | `disabled` by default; `resend` enables the configured test transport |
| `RESEND_API_KEY` | Resend sending key (`re_…`) |
| `SADBOI_ORDER_EMAIL_FROM` | Bare address on a verified sender domain |
| `SADBOI_ORDER_EMAIL_REPLY_TO` | Optional bare address of the monitored studio inbox |
| `SADBOI_ORDER_EMAIL_TEST_RECIPIENTS` | Explicit comma-separated approved test addresses; required while commerce is test-only |
| `SADBOI_APP_ORIGIN` | Existing canonical app origin used in order links |

Create/verify the Resend sender domain, choose the sender and monitored reply inbox, add credentials, then redeploy. No Google Workspace password is needed in the app. Use Resend's domain-specific DNS instructions; do not replace a working inbox's DNS with guessed values. Disable click/open tracking for this sending domain so private capability links are not rewritten through tracking URLs. Sending is restricted to the exact approved test recipient addresses; other addresses are blocked rather than silently redirected to someone else's inbox. Actual mailbox delivery and provider dashboard verification remain required after setup.

The existing authenticated `POST /api/cron/order-expiry` also processes due mail after stock cleanup. Keep the existing Google Cloud Scheduler job and bearer secret. Deploy this code to activate that behavior; no separate Cloud Function or scheduler is required. An email outage is reported separately and does not prevent the completed stock-release result. In `businesses/sadboi/inventoryState/orderEmails`, inspect `lastRunAt` and `results`, and inspect per-order history for blocked/review items. Disabled mode makes no delivery attempts.

## Retries and recovery

The worker scans a bounded batch with a document-ID cursor and attempts up to three deliveries per run. Each message has a transactional 90-second lease. A crashed worker can be recovered after the lease expires. Frozen sender, rendered template, origin, recipient, original token, and a payload hash keep retries identical. The provider receives a stable idempotency key.

Transient network errors, timeouts, rate limits, and server errors retry with bounded exponential delay. Definitive provider rejection is shown as Delivery blocked; fix the cause and use Retry delivery. Stale staff retries return a conflict rather than blindly resending. A provider acceptance response stores the provider reference; accepted messages cannot be resent from this screen. **Accepted does not mean delivered to the inbox.**

Automatic retries stop after eight attempts or 23 hours from the first attempt, before [Resend's 24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys) expires. Unattempted messages older than 24 hours also stop for review. Do not clear timestamps, change keys, or reset a Needs review record to queued: first reconcile the provider's records. This version deliberately has no force-resend button for an ambiguous outcome. A corrected customer address or a replacement link requires a separately reviewed support flow; staff cannot direct existing private links to arbitrary recipients.

Provider integration uses the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), with a separate reply-to address when configured. No provider SDK dependency is required.

## Testing

- `pnpm check`: types, lint, domain tests, credential/runtime tests, production build.
- `pnpm test:order-emails`: existing checkout/fulfillment/payment/lifecycle integration checks plus email queue tests.
- `pnpm test:order-emails-disabled`: default-off preview behavior and authorization.
- Emulator delivery uses a loopback HTTP fixture, guarded by `SADBOI_AUTH_TEST`, the emulator environment, and `SADBOI_EMAIL_TEST_PORT`. Emulator mode rejects actual provider transport even if credentials are inherited. The harness explicitly disables email unless running the email suite.

Validation completed September 29, 2026 (America/Chicago; September 30 UTC):

- `pnpm check` passed: typecheck, lint, 79 domain tests, 7 credential tests, 2 Firebase runtime tests, and the production build.
- Disabled-mode suite passed **27 integration checks**, including previews with zero attempts, capabilities hidden from staff responses, and authorization/CSRF.
- Combined checkout/fulfillment/payment/lifecycle/email suite passed **75 integration checks**. Email coverage includes concurrent creation/payment deduplication, parallel workers, lost acceptance responses with identical retry content/key, lease recovery, retry cutoff, recipient restrictions, revision-protected staff retry, corrupted-capability blocking, provider outages, scheduled processing, and confirmation only after verified late-payment acceptance.
- Connected Chrome verified staff email history, accepted/blocked states, keyboard preview expansion, the hidden private-link placeholder, safe display of HTML-like catalog text, blocked retry feedback with zero attempts, and the contextual how-to link. At a 390×844 viewport, the document had no horizontal overflow (client width and scroll width both 375 with the scrollbar). Temporary viewport overrides and the test tab were cleaned up, and the emulators shut down successfully.
- An initial lint error in tutorial text and a test-helper variable shadowing Node's `process` were corrected before the successful runs. Neither required changing the order/payment behavior.

All delivery tests used a local HTTP fixture. No production order records, provider settings, or real mailboxes were modified. Actual Resend acceptance/inbox delivery, bounce handling, and full assistive-technology/real-device validation are not claimed.

## Current limits

This document describes the order-received/payment-confirmed foundation. The September 30 [fulfillment notification extension](37-fulfillment-notifications.md) adds pickup-ready, shipment and tracking-update previews plus current fulfillment details on the private order page. Bounce/complaint webhooks and suppression, a public replacement-link request form with abuse controls, recipient correction, general customer accounts, and live customer sending remain open. A customer who loses the email as well as their saved checkout link must contact the studio. Deployment, Resend domain/key setup, an inbox, and actual test-inbox delivery are deferred external activation steps.

The staff walkthrough lives at `/admin/how-to#order-emails`, linked from each order's Order emails section.
