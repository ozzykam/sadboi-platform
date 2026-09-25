# Shop payment confirmation and review

Updated September 25, 2026. This describes the internal confirmation boundary. The later [Stripe test adapter and review-resolution workflow](35-order-lifecycle-stripe.md) adds signed Checkout webhooks and supersedes deferred-adapter/expiry/resolution notes below. Live payments remain disabled. The shared-secret endpoint below cannot confirm orders bound to a Stripe account.

## API contract

`POST /api/store/orders/{orderId}/payment-confirmation` requires the server secret header `x-sadboi-payment-secret` matching `SADBOI_PAYMENT_WEBHOOK_SECRET`. Secrets are compared using constant-time digest comparison. Staff cookies do not authorize payment confirmation. This server-to-server endpoint does not use browser CSRF tokens.

Use JSON with a maximum body size of 32 KiB:

```json
{
  "eventId": "evt_example_12345678",
  "orderId": "0123456789abcdef0123456789abcdef",
  "provider": "stripe",
  "paymentId": "pi_example_12345678",
  "amountMinor": 5000,
  "currency": "USD",
  "status": "succeeded"
}
```

Event/payment IDs allow letters, digits, underscores, and hyphens, up to 200 characters (event IDs need at least 8). Order IDs are 32 lowercase hexadecimal characters and must match the route. Amounts are positive integer minor units, up to 100 billion; USD and succeeded/failed are the supported currency and results. Unknown fields are rejected. Never send raw card data or the provider's entire webhook payload.

The response contains `id`, reported `status`, `outcome`, `reason`, `orderStatus`, and `duplicate`. New outcomes are `applied`, `ignored`, or `review`; old event replays can return `legacy`. **HTTP 200 acknowledges receipt, not necessarily payment acceptance.** The adapter must inspect the outcome and alert on review.

| Event and existing order | Outcome | Order effect |
| --- | --- | --- |
| Matching first success, pending order with clean history | Applied | Mark paid and save the successful payment/event references and paid time |
| Failure on a pending order | Ignored / payment failed | Keep pending; do not write successful-payment fields |
| Failure on a paid, fulfilled, or cancelled order | Ignored / late failure | Preserve status and payment references |
| Another success for the same payment on paid/fulfilled | Ignored / already paid | Preserve status and payment references |
| Another successful payment on paid/fulfilled | Review / additional payment | Keep the original successful payment and order state |
| Success after cancellation | Review / late success | Do not reopen or allocate stock |
| Amount mismatch, identity conflict, or inconsistent history | Review | Preserve state and flag the order for reconciliation |

Identity/amount checks precede the state rules, including for failures. Review events are committed and set `paymentReviewRequired`; they do not issue refunds. Review flags persist after later valid events and are not automatically cleared. The UI currently provides review information, not a reconciliation/override action. An existing valid paid order is not automatically reversed by a review flag.

## Idempotency and concurrency

New events use provider-scoped document IDs in `storePaymentEvents`. Their normalized full input, fingerprint, outcome, reason, and original response are immutable. Exact repeats return the original response with `duplicate: true`, even after fulfillment or cancellation. The response's `orderStatus` is the original result, not a live status lookup. Reusing an event ID with different details returns 409 without writes.

`storePaymentIdentities` binds a provider payment to one order, amount, and currency. Concurrent cross-order claims serialize through that record; only one order can become paid. A successfully observed payment never regresses to failed in its identity record. Competing distinct payments on one order produce one applied success and one review event. Success/failure arrival order cannot reverse paid/fulfilled states.

Every read finishes before writes. Event receipt, payment binding, and the permitted order update commit atomically. Payment processing does not alter stock balances, allocations, location totals, fulfillment records, numbering, refunds, or journal entries.

