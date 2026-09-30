# Shipping rates and checkout totals

September 30, 2026: the user chose to defer live carrier quotes and keep them on the todo list. This slice provides configurable US flat rates and free studio pickup. Stripe remains test-only; tax is explicitly **not calculated**, not assumed to be zero. Domain, Google Workspace, Resend and email activation remain deferred.

## Staff workflow

**Shipping** in the staff navigation opens `/admin/shipping`. Super admins enable standard/express services, set USD amounts per order, and select supported destination state codes. Accounting can read settings; legal/anonymous access is denied. Default settings disable shipping and select no destinations. Nothing is enabled or seeded in production by this build.

Rates use integer cents, up to $10,000 per order; zero is an intentional free rate. Supported destinations are the 50 states and Washington, DC. Territories and military destinations are outside this version. ZIP format is checked, but addresses are not carrier-verified. No delivery-date promises are made. The same selected destinations apply to both services.

Saves require the current revision and an operation ID, commit an audit record atomically, and recover an identical retry without repeating it. Stale saves require **Reload saved rates**. An uncertain save keeps inputs locked for **Retry same save**. Reload replaces unsaved edits. Changing settings applies to new quotes/order requests, never to existing order amounts or stock.

## Customer workflow and pricing

Customers add products to Cart, enter contact/address details and a fulfillment method/service, then choose **Review total**. A CSRF-protected, read-only quote rechecks public catalog status and reads current prices and shipping settings. It does not reserve stock, create an order or persist customer details. The review shows item subtotal, shipping, uncalculated tax and the total; **Request order** submits the reviewed quote identity. Changing form details or cart lines clears the review.

Quote identity is a deterministic hash of parsed input, priced lines and totals; it is a concurrency check, not an authorization capability. The order transaction rereads catalog/settings and requires an exact matching quote. Missing/forged/stale quotes fail without stock, order-counter or email writes. Price/rate changes require another review. Pickup is always free. Limits keep the total within the existing supported checkout amount range.

The order stores a versioned immutable `pricing` breakdown and retains `totalMinor` as the payment authority. The existing atomic stock allocation, order numbering, email queue and operation recovery remain in place. A retry of an already-saved operation returns its original result before quoting, including older browser attempts lacking a quote ID. A never-saved old attempt must review current totals. The original request fingerprint remains based on parsed order input so old saved attempts remain recoverable.

Stripe receives separate items and shipping lines for new orders (zero shipping is omitted), adding to the saved total. Existing Stripe requests retain their saved parameters/idempotency key; historical orders without a breakdown retain their original single total. Payment/webhook matching still compares the full saved total. The customer page, staff details and newly queued emails show the same saved breakdown. Frozen email templates are not rewritten.

Fulfillment defaults to the service chosen at checkout. Later staff method/address edits do not automatically reprice, collect extra payment or refund a difference; arrange those changes separately with the customer. Historical orders have no invented shipping/tax breakdown. The in-app tutorial is `/admin/how-to#shipping-rates` and explains examples, recovery, permissions and limits.

## Storage and deployment

Settings: `businesses/sadboi/inventoryState/shipping`. Save recovery: `shippingOperations`; changes are in `inventoryAudit`. Client Firestore access remains denied; server routes enforce staff roles/CSRF. No extra environment variables, scheduler, provider account or Firestore indexes are needed for this slice. The prior email slice's documented index deployment remains required before deploying the combined app.

## Validation and remaining work

Validation completed locally September 30:

- `pnpm check` passed: typecheck, lint, 88 domain tests, 7 Firebase credential tests, 2 runtime tests and the production build.
- The combined emulator suite behind `pnpm test:shipping`, run with `--shipping-preview`, passed all 89 integration checks. An initial run stopped on a local `ECONNRESET` fetching lifecycle CSRF; a full rerun passed without changing application code or weakening assertions.
- `pnpm test:order-emails-disabled` passed all 33 checks. Existing order suites use an explicit quote helper to preserve their original behavior checks; shipping integration tests use raw requests to test missing/tampered/stale quotes and authorization.
- Connected Chrome verified fictional two-print totals: $50 items + $7.50 standard = $57.50, or $15 express = $65. A staff save changed standard to $8.25; the old cart request was rejected with its contents retained, then a fresh review created SO-000026 for $58.25. The confirmation and private order page agreed. Staff settings, cart review and private order page fit a 390px viewport without horizontal overflow; keyboard navigation reached cart help. The customer page logged no browser errors. Test tabs, viewport override and emulators were cleaned up.

All mutations used disposable emulator records and fictional rates. No production shipping configuration, deployments, external mail or real payments were made. Stripe request totals and payment reconciliation were verified against the local provider fixture; an actual Stripe sandbox purchase with shipping remains a deployment check. Real-device and full screen-reader testing remain outstanding.

Live carrier quotes, package/weight rules, free-shipping thresholds, address verification, carrier labels, international destinations, discounts, tax policy/calculation, live payments and actual provider delivery remain open. Flat rates do not calculate fulfillment costs or create shipping labels.