Legacy raw-ID event documents are checked before new events. Exact legacy replays are read-only and labeled historical because the old record lacks an original outcome. Changed payloads conflict. Before creating a payment binding, the server inspects existing order/event references for that payment (maximum 100 of each); oversized histories return 503 without partial writes. Previous success evidence on a pending order, or old payment fields overwritten by the prior handler, requires reconciliation. No history is silently backfilled or treated as a new charge.

## Failure and retry handling

- 400/415: correct malformed input, unsafe IDs, route mismatch, currency, or content type.
- 401: fix the adapter's secret configuration; never expose the secret in browser code.
- 404: investigate the order reference. No event is committed.
- 409: the provider event identity was reused with different details; investigate without generating a replacement identity to bypass the conflict.
- 503/network interruption: retry the exact event and details with backoff. Unknown internal errors are redacted and return 503, rather than being misclassified as malformed requests. Historical-limit errors require administrative review before retrying.
- 200/review: receipt is stored. Reconcile with provider records; do not repeatedly resubmit or force the order paid.

## Staff workflow

Super admins and accounting open an order at `/admin/orders`, then choose **Load payment history**. The history lists reported status/amount, outcome, reason, payment/event IDs, and received time. **Refresh payment history** is read-only. Order cards and detail views identify payment-review flags. Instructions are linked at `/admin/how-to#store-payments`.

`GET /api/store/orders/{orderId}/payment-events` requires a super-admin/accounting session; anonymous/legal access is denied. It reads at most 200 events, sorted by received time with stable ID ties. It fails explicitly above the display limit rather than silently omitting events. Pagination/export tooling remains future work. Received times are server receipt times, not provider event chronology.

Reconciliation requires comparing provider records, order status, original event history, and fulfillment. The [review workflow](35-order-lifecycle-stripe.md) now accepts verified late payments with stock reallocation or verifies a completed full Stripe refund. Historical events without account mappings still need manual reconciliation. Do not edit status or invent another order to bypass a warning.

## External handoff and remaining work

The native Stripe adapter at `/api/stripe/webhook/[accountId]` verifies signatures, account, test mode and canonical order/session data before invoking confirmation. It awaits external test-account configuration. This older shared-secret endpoint does **not** verify native Stripe signatures and cannot confirm Stripe-bound orders. Keep its secret in the hosting platform's secret store only if this legacy integration is needed; emulators use a generated separate secret.

Pending-order cancellation/expiry and late-payment resolution are implemented in [the lifecycle slice](35-order-lifecycle-stripe.md). Automated refunds, live collection, shipping/tax calculation, journal posting and notifications remain unfinished. Whole-order fulfillment is implemented; see [fulfillment](31-shipping-fulfillment.md).

## Validation

`pnpm test:store-payments` runs checkout, fulfillment, and payment integration tests using disposable Auth/Firestore emulators. The suite covers authorization, malformed payloads, duplicate/conflicting event IDs, lost responses, ordering and contention, cross-order payment reuse, terminal-state protection, real fulfillment after payment, review persistence, historical records, bounded failures, read permissions, help, and unchanged stock. Domain tests cover input validation and the transition decision table.

September 25 results: `pnpm check` passed typecheck, lint, 73 core tests, 7 Firebase credential tests, 2 Firebase runtime tests, and the production build. The combined authentication/checkout/fulfillment/payment harness passed all 56 integration checks. Connected Chrome with a disposable accounting account verified review markers, history load/refresh, outcome/reference display, empty/error states, read-only fulfillment, and the help link. At 390×844, loaded history had no horizontal overflow; keyboard focus advanced from refresh to help. Desktop layout was inspected and no console errors were observed. Full screen-reader and real-device checks remain outstanding. No live business records, payment accounts, or provider configuration were changed.

For a local browser preview, run `pnpm firebase emulators:exec --only auth,firestore --project demo-sadboi-platform "node scripts/auth-integration.mjs --store-orders --fulfillment --store-payments --payment-preview"`. The harness uses localhost:3102 and prints disposable account credentials, then waits up to ten minutes for `web-app/.next-auth-test/payment-preview.done`. No live provider calls or business data are needed.
